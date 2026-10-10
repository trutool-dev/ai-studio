/**
 * Controlador de onboarding (BE-02).
 * Gestiona los pasos del onboarding y la generación del plan inicial con IA.
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const aiService = require('../services/aiService');
const exerciseSelector = require('../services/exerciseSelector.service');

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

/** POST /onboarding/start — Iniciar onboarding (alias de register) */
const start = async (req, res, next) => {
  try {
    return sendSuccess(res, { user_id: req.user.userId }, 'Onboarding iniciado. Completa los pasos del perfil.');
  } catch (err) { next(err); }
};

/** PUT /onboarding/profile */
const saveProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, birthdate, gender, weight_kg, height_cm, body_type, activity_level, goal } = req.body;

    // Verificación de edad mínima 16 años (LOPDGDD Art. 7)
    if (birthdate) {
      const age = Math.floor((Date.now() - new Date(birthdate)) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 16) {
        return res.status(400).json({
          success: false,
          error: 'AGE_RESTRICTION',
          message: 'Debes tener al menos 16 años para usar Healthy (LOPDGDD Art. 7)',
        });
      }
    }

    const profile = await prisma.profile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, name, birthdate: new Date(birthdate), gender, weight_kg, height_cm, body_type, activity_level, goal },
      update: { name, birthdate: new Date(birthdate), gender, weight_kg, height_cm, body_type, activity_level, goal },
    });

    return sendSuccess(res, { profile }, 'Perfil guardado correctamente');
  } catch (err) { next(err); }
};

/** PUT /onboarding/lifestyle */
const saveLifestyle = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { profession, work_type, work_hours_per_day, stress_level, usual_schedule, sleep_hours_usual, sleep_quality, alcohol_consumption, smoker, daily_water_glasses } = req.body;

    const lifestyle = await prisma.lifestyleProfile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, profession, work_type, work_hours_per_day, stress_level, usual_schedule, sleep_hours_usual, sleep_quality, alcohol_consumption, smoker, daily_water_glasses },
      update: { profession, work_type, work_hours_per_day, stress_level, usual_schedule, sleep_hours_usual, sleep_quality, alcohol_consumption, smoker, daily_water_glasses },
    });

    return sendSuccess(res, { lifestyle }, 'Estilo de vida guardado correctamente');
  } catch (err) { next(err); }
};

/** PUT /onboarding/training */
const saveTraining = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { available_days_per_week, max_session_duration_minutes, preferred_training_time, has_gym_access, home_equipment, experience_level, injuries_or_limitations } = req.body;

    const training = await prisma.trainingPreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, available_days_per_week, max_session_duration_minutes, preferred_training_time, has_gym_access: has_gym_access ?? false, home_equipment, experience_level, injuries_or_limitations },
      update: { available_days_per_week, max_session_duration_minutes, preferred_training_time, has_gym_access: has_gym_access ?? false, home_equipment, experience_level, injuries_or_limitations },
    });

    return sendSuccess(res, { training }, 'Preferencias de entrenamiento guardadas');
  } catch (err) { next(err); }
};

/** PUT /onboarding/nutrition */
const saveNutrition = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { diet_type, meals_per_day_preferred, cooks_at_home, eats_out_frequency, monthly_food_budget_range } = req.body;

    const nutrition = await prisma.nutritionPreferences.upsert({
      where: { user_id: userId },
      create: { user_id: userId, diet_type, meals_per_day_preferred, cooks_at_home, eats_out_frequency, monthly_food_budget_range },
      update: { diet_type, meals_per_day_preferred, cooks_at_home, eats_out_frequency, monthly_food_budget_range },
    });

    return sendSuccess(res, { nutrition }, 'Preferencias nutricionales guardadas');
  } catch (err) { next(err); }
};

/** PUT /onboarding/health */
const saveHealth = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { conditions = [], food_restrictions = [], healthConsent } = req.body;

    if (conditions.length > 0) {
      await prisma.healthCondition.deleteMany({ where: { user_id: userId } });
      await prisma.healthCondition.createMany({ data: conditions.map(c => ({ ...c, user_id: userId })) });
    }
    if (food_restrictions.length > 0) {
      await prisma.foodRestriction.deleteMany({ where: { user_id: userId } });
      await prisma.foodRestriction.createMany({ data: food_restrictions.map(r => ({ ...r, user_id: userId })) });
    }

    // Registrar consentimiento explícito de datos de salud (RGPD Art. 9)
    // El consentimiento es inmutable una vez otorgado
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { health_consent_given_at: true } });
    if (!user.health_consent_given_at) {
      await prisma.user.update({
        where: { id: userId },
        data: { health_consent_given_at: new Date(), health_consent_version: '1.0' },
      });
      logger.info(`[onboarding] Consentimiento Art. 9 RGPD registrado para usuario ${userId}`);
    }

    return sendSuccess(res, {}, 'Condiciones de salud guardadas');
  } catch (err) { next(err); }
};

