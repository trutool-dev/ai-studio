/**
 * Controlador de autenticación (BE-01).
 * Gestiona: register, verify-email, set-password, login,
 *           forgot-password, reset-password, logout, refresh, me, resend-code
 */

const crypto = require('crypto');
const { sendSuccess, sendError } = require('../utils/response.util');
const { hashPassword, comparePassword, generateVerificationCode } = require('../utils/crypto.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const { signAccessToken, revokeSession, revokeAllUserSessions } = require('../middleware/auth.middleware');
// Se accede vía objeto de módulo (no desestructurado) para que los tests puedan espiar los envíos
const emailService = require('../services/email.service');

// ─── constantes OTP (SEC-27 / SEC-31) ────────────────────────

const OTP_TTL_MINUTES = 15;
// SEC-31: intentos máximos por código (cada intento, correcto o no, consume uno)
const OTP_MAX_ATTEMPTS = 5;
const OTP_TYPE_VERIFY = 'email_verification';
const OTP_TYPE_SETUP = 'password_setup';

const MSG_INVALID_CODE = 'Código de verificación inválido';
const MSG_CODE_EXPIRED = 'El código ha expirado. Solicita uno nuevo.';
const MSG_CODE_MAX_ATTEMPTS = 'Demasiados intentos. Solicita un nuevo código.';

// ─── helpers OTP ─────────────────────────────────────────────

/**
 * Clave del HMAC de los OTP. Un OTP de 6 dígitos tiene poca entropía, así que
 * un SHA-256 simple se invertiría por fuerza bruta: se usa HMAC con un secreto
 * de servidor (OTP_HASH_SECRET, o JWT_SECRET si no está definido).
 */
function getOtpHashSecret() {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('OTP_HASH_SECRET/JWT_SECRET no configurado');
  return secret;
}

/** HMAC-SHA256 (hex) de un OTP ligado a usuario y tipo. */
function hashOtp(userId, type, code) {
  return crypto.createHmac('sha256', getOtpHashSecret())
    .update(`${userId}:${type}:${String(code)}`)
    .digest('hex');
}

/** Comparación en tiempo constante de dos strings (false si difieren en longitud). */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * SEC-31: valida un OTP contra el registro pendiente y lo consume si es correcto.
 * - Cada intento incrementa `attempts` de forma atómica ANTES de comparar, de modo
 *   que las peticiones en paralelo también cuentan.
 * - Al llegar a OTP_MAX_ATTEMPTS el código queda inutilizable.
 * - El consumo es condicional (`used_at: null`) para que un código no sirva dos veces.
 * @returns {Promise<'ok'|'invalid'|'expired'|'max_attempts'>}
 */
async function checkAndConsumeOtp(record, userId, type, code) {
  if (!record) return 'invalid';
  if ((record.attempts || 0) >= OTP_MAX_ATTEMPTS) return 'max_attempts';
  if (new Date() > new Date(record.expires_at)) return 'expired';

  const updated = await prisma.verificationCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
  });
  const attempts = Number(updated?.attempts ?? (record.attempts || 0) + 1);
  if (attempts > OTP_MAX_ATTEMPTS) return 'max_attempts';

  if (!safeEqual(hashOtp(userId, type, code), record.code)) {
    return attempts >= OTP_MAX_ATTEMPTS ? 'max_attempts' : 'invalid';
  }

  const consumed = await prisma.verificationCode.updateMany({
    where: { id: record.id, used_at: null },
    data: { used_at: new Date() },
  });
  return consumed.count === 1 ? 'ok' : 'invalid';
}

/** Traduce el resultado de checkAndConsumeOtp a una respuesta 400. */
function sendOtpError(res, result) {
  if (result === 'expired') return sendError(res, 'CODE_EXPIRED', MSG_CODE_EXPIRED, 400);
  if (result === 'max_attempts') return sendError(res, 'CODE_MAX_ATTEMPTS', MSG_CODE_MAX_ATTEMPTS, 400);
  return sendError(res, 'INVALID_CODE', MSG_INVALID_CODE, 400);
}

