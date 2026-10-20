/**
 * Controlador de onboarding (BE-02).
 * Gestiona los pasos del onboarding y la generación del plan inicial con IA.
 *
 * Auditoría 2026-10-19:
 *  - SEC-28 (JB-01): acepta el payload real del frontend (restricciones,
 *    condiciones y lesiones como arrays de ids) y el formato antiguo; los datos
 *    de salud se guardan y llegan al prompt. keto/other ya no provocan 500.
 *  - SEC-29 (JB-02 + SA-18): edad ≥ 16 y rangos fisiológicos validados en todo
 *    camino que crea/actualiza el perfil y antes de llamar a la IA (400).
 *  - SEC-33 (SA-07 + JB-09): consentimiento art. 9 explícito (`healthConsent === true`)
 *    y comprobado antes de guardar datos de salud y de llamar a la IA (403).
 *  - SEC-47 (SA-17): versión de consentimiento configurable y retirada.
 *  - SEC-61 (SA-26): sin spread del body (listas blancas en validation/onboardingInput).
 *  - SEC-36 (JB-04): persistencia del plan en transacción.
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const aiService = require('../services/aiService');
const exerciseSelector = require('../services/exerciseSelector.service');
const consentService = require('../services/healthConsent.service');
const planCache = require('../services/planCache.service');
const { persistGeneratedPlan, filterPlanExercisesByCatalog } = require('../services/planPersistence.service');
const input = require('../validation/onboardingInput');

// Helper: calcular macros a partir de calorías objetivo y goal
function calculateMacros(dailyCalories, goal) {
  const ratios = {
    lose_weight:    [0.35, 0.35, 0.30],
    gain_muscle:    [0.30, 0.45, 0.25],
    maintain:       [0.25, 0.50, 0.25],
    general_health: [0.25, 0.50, 0.25],
  };
  const [p, c, f] = ratios[goal] || ratios.general_health;
  return {
    protein_g: Math.round((dailyCalories * p) / 4),
    carbs_g:   Math.round((dailyCalories * c) / 4),
    fat_g:     Math.round((dailyCalories * f) / 9),
  };
}

/** Responde 400 si el error es de validación de entrada; devuelve true si lo ha gestionado. */
function handleInputError(err, res) {
  if (!(err instanceof input.OnboardingInputError)) return false;
  res.status(400).json({
    success: false,
    error: err.code,
    message: err.message,
    details: err.field ? [{ field: err.field, message: err.message }] : [],
  });
  return true;
}

const consentRequired = (res) => sendError(
  res,
  'HEALTH_CONSENT_REQUIRED',
  'Necesitamos tu consentimiento explícito para tratar tus datos de salud (RGPD art. 9). Acéptalo en el paso de salud.',
  403,
);

/** Invalida la caché del plan sin bloquear la respuesta. */
const invalidateCache = (userId) => planCache.invalidateUserPlanCache(userId).catch(() => false);

/**
 * Sustituye los datos de salud art. 9 presentes (undefined = no tocar).
 * @param {object} tx - cliente Prisma o transacción
 */
async function replaceHealthData(tx, userId, { conditions, food_restrictions, injuries }) {
  if (Array.isArray(conditions)) {
    await tx.healthCondition.deleteMany({ where: { user_id: userId } });
    if (conditions.length > 0) {
      await tx.healthCondition.createMany({ data: conditions.map((c) => ({
        user_id: userId,
        condition_name: c.condition_name,
        condition_type: c.condition_type,
        affects_training: c.affects_training,
        affects_nutrition: c.affects_nutrition,
        notes: c.notes ?? null,
      })) });
    }
  }
  if (Array.isArray(food_restrictions)) {
    await tx.foodRestriction.deleteMany({ where: { user_id: userId } });
    if (food_restrictions.length > 0) {
      await tx.foodRestriction.createMany({ data: food_restrictions.map((r) => ({
        user_id: userId,
        restriction_type: r.restriction_type,
        food_name: r.food_name,
        severity: r.severity,
      })) });
    }
  }
  if (Array.isArray(injuries)) {
    const injuries_or_limitations = input.serializeInjuries(injuries);
    await tx.trainingPreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, injuries_or_limitations },
      update: { injuries_or_limitations },
    });
  }
}

