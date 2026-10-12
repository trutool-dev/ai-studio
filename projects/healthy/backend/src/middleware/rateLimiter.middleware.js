const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');

// En modo test, los rate limiters son no-op para evitar 429 en tests
if (process.env.NODE_ENV === 'test') {
  const noOp = (_req, _res, next) => next();
  module.exports = { authRateLimiter: noOp, apiLimiter: noOp, planRegenerateLimiter: noOp };
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

  module.exports = { authRateLimiter, apiLimiter, planRegenerateLimiter };
}