/** Busca el último código pendiente de un tipo para el usuario. */
function findPendingCode(userId, type) {
  return prisma.verificationCode.findFirst({
    where: { user_id: userId, type, used_at: null },
    orderBy: { created_at: 'desc' },
  });
}

/** Invalida los códigos pendientes de un tipo (al reenviar o al emitir uno nuevo). */
function invalidatePendingCodes(userId, type) {
  return prisma.verificationCode.updateMany({
    where: { user_id: userId, type, used_at: null },
    data: { used_at: new Date() },
  });
}

/**
 * Genera un OTP nuevo para verificación de email, invalida los anteriores
 * (SA-05: nunca hay varios OTP válidos a la vez) y guarda solo su HMAC.
 * @returns {Promise<string>} el OTP en claro (solo para enviarlo por email)
 */
async function issueVerificationCode(user) {
  await invalidatePendingCodes(user.id, OTP_TYPE_VERIFY);
  const code = generateVerificationCode();
  await prisma.verificationCode.create({
    data: {
      user_id: user.id,
      email: user.email,
      code: hashOtp(user.id, OTP_TYPE_VERIFY, code),
      type: OTP_TYPE_VERIFY,
      expires_at: getOtpExpiry(),
    },
  });
  return code;
}

// ─── helpers JWT / tokens ────────────────────────────────────

// SEC-44: HS256 fijado al firmar (y algorithms: ['HS256'] al verificar en auth.middleware)
function generateAccessToken(userId, email, sessionId) {
  return signAccessToken({ userId, email, sessionId }, process.env.JWT_EXPIRES_IN || '15m');
}

// SEC-45: tokens opacos de 32 bytes aleatorios; en BD solo se guarda su SHA-256
// (suficiente para secretos de alta entropía; bcrypt no aporta nada aquí).
function generateRandomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateRefreshToken() {
  return generateRandomToken();
}

/** SHA-256 (hex) de un token de alta entropía (refresh / reset). */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

// SEC-45: el enlace de recuperación caduca en 1 hora (antes 24 h)
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function getRefreshExpiry() {
  const days = parseInt((process.env.JWT_REFRESH_EXPIRES_IN || '30d').replace('d', ''), 10) || 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function getOtpExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OTP_TTL_MINUTES);
  return d;
}

/**
 * Crea una sesión (AuthSession) y devuelve el payload de respuesta de login.
 * Reutilizado por login y set-password.
 */
async function createSession(user, req) {
  const refreshToken = generateRefreshToken();
  // El id de la primera fila es también el family_id (sessionId estable en los JWT)
  const sessionId = crypto.randomUUID();
  await prisma.authSession.create({
    data: {
      id: sessionId,
      family_id: sessionId,
      user_id: user.id,
      refresh_token: hashToken(refreshToken),
      device_info: req.headers['user-agent'] || null,
      ip_address: req.ip,
      expires_at: getRefreshExpiry(),
    },
  });
  // (La antigua caché `session:<id>` en Redis nunca se leía; la revocación de access
  //  tokens la gestiona auth.middleware — SEC-44.)

  return {
    access_token: generateAccessToken(user.id, user.email, sessionId),
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 900,
  };
}

const MSG_REGISTER = 'Revisa tu email para continuar con el registro.';

// Hash bcrypt de un valor aleatorio, calculado una vez, para comparaciones "en vacío" (SEC-60)
let dummyHashPromise = null;
function getDummyPasswordHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHashPromise;
}

/** Versión vigente de la política de consentimiento (HEALTH_CONSENT_VERSION, por defecto '1.0'). */
function getHealthConsentVersion() {
  return process.env.HEALTH_CONSENT_VERSION || '1.0';
}

// ─── POST /auth/register ──────────────────────────────────────