/** POST /onboarding/start — Iniciar onboarding (alias de register) */
const start = async (req, res, next) => {
  try {
    return sendSuccess(res, { user_id: req.user.userId }, 'Onboarding iniciado. Completa los pasos del perfil.');
  } catch (err) { next(err); }
};

/**
 * PUT /onboarding/profile
 * Acepta {age, weight_kg|weight, height_cm|height, gender, body_type|bodyType, goal}
 * (frontend) o {name, birthdate, ...} (antiguo). Edad ≥ 16 y rangos → 400.
 */
const saveProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const data = input.normalizeProfileInput(req.body);
    const profile = await prisma.profile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, name: data.name || 'Usuario', ...data },
      update: data,
    });
    await invalidateCache(userId);
    return sendSuccess(res, { profile }, 'Perfil guardado correctamente');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/** PUT /onboarding/lifestyle */
const saveLifestyle = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const data = input.normalizeLifestyleInput(req.body);
    const lifestyle = await prisma.lifestyleProfile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...data },
      update: data,
    });
    await invalidateCache(userId);
    return sendSuccess(res, { lifestyle }, 'Estilo de vida guardado correctamente');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/** PUT /onboarding/training — acepta {days_per_week, equipment[], experience} o el formato antiguo */
const saveTraining = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const data = input.normalizeTrainingInput(req.body, { requireDays: true });
    const withDefaults = { ...data, has_gym_access: data.has_gym_access ?? false };
    const training = await prisma.trainingPreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...withDefaults },
      update: withDefaults,
    });
    await invalidateCache(userId);
    return sendSuccess(res, { training }, 'Preferencias de entrenamiento guardadas');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/**
 * PUT /onboarding/nutrition — acepta {diet_type, restrictions: string[], budget} (frontend).
 * Las restricciones (datos de salud) solo se guardan si ya hay consentimiento art. 9;
 * si no, se indica `restrictions_pending_consent` y se guardarán en /complete.
 */
const saveNutrition = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { restrictions, ...data } = input.normalizeNutritionInput(req.body);
    const nutrition = await prisma.nutritionPreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...data },
      update: data,
    });

    let restrictionsPendingConsent = false;
    if (Array.isArray(restrictions)) {
      const { valid } = await consentService.getConsentState(prisma, userId);
      if (valid) await replaceHealthData(prisma, userId, { food_restrictions: restrictions });
      else restrictionsPendingConsent = restrictions.length > 0;
    }
    await invalidateCache(userId);
    return sendSuccess(res, { nutrition, restrictions_pending_consent: restrictionsPendingConsent }, 'Preferencias nutricionales guardadas');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/**
 * PUT /onboarding/health
 * Requiere `healthConsent === true` (booleano estricto). Acepta
 * {conditions: string[]|object[], injuries: string[], food_restrictions|restrictions}.
 */
const saveHealth = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    if (!req.body || req.body.healthConsent !== true) {
      return sendError(res, 'HEALTH_CONSENT_REQUIRED', 'Debes aceptar expresamente el tratamiento de tus datos de salud (healthConsent: true).', 400);
    }
    const health = input.normalizeHealthInput(req.body);

    await prisma.$transaction(async (tx) => {
      await consentService.recordConsent(tx, userId);
      await replaceHealthData(tx, userId, health);
    });
    await invalidateCache(userId);

    return sendSuccess(res, { health_consent_version: consentService.getConsentVersion() }, 'Condiciones de salud guardadas');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/**
 * DELETE /onboarding/health-consent — Retira el consentimiento art. 9 (SEC-47).
 * Borra condiciones, restricciones y lesiones; la IA deja de usarse hasta
 * volver a consentir (PUT /onboarding/health con healthConsent: true).
 */
const withdrawHealthConsent = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await consentService.withdrawConsent(prisma, userId);
    await invalidateCache(userId);
    return sendSuccess(res, {
      withdrawn: true,
      withdrawn_at: result.withdrawn_at,
      deleted: { conditions: result.conditions, food_restrictions: result.food_restrictions, injuries_cleared: result.injuries_cleared > 0 },
    }, 'Consentimiento retirado y datos de salud eliminados');
  } catch (err) { next(err); }
};

/** PUT /onboarding/motivation — acepta {motivations[], previous_attempts: 'none'|'few'|'many'} o el formato antiguo */
const saveMotivation = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const data = input.normalizeMotivationInput(req.body);
    const motivation = await prisma.motivationProfile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, ...data },
      update: data,
    });
    return sendSuccess(res, { motivation }, 'Perfil de motivación guardado');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

