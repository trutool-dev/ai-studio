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
const prisma = require('./prisma/client');
const redis = require('./services/redis.service');

const app = express();

// Seguridad y utilidades

// Helmet con CSP explícita y X-Frame-Options DENY (RGPD / hardening)
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
app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.FRONTEND_URL || '').split(',').filter(Boolean);
    if (!origin || allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────
// Health check (BE-10)
// ─────────────────────────────────────────────────────────────

// Diagnóstico temporal de API key (solo staging/dev)
app.get('/health/ai', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false });
  const keySet = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0, 10) + '...' : 'NOT SET';
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      system: 'Responde solo "OK".',
      messages: [{ role: 'user', content: 'ping' }],
    });
    return res.json({ success: true, key_set: keySet, key_prefix: keyPrefix, model_response: r.content[0].text });
  } catch (err) {
    return res.json({ success: false, key_set: keySet, key_prefix: keyPrefix, error: err.message, status: err.status });
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

// Rate limiting global para todas las rutas autenticadas (SEC-06)
app.use('/onboarding', apiLimiter);
app.use('/plans', apiLimiter);
app.use('/training', apiLimiter);
app.use('/nutrition', apiLimiter);
app.use('/progress', apiLimiter);
app.use('/logs', apiLimiter);
app.use('/foods', apiLimiter);
app.use('/user', apiLimiter);
app.use('/exercises', apiLimiter);

app.use('/auth', authRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/plans', plansRoutes);
app.use('/training', trainingRoutes);
app.use('/nutrition', nutritionRoutes);
app.use('/progress', progressRoutes);
app.use('/logs', logsRoutes);
app.use('/foods', foodsRoutes);
app.use('/user', userRoutes);
app.use('/exercises', exercisesRoutes);

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
