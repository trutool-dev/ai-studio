/**
 * Controlador de planes de entrenamiento y nutrición.
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const aiService = require('../services/aiService');
const exerciseSelector = require('../services/exerciseSelector.service');

/** GET /plans — Plan activo del usuario */
const getActivePlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const plan = await prisma.plan.findFirst({
      where: { user_id: userId, status: 'active' },
      include: {
        training_sessions: { orderBy: { scheduled_date: 'asc' }, take: 30 },
        meals: { where: { scheduled_date: { gte: startOfDay, lte: endOfDay } } },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!plan) return sendError(res, 'NOT_FOUND', 'No tienes un plan activo. Completa el onboarding primero.', 404);
    return sendSuccess(res, { plan }, 'Plan activo');
  } catch (err) { next(err); }
};

/** GET /plans/:id */
const getPlanById = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const plan = await prisma.plan.findFirst({
      where: { id, user_id: userId },
      include: {
        training_sessions: {
          orderBy: { scheduled_date: 'asc' },
          include: { session_exercises: { include: { exercise: true }, orderBy: { order_index: 'asc' } } },
        },
        meals: { orderBy: { scheduled_date: 'asc' }, include: { meal_foods: { include: { food: true } } } },
      },
    });

    if (!plan) return sendError(res, 'NOT_FOUND', 'Plan no encontrado', 404);
    return sendSuccess(res, { plan }, 'Plan');
  } catch (err) { next(err); }
};

/** POST /plans/regenerate — Regenerar plan con IA */
const regeneratePlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { reason = 'manual_request' } = req.body;

    const [profile, lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation, progressLogs] = await Promise.all([
      prisma.profile.findUnique({ where: { user_id: userId } }),
      prisma.lifestyleProfile.findUnique({ where: { user_id: userId } }),
      prisma.trainingPreferences.findUnique({ where: { user_id: userId } }),
      prisma.nutritionPreferences.findUnique({ where: { user_id: userId } }),
      prisma.healthCondition.findMany({ where: { user_id: userId } }),
      prisma.foodRestriction.findMany({ where: { user_id: userId } }),
      prisma.motivationProfile.findUnique({ where: { user_id: userId } }),
      prisma.progressLog.findMany({ where: { user_id: userId }, orderBy: { log_date: 'desc' }, take: 30 }),
    ]);

    if (!profile || !training) return sendError(res, 'ONBOARDING_INCOMPLETE', 'Debes completar el onboarding primero', 400);

    const age = new Date().getFullYear() - new Date(profile.birthdate).getFullYear();
    const onboardingData = {
      physical: { age, weight_kg: parseFloat(profile.weight_kg) || 70, height_cm: parseFloat(profile.height_cm) || 170, gender: profile.gender || 'male', body_type: profile.body_type, activity_level: profile.activity_level || 'moderate', goal: profile.goal || 'general_health' },
      lifestyle: lifestyle || undefined,
      training: { available_days_per_week: training.available_days_per_week, max_session_duration_minutes: training.max_session_duration_minutes, has_gym_access: training.has_gym_access, home_equipment: training.home_equipment, experience_level: training.experience_level || 'beginner', injuries_or_limitations: training.injuries_or_limitations },
      nutrition: nutrition ? { diet_type: nutrition.diet_type, meals_per_day_preferred: nutrition.meals_per_day_preferred, food_restrictions: foodRestrictions.map(r => ({ restriction_type: r.restriction_type, food_name: r.food_name })) } : undefined,
      health: healthConditions.length > 0 ? { conditions: healthConditions } : undefined,
      motivation: motivation || undefined,
    };

    // Obtener ejercicios del catálogo real filtrados por perfil del usuario (BE-EX-03)
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
    logger.info(`[plans] Catálogo: ${catalogExercises.length} ejercicios para usuario ${userId} (regeneración)`);

    const newPlan = await aiService.regeneratePlan(userId, onboardingData, reason, progressLogs.map(l => ({ log_date: l.log_date.toISOString(), weight_kg: l.weight_kg ? parseFloat(l.weight_kg) : null })), exerciseCatalogContext);

    await prisma.plan.updateMany({ where: { user_id: userId, status: 'active' }, data: { status: 'paused' } });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (newPlan.training_plan.weeks * 7));

    const savedPlan = await prisma.plan.create({
      data: { user_id: userId, type: 'combined', start_date: startDate, end_date: endDate, status: 'active', generated_by_ai: newPlan.generated_by_ai, ai_model_version: newPlan.model_version, ai_prompt_used: reason },
    });

    // Crear sesiones de entrenamiento con ejercicios del catálogo
    const bodyTypeMap = { slim: 'ectomorph', athletic: 'mesomorph', average: 'mesomorph', overweight: 'endomorph' };
    const equipMap    = { gym: 'full', home: 'dumbbells', outdoors: 'none', none: 'none' };
    const trainingSessions = [];
    for (let week = 0; week < newPlan.training_plan.weeks; week++) {
      for (const daySession of newPlan.training_plan.weekly_schedule) {
        if (daySession.session_type === 'rest') continue;
        // Convierte ISO weekday (1=Lun..7=Dom) a JS weekday (0=Dom..6=Sab)
        const isoToJs = (iso) => iso === 7 ? 0 : iso;
        const targetJsDay = isoToJs(daySession.day_of_week);
        const todayJsDay = startDate.getDay();
        let daysOffset = targetJsDay - todayJsDay;
        if (daysOffset < 0) daysOffset += 7; // si el dia ya paso esta semana, ir a la siguiente ocurrencia
        const sessionDate = new Date(startDate);
        sessionDate.setDate(startDate.getDate() + (week * 7) + daysOffset);
        trainingSessions.push({ plan_id: savedPlan.id, user_id: userId, scheduled_date: sessionDate, status: 'scheduled', notes: daySession.notes || null });
      }
    }
    if (trainingSessions.length > 0) {
      await prisma.trainingSession.createMany({ data: trainingSessions });
      if (catalogExercises.length > 0) {
        const createdSessions = await prisma.trainingSession.findMany({
          where: { plan_id: savedPlan.id },
          orderBy: { scheduled_date: 'asc' },
          select: { id: true },
        });
        const EXERCISES_PER_SESSION = 4;
        const sessionExercises = [];
        createdSessions.forEach((session, idx) => {
          for (let i = 0; i < EXERCISES_PER_SESSION; i++) {
            const ex = catalogExercises[(idx * EXERCISES_PER_SESSION + i) % catalogExercises.length];
            sessionExercises.push({ session_id: session.id, exercise_id: ex.id, sets: 3, reps: 12, rest_seconds: 60, order_index: i + 1 });
          }
        });
        await prisma.sessionExercise.createMany({ data: sessionExercises });
      }
    }

    return sendSuccess(res, { plan_id: savedPlan.id, generated_plan: newPlan }, 'Plan regenerado correctamente');
  } catch (err) { next(err); }
};

/** PUT /plans/:id/pause */
const pausePlan = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const plan = await prisma.plan.findFirst({ where: { id, user_id: userId } });
    if (!plan) return sendError(res, 'NOT_FOUND', 'Plan no encontrado', 404);
    if (plan.status === 'paused') return sendError(res, 'PLAN_ALREADY_PAUSED', 'El plan ya está pausado', 400);

    await prisma.plan.update({ where: { id }, data: { status: 'paused' } });
    return sendSuccess(res, {}, 'Plan pausado correctamente');
  } catch (err) { next(err); }
};

module.exports = { getActivePlan, getPlanById, regeneratePlan, pausePlan };
