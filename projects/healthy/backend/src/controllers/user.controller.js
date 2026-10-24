/**
 * Controlador de usuario (RGPD).
 * Implementa el derecho de supresión (Art. 17), acceso (Art. 15) y portabilidad (Art. 20).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const redis = require('../services/redis.service');
const { comparePassword } = require('../utils/crypto.util');
const { revokeAllUserSessions } = require('../middleware/auth.middleware');
const consentService = require('../services/healthConsent.service');

// ─── Purga de Redis ──────────────────────────────────────────────

/**
 * Patrones de claves Redis con datos o estado de un usuario.
 * - plan:{userId}:*        planes cacheados (derivados de datos de salud)
 * - ai:tokens:{userId}:*   cuota diaria de tokens de IA
 * - user:{userId}*         caché de perfil/preferencias
 */
const userKeyPatterns = (userId) => [
  `plan:${userId}:*`,
  `ai:tokens:${userId}:*`,
  `user:${userId}*`,
];

/** Claves exactas del usuario (además de las de sesión). */
const userExactKeys = (userId) => [`plan:idx:${userId}`, `user:${userId}`];

/**
 * Devuelve las claves que coinciden con un patrón. Usa SCAN (no bloquea Redis)
 * y, si el cliente no lo soporta, KEYS.
 */
async function findKeys(pattern) {
  if (typeof redis.scan === 'function') {
    const found = new Set();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      keys.forEach((k) => found.add(k));
      cursor = String(next);
    } while (cursor !== '0');
    return [...found];
  }
  return redis.keys(pattern);
}

/**
 * Borra de Redis todas las claves del usuario y sus sesiones.
 * No es fatal: si Redis falla se registra (las claves caducan por TTL).
 * @returns {Promise<number>} número de claves borradas
 */
async function purgeUserFromRedis(userId, sessionIds) {
  try {
    const keys = new Set([
      ...userExactKeys(userId),
      ...sessionIds.map((id) => `session:${id}`),
    ]);
    for (const pattern of userKeyPatterns(userId)) {
      (await findKeys(pattern)).forEach((k) => keys.add(k));
    }
    return await redis.del(...keys);
  } catch (redisErr) {
    logger.warn(`[user] Redis no disponible al purgar la cuenta: ${redisErr.message}`);
    return 0;
  }
}

// ─── DELETE /user/me — Derecho de supresión (RGPD Art. 17) ───────

/**
 * Elimina permanentemente la cuenta del usuario autenticado y todos sus datos.
 * SEC-48 (SA-19):
 * - Reautenticación: exige la contraseña actual en el body (`password`); 401 si no coincide.
 * - Borrado atómico en `prisma.$transaction`: `user.delete` borra en cascada todas las
 *   tablas dependientes (onDelete: Cascade en schema.prisma), incluidas las sesiones
 *   (AuthSession) → los refresh tokens quedan revocados.
 * - Revocación de los access tokens emitidos (revokeAllUserSessions, SEC-44).
 * - Purga en Redis de sesiones, planes cacheados, cuota de IA y caché de perfil.
 * Los backups de la BD conservan los datos hasta su rotación (política documentada aparte).
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body || {};

    if (typeof password !== 'string' || password.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'Se requiere la contraseña actual para eliminar la cuenta', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password_hash: true } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const passwordOk = user.password_hash ? await comparePassword(password, user.password_hash) : false;
    if (!passwordOk) {
      logger.warn(`[user] Reautenticación fallida al eliminar cuenta: ${userId} (ip ${req.ip})`);
      return sendError(res, 'INVALID_CREDENTIALS', 'Contraseña incorrecta', 401);
    }

    const sessionIds = await prisma.$transaction(async (tx) => {
      const sessions = await tx.authSession.findMany({ where: { user_id: userId }, select: { id: true } });
      await tx.user.delete({ where: { id: userId } });
      return sessions.map((s) => s.id);
    });

    // Revoca los access tokens ya emitidos (SA-13: si no, seguirían valiendo hasta expirar).
    // La marca de revocación (auth:revoked:user:*) no la borra la purga posterior.
    await revokeAllUserSessions(userId);

    const currentSession = req.user && req.user.sessionId;
    if (currentSession && !sessionIds.includes(currentSession)) sessionIds.push(currentSession);
    await purgeUserFromRedis(userId, sessionIds);

    logger.info(`[user] Cuenta eliminada permanentemente: ${userId}`);
    return sendSuccess(res, {}, 'Account deleted permanently');
  } catch (err) {
    next(err);
  }
};

// ─── GET /user/me/export — Acceso y portabilidad (RGPD Art. 15/20) ──

/**
 * Modelos con `user_id` y la sección del export en la que aparecen. Un test
 * compara esta lista con schema.prisma y falla si se añade un modelo con
 * `user_id` sin exportarlo (o sin declararlo excluido).
 */
const EXPORTED_USER_MODELS = {
  Profile: 'profile',
  LifestyleProfile: 'lifestyle',
  TrainingPreferences: 'training_preferences',
  NutritionPreferences: 'nutrition_preferences',
  HealthCondition: 'health_conditions',
  FoodRestriction: 'food_restrictions',
  MotivationProfile: 'motivation',
  OnboardingAnswer: 'onboarding_answers',
  Plan: 'plans',
  TrainingSession: 'training_sessions',
  Meal: 'meals',
  ProgressLog: 'progress_logs',
  DailyLog: 'daily_logs',
  AuthSession: 'sessions',
  TokenUsageLog: 'ai_usage',
};

