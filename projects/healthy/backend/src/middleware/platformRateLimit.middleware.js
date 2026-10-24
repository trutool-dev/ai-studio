/**
 * Limitadores de la "plataforma" (app.js): healthchecks y limitador por IP
 * previo a la autenticación.
 *
 * - SEC-32 (SA-06/JB-07): `preAuthIpLimiter` va DELANTE de `authenticate` en las
 *   rutas autenticadas (protege frente a ráfagas anónimas o con tokens inválidos);
 *   el `apiLimiter` por usuario (rateLimiter.middleware.js) va DESPUÉS de
 *   `authenticate`, para que su keyGenerator use `req.user.userId`.
 * - SEC-39 (SA-15/JB-08): `aiHealthLimiter`, límite estricto para /health/ai.
 * - SEC-71 (B-02): `healthLimiter`, límite ligero para /health (el healthcheck de
 *   Railway/Docker hace ~2 peticiones/min, muy por debajo del límite).
 *
 * Las claves usan `req.ip`, que es la IP real del cliente solo si `trust proxy`
 * está bien configurado en app.js (TRUST_PROXY).
 *
 * En NODE_ENV=test los limitadores se saltan (igual que rateLimiter.middleware.js),
 * salvo que se creen con `createLimiter(..., { skipInTest: false })` en los tests.
 */

const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response.util');

/**
 * Crea un limitador por IP con respuesta en el formato estándar de la API.
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {string} opts.code     código de error devuelto en 429
 * @param {string} opts.message  mensaje devuelto en 429
 * @param {boolean} [opts.skipInTest=true]
 */
function createLimiter({ windowMs, max, code, message, skipInTest = true }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    skip: () => skipInTest && process.env.NODE_ENV === 'test',
    handler: (_req, res) => sendError(res, code, message, 429),
  });
}

// 300 peticiones / 15 min por IP antes de autenticar. Es más alto que el límite
// por usuario (100 / 15 min) para no penalizar a varios usuarios tras un mismo NAT.
const preAuthIpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Demasiadas peticiones desde esta IP. Inténtalo más tarde.',
});

// 60 / min por IP para /health
const healthLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Demasiadas peticiones. Inténtalo más tarde.',
});

// 5 / hora por IP para /health/ai (cada llamada consume tokens reales de Anthropic)
const aiHealthLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Demasiadas peticiones. Inténtalo más tarde.',
});

// SEC-48: acciones sensibles con reautenticación (borrado de cuenta): 5 / 15 min.
// Clave por usuario autenticado (se monta después de `authenticate`) con fallback a IP,
// para frenar la fuerza bruta de la contraseña con un access token robado.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.userId) || req.ip,
  skip: () => process.env.NODE_ENV === 'test',
  handler: (_req, res) => sendError(res, 'TOO_MANY_REQUESTS', 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.', 429),
});

module.exports = {
  createLimiter,
  preAuthIpLimiter,
  healthLimiter,
  aiHealthLimiter,
  sensitiveActionLimiter,
};