/** POST /auth/register */
const register = async (req, res, next) => {
  try {
    const { email, phone_number, birthdate, health_consent } = req.body;

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // SEC-60 (SA-25): misma respuesta que un registro nuevo. El aviso llega solo al buzón:
      // registro a medias → nuevo código (permite retomarlo); cuenta completa → email informativo.
      if (!existing.password_hash) {
        const code = await issueVerificationCode(existing);
        await emailService.sendVerificationEmail(email, code);
      } else {
        await emailService.sendAccountExistsEmail(email);
      }
      logger.info(`[auth] Registro sobre cuenta existente: ${existing.id}`);
      return sendSuccess(res, { email }, MSG_REGISTER, 201);
    }

    // SEC-33 (SA-07): consentimiento de salud (RGPD Art. 9) solo con un `true` booleano explícito.
    // La fecha y la versión las fija el servidor; `health_consent_given_at` del cliente se ignora.
    const consentData = health_consent === true
      ? { health_consent_given_at: new Date(), health_consent_version: getHealthConsentVersion() }
      : {};

    const user = await prisma.user.create({
      data: {
        email,
        phone_number: phone_number || null,
        password_hash: '',
        status: 'pending_verification',
        email_verified: false,
        ...consentData,
      },
    });

    const code = await issueVerificationCode({ id: user.id, email });
    await emailService.sendVerificationEmail(email, code);
    logger.info(`[auth] Usuario registrado: ${user.id}`);
    // SEC-60: no se devuelve user_id (distinguiría cuentas nuevas de existentes)
    return sendSuccess(res, { email }, MSG_REGISTER, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/verify-email — body { email, code }
 * SEC-31: busca el último código pendiente del usuario (no por valor) y lo
 * compara en tiempo constante, contando cada intento.
 * SEC-27: si la cuenta aún no tiene contraseña, emite una prueba de posesión
 * de un solo uso (`password_setup`, 15 min, ligada al usuario) cuyo secreto es
 * el mismo OTP que el usuario acaba de introducir; set-password la exige.
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendOtpError(res, 'invalid');

    const verification = await findPendingCode(user.id, OTP_TYPE_VERIFY);
    const result = await checkAndConsumeOtp(verification, user.id, OTP_TYPE_VERIFY, code);
    if (result !== 'ok') {
      logger.warn(`[auth] Verificación de email fallida (${result}): ${user.id}`);
      return sendOtpError(res, result);
    }

    await prisma.user.update({ where: { id: user.id }, data: { email_verified: true } });

    if (!user.password_hash) {
      await invalidatePendingCodes(user.id, OTP_TYPE_SETUP);
      await prisma.verificationCode.create({
        data: {
          user_id: user.id,
          email: user.email,
          code: hashOtp(user.id, OTP_TYPE_SETUP, code),
          type: OTP_TYPE_SETUP,
          expires_at: getOtpExpiry(),
        },
      });
    }

    logger.info(`[auth] Email verificado: ${user.id}`);
    return sendSuccess(res, { user_id: user.id }, 'Email verificado. Ahora puedes crear tu contraseña.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/set-password — body { email, code, password }
 * SEC-27 (SA-03): exige la prueba de posesión emitida por verify-email (el OTP
 * verificado), de un solo uso, ligada al usuario y caducable (15 min). Solo vale
 * para cuentas SIN contraseña: para cambiarla hay que usar forgot/reset-password.
 * Devuelve una sesión (mismo formato que login) para que la app continúe al onboarding.
 */
const setPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Respuesta uniforme: no distinguimos usuario inexistente / no verificado / ya con contraseña
    if (!user || !user.email_verified || user.password_hash) {
      logger.warn('[auth] set-password rechazado: cuenta no elegible');
      return sendOtpError(res, 'invalid');
    }

    const setup = await findPendingCode(user.id, OTP_TYPE_SETUP);
    const result = await checkAndConsumeOtp(setup, user.id, OTP_TYPE_SETUP, code);
    if (result !== 'ok') {
      logger.warn(`[auth] set-password con prueba de posesión inválida (${result}): ${user.id}`);
      return sendOtpError(res, result);
    }

    const password_hash = await hashPassword(password);
    // Actualización condicional: si otra petición fijó la contraseña entretanto, no se sobrescribe
    const updated = await prisma.user.updateMany({
      where: { id: user.id, password_hash: '' },
      data: { password_hash, status: 'active' },
    });
    if (updated.count !== 1) return sendOtpError(res, 'invalid');

    const tokens = await createSession({ id: user.id, email: user.email }, req);
    logger.info(`[auth] Contraseña establecida: ${user.id}`);
    return sendSuccess(res, {
      ...tokens,
      user: { id: user.id, email: user.email, status: 'active', has_plan: false },
    }, 'Contraseña establecida. Ya puedes iniciar sesión.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/login */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) {
      // SEC-60: bcrypt "en vacío" para igualar el tiempo de respuesta con el de un usuario real
      await comparePassword(String(password || ''), await getDummyPasswordHash());
      logger.warn('[auth] Login fallido: cuenta inexistente o sin contraseña');
      return sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      logger.warn(`[auth] Login fallido: ${user.id}`);
      return sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
    }
    // SEC-60: el estado de la cuenta solo se revela tras demostrar la contraseña
    if (user.status !== 'active') return sendError(res, 'ACCOUNT_INACTIVE', 'Cuenta no activa', 403);

    const tokens = await createSession(user, req);
    const activePlan = await prisma.plan.findFirst({ where: { user_id: user.id, status: 'active' } });
    logger.info(`[auth] Login exitoso: ${user.id}`);
    return sendSuccess(res, {
      ...tokens,
      user: { id: user.id, email: user.email, status: user.status, has_plan: !!activePlan },
    }, 'Sesión iniciada');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/resend-code */
const resendCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Solo tiene sentido para cuentas sin contraseña (registro a medias); respuesta uniforme
    if (user && !user.password_hash) {
      const code = await issueVerificationCode(user);
      await emailService.sendVerificationEmail(email, code);
    }
    return sendSuccess(res, {}, 'Si el email existe, recibirás un nuevo código.');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/forgot-password — body { email }
 * SEC-45: token aleatorio de 32 bytes (solo se guarda su SHA-256), válido 1 h;
 * al pedir uno nuevo se invalidan los anteriores pendientes.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      await prisma.passwordResetToken.updateMany({
        where: { user_id: user.id, used_at: null },
        data: { used_at: new Date() },
      });
      const token = generateRandomToken();
      await prisma.passwordResetToken.create({
        data: {
          user_id: user.id,
          token: hashToken(token),
          expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          ip_address: req.ip,
        },
      });
      await emailService.sendPasswordResetEmail(email, token);
    }

    return sendSuccess(res, {}, 'Si existe una cuenta con ese email, recibirás instrucciones de recuperación.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/reset-password — body { token, password } */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const record = await prisma.passwordResetToken.findUnique({ where: { token: hashToken(token) } });
    if (!record) return sendError(res, 'INVALID_TOKEN', 'Token inválido', 400);
    if (record.used_at) return sendError(res, 'TOKEN_USED', 'Este enlace ya fue utilizado', 400);
    if (new Date() > new Date(record.expires_at)) return sendError(res, 'TOKEN_EXPIRED', 'El enlace ha expirado', 400);

    // SEC-72 (VUL-2026-015): la nueva contraseña no puede ser la actual (el enlace no se consume)
    const owner = await prisma.user.findUnique({ where: { id: record.user_id } });
    if (owner && owner.password_hash && await comparePassword(password, owner.password_hash)) {
      return sendError(res, 'PASSWORD_REUSED', 'La nueva contraseña debe ser distinta de la actual', 400);
    }

    // Consumo condicional: el mismo enlace no sirve dos veces aunque lleguen peticiones en paralelo
    const consumed = await prisma.passwordResetToken.updateMany({
      where: { id: record.id, used_at: null },
      data: { used_at: new Date() },
    });
    if (consumed.count !== 1) return sendError(res, 'TOKEN_USED', 'Este enlace ya fue utilizado', 400);

    const password_hash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
      prisma.authSession.deleteMany({ where: { user_id: record.user_id } }),
    ]);
    // SEC-44: los access tokens ya emitidos dejan de valer
    await revokeAllUserSessions(record.user_id);

    logger.info(`[auth] Contraseña restablecida: ${record.user_id}`);
    return sendSuccess(res, {}, 'Contraseña restablecida. Ya puedes iniciar sesión.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/logout — cierra la sesión (toda su familia de refresh tokens) */
const logout = async (req, res, next) => {
  try {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await prisma.authSession.deleteMany({
        where: { OR: [{ id: sessionId }, { family_id: sessionId }] },
      });
      // SEC-44: el access token de esta sesión deja de valer inmediatamente
      await revokeSession(sessionId);
    }
    return sendSuccess(res, {}, 'Sesión cerrada');
  } catch (err) {
    next(err);
  }
};

/**
 * Reutilización detectada: revoca todas las sesiones del usuario (refresh y access).
 */
async function revokeAllSessionsForReuse(userId) {
  await prisma.authSession.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  await revokeAllUserSessions(userId);
}

/**
 * POST /auth/refresh — body { refresh_token }
 * SEC-45: rotación por familias. Cada uso revoca la fila actual y crea otra con el
 * mismo family_id. Si se presenta un token ya revocado (robado y usado antes por el
 * atacante o por la víctima) se revocan TODAS las sesiones del usuario.
 * Respuesta: { access_token, refresh_token, token_type, expires_in } (sin cambios).
 */
const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const session = await prisma.authSession.findUnique({
      where: { refresh_token: hashToken(refresh_token) },
      include: { user: true },
    });

    if (!session) return sendError(res, 'INVALID_TOKEN', 'Refresh token inválido', 401);

    if (session.revoked_at) {
      logger.warn(`[auth] Reutilización de refresh token revocado: se revocan todas las sesiones de ${session.user_id}`);
      await revokeAllSessionsForReuse(session.user_id);
      return sendError(res, 'INVALID_TOKEN', 'Refresh token inválido', 401);
    }
    if (new Date() > new Date(session.expires_at)) {
      await prisma.authSession.delete({ where: { id: session.id } });
      return sendError(res, 'TOKEN_EXPIRED', 'Sesión expirada. Inicia sesión de nuevo.', 401);
    }
    if (!session.user || session.user.status !== 'active') return sendError(res, 'ACCOUNT_INACTIVE', 'Cuenta inactiva', 403);

    // Revocación condicional: si otra petición concurrente ya rotó este token, esta pierde
    // (401) sin disparar la revocación masiva (no es una reutilización posterior).
    const now = new Date();
    const rotated = await prisma.authSession.updateMany({
      where: { id: session.id, revoked_at: null },
      data: { revoked_at: now, last_used_at: now },
    });
    if (rotated.count !== 1) return sendError(res, 'INVALID_TOKEN', 'Refresh token inválido', 401);

    const familyId = session.family_id || session.id;
    const newRefreshToken = generateRefreshToken();
    await prisma.authSession.create({
      data: {
        family_id: familyId,
        user_id: session.user_id,
        refresh_token: hashToken(newRefreshToken),
        device_info: req.headers['user-agent'] || session.device_info || null,
        ip_address: req.ip,
        expires_at: getRefreshExpiry(),
      },
    });

    const accessToken = generateAccessToken(session.user.id, session.user.email, familyId);
    return sendSuccess(res, { access_token: accessToken, refresh_token: newRefreshToken, token_type: 'Bearer', expires_in: 900 }, 'Token renovado');
  } catch (err) {
    next(err);
  }
};

