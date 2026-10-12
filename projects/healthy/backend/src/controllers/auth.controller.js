/**
 * Controlador de autenticación (BE-01).
 * Gestiona: register, verify-email, set-password, login,
 *           forgot-password, reset-password, logout, refresh, me, resend-code
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const { hashPassword, comparePassword, generateVerificationCode, generateSecureToken } = require('../utils/crypto.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email.service');
const redis = require('../services/redis.service');

// ─── helpers JWT / tokens ────────────────────────────────────

function generateAccessToken(userId, email, sessionId) {
  return jwt.sign(
    { userId, email, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  );
}

function generateRefreshToken() {
  const { v4: uuidv4 } = require('uuid');
  return `${uuidv4()}.${Date.now()}`;
}

function getRefreshExpiry() {
  const days = parseInt((process.env.JWT_REFRESH_EXPIRES_IN || '30d').replace('d', ''), 10) || 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function getOtpExpiry() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d;
}

// ─── POST /auth/register ──────────────────────────────────────

/** POST /auth/register */
const register = async (req, res, next) => {
  try {
    const { email, phone_number, birthdate, health_consent_given_at } = req.body;

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
      return sendError(res, 'EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese email', 409);
    }

    // Preparar datos de consentimiento de salud (RGPD Art. 9)
    const consentData = health_consent_given_at
      ? { health_consent_given_at: new Date(health_consent_given_at), health_consent_version: '1.0' }
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

    const code = generateVerificationCode();
    await prisma.verificationCode.create({
      data: {
        user_id: user.id,
        email,
        code,
        type: 'email_verification',
        expires_at: getOtpExpiry(),
      },
    });

    await sendVerificationEmail(email, code);
    logger.info(`[auth] Usuario registrado: ${user.id}`);
    return sendSuccess(res, { user_id: user.id, email }, 'Cuenta creada. Revisa tu email para verificarla.', 201);
  } catch (err) {
    next(err);
  }
};

/** POST /auth/verify-email */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    const verification = await prisma.verificationCode.findFirst({
      where: { user_id: user.id, code, type: 'email_verification', used_at: null },
      orderBy: { created_at: 'desc' },
    });

    if (!verification) return sendError(res, 'INVALID_CODE', 'Código de verificación inválido', 400);
    if (verification.attempts >= 3) return sendError(res, 'CODE_MAX_ATTEMPTS', 'Demasiados intentos. Solicita un nuevo código.', 400);
    if (new Date() > new Date(verification.expires_at)) return sendError(res, 'CODE_EXPIRED', 'El código ha expirado', 400);

    await prisma.verificationCode.update({ where: { id: verification.id }, data: { used_at: new Date() } });
    await prisma.user.update({ where: { id: user.id }, data: { email_verified: true } });

    logger.info(`[auth] Email verificado: ${user.id}`);
    return sendSuccess(res, { user_id: user.id }, 'Email verificado. Ahora puedes crear tu contraseña.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/set-password */
const setPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
    if (!user.email_verified) return sendError(res, 'EMAIL_NOT_VERIFIED', 'Verifica tu email primero', 400);

    const password_hash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { password_hash, status: 'active' } });

    return sendSuccess(res, {}, 'Contraseña establecida. Ya puedes iniciar sesión.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/login */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password_hash) return sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
    if (user.status !== 'active') return sendError(res, 'ACCOUNT_INACTIVE', 'Cuenta no activa', 403);

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      logger.warn(`[auth] Login fallido: ${email}`);
      return sendError(res, 'INVALID_CREDENTIALS', 'Credenciales incorrectas', 401);
    }

    const refreshToken = generateRefreshToken();
    const session = await prisma.authSession.create({
      data: {
        user_id: user.id,
        refresh_token: refreshToken,
        device_info: req.headers['user-agent'] || null,
        ip_address: req.ip,
        expires_at: getRefreshExpiry(),
      },
    });

    const accessToken = generateAccessToken(user.id, user.email, session.id);
    // Redis es caché — si no está disponible (ej. en tests locales), el login sigue funcionando
    try {
      await redis.set(`session:${session.id}`, JSON.stringify({ user_id: user.id, email: user.email }), 'EX', 2592000);
    } catch (redisErr) {
      logger.warn(`[auth] Redis no disponible, sesión no cacheada: ${redisErr.message}`);
    }

    const activePlan = await prisma.plan.findFirst({ where: { user_id: user.id, status: 'active' } });
    logger.info(`[auth] Login exitoso: ${user.id}`);
    return sendSuccess(res, {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 900,
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
    if (!user) return sendSuccess(res, {}, 'Si el email existe, recibirás un nuevo código.');

    const code = generateVerificationCode();
    await prisma.verificationCode.create({
      data: { user_id: user.id, email, code, type: 'email_verification', expires_at: getOtpExpiry() },
    });
    await sendVerificationEmail(email, code);
    return sendSuccess(res, {}, 'Si el email existe, recibirás un nuevo código.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/forgot-password */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = await prisma.passwordResetToken.create({
        data: {
          user_id: user.id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          ip_address: req.ip,
        },
      });
      await sendPasswordResetEmail(email, resetToken.token);
    }

    return sendSuccess(res, {}, 'Si existe una cuenta con ese email, recibirás instrucciones de recuperación.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/reset-password */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record) return sendError(res, 'INVALID_TOKEN', 'Token inválido', 400);
    if (record.used_at) return sendError(res, 'TOKEN_USED', 'Este enlace ya fue utilizado', 400);
    if (new Date() > new Date(record.expires_at)) return sendError(res, 'TOKEN_EXPIRED', 'El enlace ha expirado', 400);

    const password_hash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.user_id }, data: { password_hash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { used_at: new Date() } }),
      prisma.authSession.deleteMany({ where: { user_id: record.user_id } }),
    ]);

    return sendSuccess(res, {}, 'Contraseña restablecida. Ya puedes iniciar sesión.');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/logout */