/** PUT /onboarding/motivation */
const saveMotivation = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { main_motivation, previous_attempts, previous_attempts_notes, tracking_preference, has_support_network } = req.body;

    const motivation = await prisma.motivationProfile.upsert({
      where: { user_id: userId },
      create: { user_id: userId, main_motivation, previous_attempts, previous_attempts_notes, tracking_preference, has_support_network },
      update: { main_motivation, previous_attempts, previous_attempts_notes, tracking_preference, has_support_network },
    });

    return sendSuccess(res, { motivation }, 'Perfil de motivación guardado');
  } catch (err) { next(err); }
};

/** POST /onboarding/complete */
const complete = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const answers = req.body.answers || [];

    const [profile, lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation] = await Promise.all([
      prisma.profile.findUnique({ where: { user_id: userId } }),
      prisma.lifestyleProfile.findUnique({ where: { user_id: userId } }),
      prisma.trainingPreferences.findUnique({ where: { user_id: userId } }),
      prisma.nutritionPreferences.findUnique({ where: { user_id: userId } }),
      prisma.healthCondition.findMany({ where: { user_id: userId } }),
      prisma.foodRestriction.findMany({ where: { user_id: userId } }),
      prisma.motivationProfile.findUnique({ where: { user_id: userId } }),
    ]);

    // Guardar datos del body si los pasos individuales no se guardaron
    if (!profile && req.body.profile) {
      const p = req.body.profile;
      const birthYear = new Date().getFullYear() - (p.age || 25);
      const birthdate = new Date(birthYear, 6, 1);
      profile = await prisma.profile.upsert({
        where: { user_id: userId },
        create: { user_id: userId, gender: p.gender || 'other', weight_kg: p.weight || p.weight_kg || 70, height_cm: p.height || p.height_cm || 170, body_type: p.bodyType || p.body_type || 'average', goal: req.body.goal || 'general_health', birthdate },
        update: { gender: p.gender || 'other', weight_kg: p.weight || p.weight_kg || 70, height_cm: p.height || p.height_cm || 170, body_type: p.bodyType || p.body_type || 'average', goal: req.body.goal || 'general_health', birthdate },
      });
    }
    if (!training && req.body.training) {
      const t = req.body.training;
      const equipArr = Array.isArray(t.equipment) ? t.equipment : [t.equipment].filter(Boolean);
      training = await prisma.trainingPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId, available_days_per_week: t.daysPerWeek || t.available_days_per_week || 3, has_gym_access: equipArr.includes('gym'), home_equipment: equipArr.filter(e => e !== 'gym').join(',') || 'none', experience_level: t.experience || t.experience_level || 'beginner', max_session_duration_minutes: 60 },
        update: { available_days_per_week: t.daysPerWeek || t.available_days_per_week || 3, has_gym_access: equipArr.includes('gym'), home_equipment: equipArr.filter(e => e !== 'gym').join(',') || 'none', experience_level: t.experience || t.experience_level || 'beginner' },
      });
    }
    if (!nutrition && req.body.nutrition) {
      const n = req.body.nutrition;
      nutrition = await prisma.nutritionPreferences.upsert({
        where: { user_id: userId },
        create: { user_id: userId, diet_type: n.dietType || n.diet_type || 'omnivore' },
        update: { diet_type: n.dietType || n.diet_type || 'omnivore' },
      });
    }

    if (!profile) return sendError(res, 'PROFILE_REQUIRED', 'Debes completar tu perfil físico primero', 400);
    if (!training) return sendError(res, 'TRAINING_REQUIRED', 'Debes completar tus preferencias de entrenamiento primero', 400);

    // Guardar respuestas del onboarding
    if (answers.length > 0) {
      await prisma.onboardingAnswer.deleteMany({ where: { user_id: userId } });
      await prisma.onboardingAnswer.createMany({ data: answers.map(a => ({ ...a, user_id: userId })) });
    }

    // Calcular edad desde birthdate
    const birthdate = new Date(profile.birthdate);
    const age = new Date().getFullYear() - birthdate.getFullYear();

    const physicalProfile = {
      age,
      weight_kg: parseFloat(profile.weight_kg) || 70,
      height_cm: parseFloat(profile.height_cm) || 170,
      gender: profile.gender || 'male',
      body_type: profile.body_type,
      activity_level: profile.activity_level || 'moderate',
      goal: profile.goal || 'general_health',
    };

    const metabolism = aiService.calculateMetabolism(physicalProfile);
    const macros = calculateMacros(metabolism.target_calories, physicalProfile.goal);

    // Actualizar targets en el perfil
    await prisma.profile.update({
      where: { user_id: userId },
      data: {
        daily_calories_target: metabolism.target_calories,
        daily_protein_target: macros.protein_g,
        daily_carbs_target: macros.carbs_g,
        daily_fat_target: macros.fat_g,
      },
    });

    const onboardingData = {
      physical: physicalProfile,
      lifestyle: lifestyle || undefined,
      training: {
        available_days_per_week: training.available_days_per_week,
        max_session_duration_minutes: training.max_session_duration_minutes,
        has_gym_access: training.has_gym_access,
        home_equipment: training.home_equipment,
        experience_level: training.experience_level || 'beginner',
        injuries_or_limitations: training.injuries_or_limitations,
      },
      nutrition: nutrition ? {
        diet_type: nutrition.diet_type,
        meals_per_day_preferred: nutrition.meals_per_day_preferred,
        food_restrictions: foodRestrictions.map(r => ({ restriction_type: r.restriction_type, food_name: r.food_name })),
      } : undefined,
      health: healthConditions.length > 0 ? {
        conditions: healthConditions.map(c => ({ condition_name: c.condition_name, condition_type: c.condition_type, affects_training: c.affects_training, affects_nutrition: c.affects_nutrition, notes: c.notes })),
      } : undefined,
      motivation: motivation || undefined,
    };

    // Obtener ejercicios del catálogo real filtrados por perfil del usuario (BE-EX-02)
    const exerciseProfile = {
      equipment: training.home_equipment || 'none',
      goal: profile.goal || 'general_health',
      experience_level: training.experience_level || 'beginner',
      injuries: training.injuries_or_limitations
        ? training.injuries_or_limitations.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : [],
    };
    const catalogExercises = await exerciseSelector.getExercisesForProfile(exerciseProfile, 80);
    const exerciseCatalogContext = catalogExercises.length > 0
      ? `## CATÁLOGO DE EJERCICIOS DISPONIBLES (${catalogExercises.length} ejercicios)\nUSA PREFERENTEMENTE estos ejercicios reales del catálogo al generar el plan. Incluye el nombre exacto del ejercicio.\n\n${exerciseSelector.formatExercisesForPrompt(catalogExercises)}`
      : null;
    logger.info(`[onboarding] Catálogo: ${catalogExercises.length} ejercicios para usuario ${userId}`);

    // Generar plan con IA (con fallback automático)
    const generatedPlan = await aiService.generatePlan(userId, onboardingData, 'plan_generation', exerciseCatalogContext);

    // Pausar planes activos previos
    await prisma.plan.updateMany({ where: { user_id: userId, status: 'active' }, data: { status: 'completed' } });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (generatedPlan.training_plan.weeks * 7));

    const plan = await prisma.plan.create({
      data: {
        user_id: userId,
        type: 'combined',
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        generated_by_ai: generatedPlan.generated_by_ai,
        ai_model_version: generatedPlan.model_version,
        ai_prompt_used: generatedPlan.generated_by_ai ? 'onboarding_complete' : null,
      },
    });

    // Crear sesiones de entrenamiento (todas las semanas del plan)
    const trainingSessions = [];
    for (let week = 0; week < generatedPlan.training_plan.weeks; week++) {
      for (const daySession of generatedPlan.training_plan.weekly_schedule) {
        if (daySession.session_type === 'rest') continue;
        const sessionDate = new Date(startDate);
        sessionDate.setDate(startDate.getDate() + (week * 7) + (daySession.day_of_week - 1));
        trainingSessions.push({ plan_id: plan.id, user_id: userId, scheduled_date: sessionDate, status: 'scheduled', notes: daySession.notes || null });
      }
    }
    if (trainingSessions.length > 0) {
      await prisma.trainingSession.createMany({ data: trainingSessions });
    }

    // Crear comidas de la primera semana como referencia
    const meals = [];
    for (let day = 0; day < 7; day++) {
      const mealDate = new Date(startDate);
      mealDate.setDate(startDate.getDate() + day);
      for (const suggestion of generatedPlan.nutrition_plan.meal_suggestions) {
        meals.push({
          plan_id: plan.id,
          user_id: userId,
          meal_type: suggestion.meal_type,
          scheduled_date: mealDate,
          calories: suggestion.approximate_calories,
          protein_g: suggestion.protein_g,
          carbs_g: suggestion.carbs_g,
          fat_g: suggestion.fat_g,
          status: 'scheduled',
        });
      }
    }
    if (meals.length > 0) {
      await prisma.meal.createMany({ data: meals });
    }

    logger.info(`[onboarding] Completado para usuario ${userId}. Plan ${plan.id} creado.`);
    return sendSuccess(res, {
      plan: { id: plan.id, status: plan.status, start_date: plan.start_date, end_date: plan.end_date, generated_by_ai: plan.generated_by_ai },
      generated_plan: generatedPlan,
      metabolism,
    }, 'Onboarding completado. Tu plan personalizado ha sido generado.', 201);
  } catch (err) { next(err); }
};

module.exports = { start, saveProfile, saveLifestyle, saveTraining, saveNutrition, saveHealth, saveMotivation, complete };
