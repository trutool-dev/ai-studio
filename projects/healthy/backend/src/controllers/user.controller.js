/**
 * Controlador de usuario (RGPD).
 * Implementa el derecho al olvido (Art. 17) y portabilidad de datos (Art. 20).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const redis = require('../services/redis.service');

// ─── DELETE /user/me — Derecho al olvido (RGPD Art. 17) ─────────

/**
 * Elimina permanentemente la cuenta del usuario autenticado y todos sus datos.
 * El borrado se realiza en orden respetando las foreign keys.
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Verificar que el usuario existe antes de intentar el borrado
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    // 1. Eliminar logs de tokens de IA
    await prisma.tokenUsageLog.deleteMany({ where: { user_id: userId } });

    // 2. Eliminar datos de autenticación
    await prisma.verificationCode.deleteMany({ where: { user_id: userId } });
    await prisma.passwordResetToken.deleteMany({ where: { user_id: userId } });
    await prisma.authSession.deleteMany({ where: { user_id: userId } });

    // 3. Eliminar datos de onboarding y salud
    await prisma.onboardingAnswer.deleteMany({ where: { user_id: userId } });
    await prisma.healthCondition.deleteMany({ where: { user_id: userId } });
    await prisma.foodRestriction.deleteMany({ where: { user_id: userId } });

    // 4. Eliminar perfiles
    await prisma.lifestyleProfile.deleteMany({ where: { user_id: userId } });
    await prisma.trainingPreferences.deleteMany({ where: { user_id: userId } });
    await prisma.nutritionPreferences.deleteMany({ where: { user_id: userId } });
    await prisma.motivationProfile.deleteMany({ where: { user_id: userId } });

    // 5. Eliminar ejercicios de sesiones y sesiones de entrenamiento
    const trainingSessions = await prisma.trainingSession.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const trainingSessionIds = trainingSessions.map(s => s.id);
    if (trainingSessionIds.length > 0) {
      await prisma.sessionExercise.deleteMany({ where: { session_id: { in: trainingSessionIds } } });
    }
    await prisma.trainingSession.deleteMany({ where: { user_id: userId } });

    // 6. Eliminar foods de comidas y comidas
    const meals = await prisma.meal.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    const mealIds = meals.map(m => m.id);
    if (mealIds.length > 0) {
      await prisma.mealFood.deleteMany({ where: { meal_id: { in: mealIds } } });
    }
    await prisma.meal.deleteMany({ where: { user_id: userId } });

    // 7. Eliminar logs de progreso y diarios
    await prisma.progressLog.deleteMany({ where: { user_id: userId } });
    await prisma.dailyLog.deleteMany({ where: { user_id: userId } });

    // 8. Eliminar planes
    await prisma.plan.deleteMany({ where: { user_id: userId } });

    // 9. Eliminar perfil
    await prisma.profile.deleteMany({ where: { user_id: userId } });

    // 10. Eliminar usuario principal
    await prisma.user.delete({ where: { id: userId } });

    // 11. Invalidar todas las sesiones en caché Redis (no-fatal si Redis no disponible)
    try {
      const sessionId = req.user?.sessionId;
      if (sessionId) {
        await redis.del(`session:${sessionId}`);
      }
      await redis.del(`user:${userId}`);
    } catch (redisErr) {
      logger.warn(`[user] Redis no disponible al eliminar cuenta: ${redisErr.message}`);
    }

    logger.info(`[user] Cuenta eliminada permanentemente: ${userId}`);
    return res.status(200).json({ success: true, message: 'Account deleted permanently' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /user/me/export — Portabilidad de datos (RGPD Art. 20) ──

/**
 * Exporta todos los datos del usuario en formato JSON.
 * Devuelve el archivo como adjunto descargable.
 */