/** GET /auth/me */
const me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true, email: true, phone_number: true,
        email_verified: true, phone_verified: true,
        status: true, created_at: true,
        profile: { select: { name: true, birthdate: true, gender: true, weight_kg: true, height_cm: true, goal: true, activity_level: true } },
      },
    });

    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
    const activePlan = await prisma.plan.findFirst({ where: { user_id: req.user.userId, status: 'active' } });
    return sendSuccess(res, { user: { ...user, has_plan: !!activePlan } }, 'Datos del usuario');
  } catch (err) {
    next(err);
  }
};

// ─── Endpoints de desarrollo (SEC-30 / SA-04) ────────────────
//
// Deshabilitados por defecto (fail-closed). Solo responden si se cumplen TODAS:
//   - ENABLE_DEV_ENDPOINTS === 'true'
//   - NODE_ENV en DEV_ENDPOINTS_ENVS (development | staging | test; nunca production)
//   - DEV_ENDPOINTS_TOKEN (o, en su defecto, ADMIN_TOKEN) con >= 32 caracteres
//   - cabecera X-Dev-Token (o X-Admin-Token) igual al token, en tiempo constante
//   - email dentro de DEV_ENDPOINTS_EMAIL_DOMAINS (por defecto solo test.healthy.com)
// En cualquier otro caso responden 404, igual que una ruta inexistente.