/** Guarda en una transacción las secciones del body de /complete (snapshot del store del frontend). */
async function persistCompletePayload(userId, normalized, existingProfile) {
  await prisma.$transaction(async (tx) => {
    const p = normalized.profile;
    if (p && Object.keys(p).length > 0) {
      if (existingProfile) {
        await tx.profile.update({ where: { user_id: userId }, data: p });
      } else if (p.birthdate) {
        await tx.profile.create({ data: { user_id: userId, name: p.name || 'Usuario', ...p } });
      }
    }
    if (normalized.lifestyle && Object.keys(normalized.lifestyle).length > 0) {
      await tx.lifestyleProfile.upsert({ where: { user_id: userId }, create: { user_id: userId, ...normalized.lifestyle }, update: normalized.lifestyle });
    }
    if (normalized.training && Object.keys(normalized.training).length > 0) {
      const t = normalized.training;
      await tx.trainingPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId, max_session_duration_minutes: 60, ...t },
        update: t,
      });
    }
    if (normalized.nutrition) {
      const { restrictions, ...n } = normalized.nutrition;
      if (Object.keys(n).length > 0) {
        await tx.nutritionPreferences.upsert({ where: { user_id: userId }, create: { user_id: userId, ...n }, update: n });
      }
    }
    if (normalized.motivation && Object.keys(normalized.motivation).length > 0) {
      await tx.motivationProfile.upsert({ where: { user_id: userId }, create: { user_id: userId, ...normalized.motivation }, update: normalized.motivation });
    }
    const health = normalized.health || {};
    const restrictionsFromNutrition = normalized.nutrition && normalized.nutrition.restrictions;
    await replaceHealthData(tx, userId, {
      conditions: health.conditions,
      food_restrictions: health.food_restrictions !== undefined ? health.food_restrictions : restrictionsFromNutrition,
      injuries: health.injuries,
    });
    if (normalized.answers.length > 0) {
      await tx.onboardingAnswer.deleteMany({ where: { user_id: userId } });
      await tx.onboardingAnswer.createMany({ data: normalized.answers.map((a) => ({ user_id: userId, ...a })) });
    }
  });
}

/** Carga los datos guardados del onboarding del usuario. */
async function loadOnboardingRecords(userId) {
  const [profile, lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation] = await Promise.all([
    prisma.profile.findUnique({ where: { user_id: userId } }),
    prisma.lifestyleProfile.findUnique({ where: { user_id: userId } }),
    prisma.trainingPreferences.findUnique({ where: { user_id: userId } }),
    prisma.nutritionPreferences.findUnique({ where: { user_id: userId } }),
    prisma.healthCondition.findMany({ where: { user_id: userId } }),
    prisma.foodRestriction.findMany({ where: { user_id: userId } }),
    prisma.motivationProfile.findUnique({ where: { user_id: userId } }),
  ]);
  return { profile, lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation };
}

/**
 * Construye los datos que recibe la IA a partir de los registros guardados
 * (lista blanca de campos; las restricciones/condiciones/lesiones siempre incluidas).
 * Exportada para reutilizarla en plans.controller.
 */
function buildOnboardingData(records, physicalProfile) {
  const { lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation } = records;
  const injuries = input.normalizeInjuriesSafe(training && training.injuries_or_limitations);
  return {
    physical: physicalProfile,
    lifestyle: lifestyle ? {
      work_type: lifestyle.work_type,
      stress_level: lifestyle.stress_level,
      sleep_hours_usual: lifestyle.sleep_hours_usual,
      sleep_quality: lifestyle.sleep_quality,
      smoker: lifestyle.smoker,
    } : undefined,
    training: {
      available_days_per_week: training.available_days_per_week,
      max_session_duration_minutes: training.max_session_duration_minutes,
      has_gym_access: training.has_gym_access,
      home_equipment: training.home_equipment,
      experience_level: training.experience_level || 'beginner',
      injuries,
    },
    // Las restricciones se envían aunque no haya preferencias nutricionales guardadas
    nutrition: {
      diet_type: nutrition ? nutrition.diet_type : null,
      meals_per_day_preferred: nutrition ? nutrition.meals_per_day_preferred : undefined,
      food_restrictions: (foodRestrictions || []).map((r) => ({ restriction_type: r.restriction_type, food_name: r.food_name })),
    },
    health: healthConditions && healthConditions.length > 0 ? {
      conditions: healthConditions.map((c) => ({ condition_name: c.condition_name, condition_type: c.condition_type, affects_training: c.affects_training, affects_nutrition: c.affects_nutrition })),
    } : undefined,
    motivation: motivation ? { main_motivation: motivation.main_motivation, tracking_preference: motivation.tracking_preference } : undefined,
  };
}