/**
 * Modelos con `user_id` excluidos a propósito: solo contienen secretos de un solo
 * uso (hashes de OTP y tokens de reset), que no se entregan.
 */
const EXCLUDED_USER_MODELS = ['VerificationCode', 'PasswordResetToken'];

// Campos internos que no se incluyen en ningún registro exportado
const INTERNAL_FIELDS = ['user_id'];

function stripInternal(record) {
  if (!record || typeof record !== 'object') return record;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (!INTERNAL_FIELDS.includes(k)) out[k] = v;
  }
  return out;
}

const stripAll = (records) => (records || []).map(stripInternal);

/**
 * Exporta todos los datos personales del usuario en JSON (descargable).
 * SEC-49 (SA-20): incluye comidas, sesiones de entrenamiento, respuestas de onboarding,
 * consentimiento, teléfono, sesiones (fecha/IP/dispositivo), planes y uso de IA.
 * Nunca incluye secretos: hash de contraseña, refresh tokens, OTP ni tokens de reset.
 */
const exportData = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const byUser = { where: { user_id: userId } };

    const [
      user,
      profile,
      lifestyle,
      trainingPrefs,
      nutritionPrefs,
      healthConditions,
      foodRestrictions,
      motivation,
      onboardingAnswers,
      plans,
      trainingSessions,
      meals,
      progressLogs,
      dailyLogs,
      sessions,
      tokenUsage,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          phone_number: true,
          email_verified: true,
          phone_verified: true,
          status: true,
          created_at: true,
          updated_at: true,
          health_consent_given_at: true,
          health_consent_version: true,
        },
      }),
      prisma.profile.findUnique(byUser),
      prisma.lifestyleProfile.findUnique(byUser),
      prisma.trainingPreferences.findUnique(byUser),
      prisma.nutritionPreferences.findUnique(byUser),
      prisma.healthCondition.findMany(byUser),
      prisma.foodRestriction.findMany(byUser),
      prisma.motivationProfile.findUnique(byUser),
      prisma.onboardingAnswer.findMany({ ...byUser, orderBy: { created_at: 'asc' } }),
      prisma.plan.findMany({
        ...byUser,
        select: {
          id: true, type: true, start_date: true, end_date: true, status: true,
          generated_by_ai: true, ai_model_version: true, ai_prompt_used: true,
          created_at: true, updated_at: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.trainingSession.findMany({
        ...byUser,
        include: { session_exercises: { include: { exercise: { select: { name: true } } } } },
        orderBy: { scheduled_date: 'asc' },
      }),
      prisma.meal.findMany({
        ...byUser,
        include: { meal_foods: { include: { food: { select: { name: true, brand: true } } } } },
        orderBy: { scheduled_date: 'asc' },
      }),
      prisma.progressLog.findMany({ ...byUser, orderBy: { log_date: 'asc' } }),
      prisma.dailyLog.findMany({ ...byUser, orderBy: { log_date: 'asc' } }),
      prisma.authSession.findMany({
        ...byUser,
        // Sin refresh_token: es un secreto de sesión
        select: { id: true, device_info: true, ip_address: true, created_at: true, last_used_at: true, expires_at: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.tokenUsageLog.findMany({
        ...byUser,
        select: { request_type: true, input_tokens: true, output_tokens: true, model_version: true, created_at: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        phone_number: user.phone_number ?? null,
        email_verified: user.email_verified ?? null,
        phone_verified: user.phone_verified ?? null,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at ?? null,
      },
      consent: {
        health_consent_given_at: user.health_consent_given_at ?? null,
        health_consent_version: user.health_consent_version ?? null,
      },
      profile: stripInternal(profile) || null,
      lifestyle: stripInternal(lifestyle) || null,
      training_preferences: stripInternal(trainingPrefs) || null,
      nutrition_preferences: stripInternal(nutritionPrefs) || null,
      health_conditions: stripAll(healthConditions),
      food_restrictions: stripAll(foodRestrictions),
      motivation: stripInternal(motivation) || null,
      onboarding_answers: stripAll(onboardingAnswers),
      plans: stripAll(plans),
      training_sessions: stripAll(trainingSessions),
      meals: stripAll(meals),
      progress_logs: stripAll(progressLogs),
      daily_logs: stripAll(dailyLogs),
      sessions: stripAll(sessions),
      ai_usage: stripAll(tokenUsage),
      // Art. 15.1.c: destinatarios / encargados del tratamiento
      recipients: [
        { name: 'Anthropic', purpose: 'Generación de planes personalizados con IA (datos de perfil, preferencias y salud)' },
        { name: 'Railway', purpose: 'Alojamiento de la aplicación, base de datos y caché' },
        { name: 'Proveedor SMTP', purpose: 'Envío de correos de verificación y recuperación de contraseña' },
      ],
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
    const consent = await consentService.getConsentState(prisma, userId);

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
      // SEC-47: estado del consentimiento art. 9 (lo usa la pantalla de privacidad de la app)
      health_consent: {
        valid: consent.valid,
        given_at: consent.user?.health_consent_given_at ?? null,
      },
    }, 'Perfil del usuario');
  } catch (err) { next(err); }
};

module.exports = {
  deleteAccount,
  exportData,
  getProfile,
  // Exportados para tests
  EXPORTED_USER_MODELS,
  EXCLUDED_USER_MODELS,
  purgeUserFromRedis,
};