const DEV_ENDPOINTS_ENVS = ['development', 'staging', 'test'];
const MIN_DEV_TOKEN_LENGTH = 32;
const DEFAULT_DEV_EMAIL_DOMAINS = 'test.healthy.com';

function getDevEndpointsToken() {
  return process.env.DEV_ENDPOINTS_TOKEN || process.env.ADMIN_TOKEN || '';
}

/** true solo si la bandera, el entorno y el token cumplen la allowlist. */
function devEndpointsEnabled() {
  return process.env.ENABLE_DEV_ENDPOINTS === 'true'
    && DEV_ENDPOINTS_ENVS.includes(process.env.NODE_ENV)
    && getDevEndpointsToken().length >= MIN_DEV_TOKEN_LENGTH;
}

/** Compara dos secretos en tiempo constante (vía SHA-256 para igualar longitudes). */
function safeEqualSecret(provided, expected) {
  if (typeof provided !== 'string' || !provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function isDevEmailAllowed(email) {
  const domains = (process.env.DEV_ENDPOINTS_EMAIL_DOMAINS || DEFAULT_DEV_EMAIL_DOMAINS)
    .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = String(email || '').toLowerCase().split('@')[1] || '';
  return domains.includes(domain);
}

const sendDevNotFound = (res) => sendError(res, 'NOT_FOUND', 'Ruta no encontrada', 404);

/** Middleware de guarda para /auth/dev/*: 404 si no está habilitado o el token no coincide. */
const requireDevEndpoints = (req, res, next) => {
  if (!devEndpointsEnabled()) return sendDevNotFound(res);
  const provided = req.headers['x-dev-token'] || req.headers['x-admin-token'];
  if (!safeEqualSecret(provided, getDevEndpointsToken())) {
    logger.warn('[auth/dev] Acceso a endpoint dev con token ausente o inválido');
    return sendDevNotFound(res);
  }
  return next();
};

/**
 * POST /auth/dev/code — body { email }. Emite un OTP nuevo (invalida los anteriores)
 * y lo devuelve; los OTP se guardan con HMAC y no se pueden leer de la BD.
 */
const getDevCode = async (req, res, next) => {
  // Defensa en profundidad: la guarda también se comprueba aquí
  if (!devEndpointsEnabled()) return sendDevNotFound(res);
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'VALIDATION_ERROR', 'email requerido', 400);
    if (!isDevEmailAllowed(email)) return sendError(res, 'FORBIDDEN', 'Email fuera del dominio de pruebas', 403);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
    const code = await issueVerificationCode(user);
    logger.info(`[auth/dev] OTP emitido por endpoint dev: ${user.id}`);
    return sendSuccess(res, { code }, 'Código (solo staging/dev)');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/dev/auto-verify — body { email, password }. Verifica el email y fija
 * la contraseña en un solo paso. Ya no hay contraseña por defecto.
 */
const devAutoVerify = async (req, res, next) => {
  if (!devEndpointsEnabled()) return sendDevNotFound(res);
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 'VALIDATION_ERROR', 'email y password requeridos', 400);
    if (!isDevEmailAllowed(email)) return sendError(res, 'FORBIDDEN', 'Email fuera del dominio de pruebas', 403);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    await invalidatePendingCodes(user.id, OTP_TYPE_VERIFY);
    await invalidatePendingCodes(user.id, OTP_TYPE_SETUP);

    const password_hash = await hashPassword(password);
    await prisma.user.update({
      where: { id: user.id },
      data: { email_verified: true, password_hash, status: 'active' },
    });

    logger.info(`[auth/dev] Auto-verificación: ${user.id}`);
    return sendSuccess(res, { user_id: user.id, email }, 'Usuario verificado y contraseña establecida (solo staging/dev)');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register, verifyEmail, resendCode, setPassword, login, forgotPassword, resetPassword,
  logout, refresh, me, getDevCode, devAutoVerify, requireDevEndpoints,
};