/** Perfil físico validado (edad ≥ 16 y rangos) a partir del registro guardado. */
function buildPhysicalProfile(profile) {
  const stored = input.assertStoredProfileValid(profile);
  return {
    age: stored.age,
    weight_kg: stored.weight_kg,
    height_cm: stored.height_cm,
    gender: profile.gender || 'other',
    body_type: profile.body_type,
    activity_level: profile.activity_level || 'moderate',
    goal: profile.goal || 'general_health',
  };
}

/** POST /onboarding/complete */
const complete = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // 1) Validar y normalizar el body (formato del frontend o antiguo) — 400 si no es válido
    const normalized = input.normalizeCompletePayload(req.body);

    // 2) Consentimiento art. 9 registrado antes de guardar salud o llamar a la IA
    const { valid } = await consentService.getConsentState(prisma, userId);
    if (!valid) return consentRequired(res);

    // 3) Guardar el snapshot del body en una transacción
    const existingProfile = await prisma.profile.findUnique({ where: { user_id: userId } });
    await persistCompletePayload(userId, normalized, existingProfile);

    const records = await loadOnboardingRecords(userId);
    if (!records.profile) return sendError(res, 'PROFILE_REQUIRED', 'Debes completar tu perfil físico primero', 400);
    if (!records.training) return sendError(res, 'TRAINING_REQUIRED', 'Debes completar tus preferencias de entrenamiento primero', 400);

    // 4) Edad y rangos del perfil guardado (cubre perfiles creados por otros caminos)
    const physicalProfile = buildPhysicalProfile(records.profile);
    const metabolism = aiService.calculateMetabolism(physicalProfile);
    const macros = calculateMacros(metabolism.target_calories, metabolism.effective_goal || physicalProfile.goal);

    await prisma.profile.update({
      where: { user_id: userId },
      data: {
        daily_calories_target: metabolism.target_calories,
        daily_protein_target: macros.protein_g,
        daily_carbs_target: macros.carbs_g,
        daily_fat_target: macros.fat_g,
      },
    });

    const onboardingData = buildOnboardingData(records, physicalProfile);

    // Catálogo real filtrado por perfil y lesiones (BE-EX-02, SEC-58)
    const catalogExercises = await exerciseSelector.getExercisesForProfile({
      equipment: records.training.home_equipment || 'none',
      goal: physicalProfile.goal,
      experience_level: records.training.experience_level || 'beginner',
      injuries: onboardingData.training.injuries,
    }, 80);
    logger.info(`[onboarding] Catálogo: ${catalogExercises.length} ejercicios para usuario ${userId}`);

    // SEC-54: el catálogo va como parámetro `exercises`
    const aiPlan = await aiService.generatePlan(userId, onboardingData, 'plan_generation', null, catalogExercises);
    const { plan: generatedPlan } = filterPlanExercisesByCatalog(aiPlan, catalogExercises);

    const plan = await persistGeneratedPlan(prisma, {
      userId,
      plan: generatedPlan,
      catalog: catalogExercises,
      previousPlansStatus: 'completed',
      promptLabel: 'onboarding_complete',
      includeMeals: true,
    });

    logger.info(`[onboarding] Completado para usuario ${userId}. Plan ${plan.id} creado.`);
    return sendSuccess(res, {
      plan: { id: plan.id, status: plan.status, start_date: plan.start_date, end_date: plan.end_date, generated_by_ai: plan.generated_by_ai },
      generated_plan: generatedPlan,
      generated_by_ai: Boolean(generatedPlan.generated_by_ai),
      metabolism,
    }, 'Onboarding completado. Tu plan personalizado ha sido generado.', 201);
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
};

module.exports = {
  start, saveProfile, saveLifestyle, saveTraining, saveNutrition, saveHealth, saveMotivation,
  withdrawHealthConsent, complete,
  // Reutilizadas por plans.controller
  buildOnboardingData, buildPhysicalProfile, handleInputError,
};
