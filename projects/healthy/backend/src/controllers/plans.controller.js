/**
 * Controlador de planes de entrenamiento y nutrición.
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const aiService = require('../services/aiService');
const exerciseSelector = require('../services/exerciseSelector.service');
const consentService = require('../services/healthConsent.service');
const { persistGeneratedPlan, filterPlanExercisesByCatalog } = require('../services/planPersistence.service');
const { buildOnboardingData, buildPhysicalProfile, handleInputError } = require('./onboarding.controller');

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

/**
 * POST /plans/regenerate — Regenerar plan con IA
 * SEC-33: exige consentimiento art. 9 vigente (403). SEC-29: valida edad/rangos del perfil (400).
 * SEC-36/54: salida validada, IDs de ejercicio contra el catálogo y persistencia en transacción.
 */
const regeneratePlan = async (req, res, next) => {
  try {
    // SEC-04: userId siempre del JWT — nunca del body del request
    const userId = req.user.userId;
    const reason = aiService.normalizeRegenerationReason
      ? aiService.normalizeRegenerationReason(req.body && req.body.reason)
      : 'manual_request';

    const { valid } = await consentService.getConsentState(prisma, userId);
    if (!valid) {
      return sendError(res, 'HEALTH_CONSENT_REQUIRED', 'Necesitamos tu consentimiento explícito para tratar tus datos de salud (RGPD art. 9).', 403);
    }

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

    const records = { profile, lifestyle, training, nutrition, healthConditions, foodRestrictions, motivation };
    const physicalProfile = buildPhysicalProfile(profile);
    const onboardingData = buildOnboardingData(records, physicalProfile);

    // Catálogo real filtrado por perfil y lesiones (BE-EX-03, SEC-58)
    const catalogExercises = await exerciseSelector.getExercisesForProfile({
      equipment: training.home_equipment || 'none',
      goal: physicalProfile.goal,
      experience_level: training.experience_level || 'beginner',
      injuries: onboardingData.training.injuries,
    }, 80);
    logger.info(`[plans] Catálogo: ${catalogExercises.length} ejercicios para usuario ${userId} (regeneración)`);

    const aiPlan = await aiService.regeneratePlan(
      userId, onboardingData, reason,
      progressLogs.map((l) => ({ log_date: new Date(l.log_date).toISOString(), weight_kg: l.weight_kg ? parseFloat(l.weight_kg) : null })),
      catalogExercises,
    );
    // SEC-23/SEC-54: IDs de ejercicio validados contra el catálogo enviado
    const { plan: newPlan } = filterPlanExercisesByCatalog(aiPlan, catalogExercises);

    const savedPlan = await persistGeneratedPlan(prisma, {
      userId,
      plan: newPlan,
      catalog: catalogExercises,
      previousPlansStatus: 'paused',
      promptLabel: reason,
      includeMeals: false,
    });

    return sendSuccess(res, { plan_id: savedPlan.id, generated_plan: newPlan }, 'Plan regenerado correctamente');
  } catch (err) {
    if (handleInputError(err, res)) return undefined;
    next(err);
  }
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
