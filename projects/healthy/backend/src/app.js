const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const plansRoutes = require('./routes/plans.routes');
const trainingRoutes = require('./routes/training.routes');
const nutritionRoutes = require('./routes/nutrition.routes');
const progressRoutes = require('./routes/progress.routes');
const logsRoutes = require('./routes/logs.routes');
const foodsRoutes = require('./routes/foods.routes');
const userRoutes = require('./routes/user.routes');
const exercisesRoutes = require('./routes/exercises.routes');
const errorHandler = require('./middleware/errorHandler.middleware');
const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const { authenticate } = require('./middleware/auth.middleware');
const { preAuthIpLimiter, aiHealthLimiter } = require('./middleware/platformRateLimit.middleware');
const { parseTrustProxy } = require('./config/env');
const { sendSuccess, sendError } = require('./utils/response.util');
const { safeEqual } = require('./utils/crypto.util');
const logger = require('./utils/logger.util');
const prisma = require('./prisma/client');
const redis = require('./services/redis.service');

const app = express();

// SEC-32 (SA-06/JB-07): confiar solo en N saltos de proxy para que req.ip sea la IP
// real del cliente (clave de los rate limiters). Por defecto 1 = el proxy/edge de
// Railway. Se configura con TRUST_PROXY (entero 0-10). Nunca `true`: haría que
// X-Forwarded-For fuese falsificable y permitiría eludir los límites.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// Seguridad y utilidades

// Helmet con CSP explícita y X-Frame-Options DENY (RGPD / hardening)
// Helmet deshabilita X-Powered-By automáticamente (SEC-21)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// CORS sin fallback a '*': solo orígenes explícitamente permitidos
// Permite requests sin origin (apps móviles, Postman en desarrollo)
const CORS_REJECTED = 'CORS_NOT_ALLOWED';
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.FRONTEND_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
    if (!origin || allowed.includes(origin)) return callback(null, true);
    const err = new Error('Not allowed by CORS');
    err.code = CORS_REJECTED;
    return callback(err);
  },
  credentials: true,
}));
// Origen rechazado por CORS → 403 (antes acababa como 500 en el errorHandler)
app.use((err, _req, res, next) => {
  if (err && err.code === CORS_REJECTED) return sendError(res, 'CORS_NOT_ALLOWED', 'Origen no permitido', 403);
  return next(err);
});
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '50kb' })); // SEC-12: límite reducido de 10mb a 50kb
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────
// Health check (BE-10)
// ─────────────────────────────────────────────────────────────

// ─── /health/ai — diagnóstico de la API key de Anthropic (SEC-39 / SA-15 + JB-08) ───
// Deshabilitado por defecto (fail-closed). Solo se habilita si se cumplen TODAS:
//   - ENABLE_DEV_ENDPOINTS === 'true' (misma bandera que los endpoints dev de /auth)
//   - NODE_ENV en AI_HEALTHCHECK_ENVS (nunca production)
//   - ADMIN_TOKEN definido con al menos 32 caracteres
// Si no, responde 404 igual que una ruta inexistente. Con el endpoint habilitado:
// rate limit estricto por IP (5/h), cabecera X-Admin-Token obligatoria comparada en
// tiempo constante, y sin devolver err.message / err.status del SDK al cliente.
const AI_HEALTHCHECK_ENVS = ['development', 'test', 'staging'];
const MIN_ADMIN_TOKEN_LENGTH = 32;

function isAdminTokenConfigured() {
  const adminToken = process.env.ADMIN_TOKEN;
  return typeof adminToken === 'string' && adminToken.length >= MIN_ADMIN_TOKEN_LENGTH;
}

function hasValidAdminToken(req) {
  if (!isAdminTokenConfigured()) return false;
  return safeEqual(req.get('x-admin-token') || '', process.env.ADMIN_TOKEN);
}

function isAiHealthcheckEnabled() {
  return process.env.ENABLE_DEV_ENDPOINTS === 'true'
    && AI_HEALTHCHECK_ENVS.includes(process.env.NODE_ENV)
    && isAdminTokenConfigured();
}

const sendRouteNotFound = (res) => sendError(res, 'NOT_FOUND', 'Ruta no encontrada', 404);

app.get('/health/ai',
  (_req, res, next) => (isAiHealthcheckEnabled() ? next() : sendRouteNotFound(res)),
  aiHealthLimiter,
  async (req, res) => {
    if (!hasValidAdminToken(req)) {
      logger.warn(`[health/ai] Token de admin inválido desde ${req.ip}`);
      return sendError(res, 'UNAUTHORIZED', 'No autorizado', 401);
    }
    const keySet = !!process.env.ANTHROPIC_API_KEY;
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        system: 'Responde solo "OK".',
        messages: [{ role: 'user', content: 'ping' }],
      });
      return sendSuccess(res, { key_set: keySet, ai: 'ok' }, 'API de IA operativa');
    } catch (err) {
      // El detalle del proveedor solo va al log del servidor, nunca al cliente
      logger.warn(`[health/ai] Fallo al llamar a la API de IA (status ${err && err.status ? err.status : 'n/a'})`);
      return sendError(res, 'AI_UNAVAILABLE', 'La API de IA no está disponible', 503);
    }
  });

app.get('/health', async (_req, res) => {
  let dbStatus = 'connected';
  let redisStatus = 'connected';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = 'error';
  }

  const healthy = dbStatus === 'connected'; // Redis es caché — no bloquea el healthcheck
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      db: dbStatus,
      redis: redisStatus,
    },
    message: healthy ? 'Servidor operativo' : 'El servidor tiene problemas',
  });
});

// ─────────────────────────────────────────────────────────────
// Rutas de la API
// ─────────────────────────────────────────────────────────────

// SEC-32 (SA-06/JB-07): orden de middlewares en las rutas autenticadas:
//   1. preAuthIpLimiter → límite por IP antes de autenticar (ráfagas anónimas / tokens inválidos)
//   2. authenticate     → rellena req.user
//   3. apiLimiter       → límite por usuario (keyGenerator usa req.user.userId)
// Los routers vuelven a llamar a `authenticate` internamente (defensa en profundidad).
const authenticatedRoutes = [
  ['/onboarding', onboardingRoutes],
  ['/plans', plansRoutes],
  ['/training', trainingRoutes],
  ['/nutrition', nutritionRoutes],
  ['/progress', progressRoutes],
  ['/logs', logsRoutes],
  ['/foods', foodsRoutes],
  ['/user', userRoutes],
  ['/exercises', exercisesRoutes],
];

// Rutas públicas de autenticación: solo límite por IP (los limitadores específicos
// de login/registro/etc. están dentro de auth.routes.js)
app.use('/auth', preAuthIpLimiter, authRoutes);

for (const [path, router] of authenticatedRoutes) {
  app.use(path, preAuthIpLimiter, authenticate, apiLimiter, router);
}

// Ruta no encontrada (404)
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Ruta no encontrada`,
  });
});

// Manejo centralizado de errores
app.use(errorHandler);

module.exports = app;