const exportData = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Recopilar todos los datos del usuario en paralelo
    const [
      user,
      profile,
      lifestyle,
      trainingPrefs,
      nutritionPrefs,
      healthConditions,
      foodRestrictions,
      motivation,
      plans,
      progressLogs,
      dailyLogs,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, created_at: true, status: true },
      }),
      prisma.profile.findUnique({
        where: { user_id: userId },
        select: { name: true, birthdate: true, gender: true, weight_kg: true, height_cm: true, goal: true, activity_level: true, body_type: true, daily_calories_target: true, daily_protein_target: true, daily_carbs_target: true, daily_fat_target: true },
      }),
      prisma.lifestyleProfile.findUnique({
        where: { user_id: userId },
        select: { profession: true, work_type: true, work_hours_per_day: true, stress_level: true, usual_schedule: true, sleep_hours_usual: true, sleep_quality: true, alcohol_consumption: true, smoker: true, daily_water_glasses: true },
      }),
      prisma.trainingPreferences.findUnique({
        where: { user_id: userId },
        select: { available_days_per_week: true, max_session_duration_minutes: true, preferred_training_time: true, has_gym_access: true, home_equipment: true, experience_level: true, injuries_or_limitations: true },
      }),
      prisma.nutritionPreferences.findUnique({
        where: { user_id: userId },
        select: { diet_type: true, meals_per_day_preferred: true, cooks_at_home: true, eats_out_frequency: true, monthly_food_budget_range: true },
      }),
      prisma.healthCondition.findMany({
        where: { user_id: userId },
        select: { condition_name: true, condition_type: true, notes: true },
      }),
      prisma.foodRestriction.findMany({
        where: { user_id: userId },
        select: { restriction_type: true, food_name: true, severity: true },
      }),
      prisma.motivationProfile.findUnique({
        where: { user_id: userId },
        select: { main_motivation: true, previous_attempts: true, previous_attempts_notes: true, tracking_preference: true, has_support_network: true },
      }),
      prisma.plan.findMany({
        where: { user_id: userId },
        select: { type: true, start_date: true, status: true, generated_by_ai: true },
      }),
      prisma.progressLog.findMany({
        where: { user_id: userId },
        select: { log_date: true, weight_kg: true, body_fat_percentage: true, muscle_mass_kg: true, waist_cm: true, hip_cm: true, chest_cm: true, notes: true },
        orderBy: { log_date: 'asc' },
      }),
      prisma.dailyLog.findMany({
        where: { user_id: userId },
        select: { log_date: true, water_ml: true, sleep_hours: true, energy_level: true, steps: true, mood: true },
        orderBy: { log_date: 'asc' },
      }),
    ]);

    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        created_at: user.created_at,
        status: user.status,
      },
      profile: profile || null,
      lifestyle: lifestyle || null,
      training_preferences: trainingPrefs || null,
      nutrition_preferences: nutritionPrefs || null,
      health_conditions: healthConditions,
      food_restrictions: foodRestrictions,
      motivation: motivation || null,
      plans,
      progress_logs: progressLogs,
      daily_logs: dailyLogs,
    };

    logger.info(`[user] Exportación de datos solicitada: ${userId}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="healthy-data-export.json"');
    return res.status(200).json(exportPayload);
  } catch (err) {
    next(err);
  }
};

// ─── GET /user/me/profile — Datos del perfil del usuario ─────────

/**
 * Devuelve los datos del perfil del usuario autenticado.
 * Usado por ProfileScreen tras el onboarding (el store se resetea al completarlo).
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const [profile, training, nutrition] = await Promise.all([
      prisma.profile.findUnique({ where: { user_id: userId } }),
      prisma.trainingPreferences.findUnique({ where: { user_id: userId } }),
      prisma.nutritionPreferences.findUnique({ where: { user_id: userId } }),
    ]);
    if (!profile) return sendError(res, 'NOT_FOUND', 'Perfil no encontrado', 404);

    const birthdate = new Date(profile.birthdate);
    const age = new Date().getFullYear() - birthdate.getFullYear();

    return sendSuccess(res, {
      age,
      weight_kg: parseFloat(profile.weight_kg) || null,
      height_cm: parseFloat(profile.height_cm) || null,
      gender: profile.gender,
      goal: profile.goal,
      diet_type: nutrition?.diet_type ?? null,
      sessions_per_week: training?.available_days_per_week ?? null,
    }, 'Perfil del usuario');
  } catch (err) { next(err); }
};

module.exports = { deleteAccount, exportData, getProfile };