const logout = async (req, res, next) => {
  try {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await prisma.authSession.deleteMany({ where: { id: sessionId } });
      try {
        await redis.del(`session:${sessionId}`);
      } catch (redisErr) {
        logger.warn(`[auth] Redis no disponible en logout: ${redisErr.message}`);
      }
    }
    return sendSuccess(res, {}, 'Sesión cerrada');
  } catch (err) {
    next(err);
  }
};

/** POST /auth/refresh */
const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const session = await prisma.authSession.findUnique({
      where: { refresh_token },
      include: { user: true },
    });

    if (!session) return sendError(res, 'INVALID_TOKEN', 'Refresh token inválido', 401);
    if (new Date() > new Date(session.expires_at)) {
      await prisma.authSession.delete({ where: { id: session.id } });
      return sendError(res, 'TOKEN_EXPIRED', 'Sesión expirada. Inicia sesión de nuevo.', 401);
    }
    if (session.user.status !== 'active') return sendError(res, 'ACCOUNT_INACTIVE', 'Cuenta inactiva', 403);

    const newRefreshToken = generateRefreshToken();
    await prisma.authSession.update({
      where: { id: session.id },
      data: { refresh_token: newRefreshToken, expires_at: getRefreshExpiry(), last_used_at: new Date() },
    });

    const accessToken = generateAccessToken(session.user.id, session.user.email, session.id);
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

/** GET /auth/dev/code?email=xxx — solo funciona en NODE_ENV !== production */
const getDevCode = async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false });
  }
  try {
    const { email } = req.query;
    if (!email) return sendError(res, 'VALIDATION_ERROR', 'email requerido', 400);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
    const verification = await prisma.verificationCode.findFirst({
      where: { user_id: user.id, type: 'email_verification', used_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!verification) return sendError(res, 'NOT_FOUND', 'No hay código pendiente', 404);
    return sendSuccess(res, { code: verification.code, expires_at: verification.expires_at }, 'Código (solo staging/dev)');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/dev/auto-verify — verifica email y crea contraseña en un solo paso.
 * Solo funciona en NODE_ENV !== production.
 */
const devAutoVerify = async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false });
  }
  try {
    const { email, password = 'EvalTest2026!' } = req.body;
    if (!email) return sendError(res, 'VALIDATION_ERROR', 'email requerido', 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return sendError(res, 'NOT_FOUND', 'Usuario no encontrado', 404);

    // Invalidar códigos anteriores
    await prisma.verificationCode.updateMany({
      where: { user_id: user.id, type: 'email_verification', used_at: null },
      data: { used_at: new Date() },
    });

    // Establecer contraseña y marcar email como verificado en un solo update
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

module.exports = { register, verifyEmail, resendCode, setPassword, login, forgotPassword, resetPassword, logout, refresh, me, getDevCode, devAutoVerify };
