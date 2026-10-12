const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');

// SEC-22: JWT TTL verificado en auth.controller.js (generateAccessToken usa expiresIn: '15m') — no aplica aquí

// En modo test, los rate limiters son no-op para evitar 429 en tests
if (process.env.NODE_ENV === 'test') {
  const noOp = (_req, _res, next) => next();
  module.exports = {
    authRateLimiter: noOp,
    apiLimiter: noOp,
    planRegenerateLimiter: noOp,
    registrationLimiter: noOp,   // SEC-05
    planGenerationLimiter: noOp, // SEC-06
  };
} else {
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 'TOO_MANY_REQUESTS', 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.', 429),
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
    handler: (_req, res) => sendError(res, 'RATE_LIMIT_EXCEEDED', 'Has superado el límite de peticiones. Por favor espera 15 minutos.', 429),
  });

  const planRegenerateLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
    handler: (_req, res) => sendError(res, 'PLAN_REGEN_LIMIT', 'Máximo 3 regeneraciones de plan por día', 429),
  });

  // SEC-05: máx 3 registros por IP por hora (aplicar en POST /auth/register en auth.routes.js)
  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3,                    // máx 3 cuentas por IP por hora
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    handler: (_req, res) => sendError(res, 'REGISTRATION_LIMIT', 'Demasiados registros desde esta IP. Inténtalo más tarde.', 429),
  });

  // SEC-06: máx 1 generación de plan nuevo por usuario/día (aplicar en POST /onboarding/complete en onboarding.routes.js)
  const planGenerationLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 horas
    max: 1,                          // máx 1 plan nuevo por usuario/día
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || req.ip,
    handler: (_req, res) => sendError(res, 'PLAN_GENERATION_LIMIT', 'Ya has generado un plan hoy. Usa /plans/regenerate para actualizarlo.', 429),
    skip: (req) => process.env.NODE_ENV === 'test',
  });

  module.exports = { authRateLimiter, apiLimiter, planRegenerateLimiter, registrationLimiter, planGenerationLimiter };
}
