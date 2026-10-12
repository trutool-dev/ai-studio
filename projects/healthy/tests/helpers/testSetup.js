/**
 * Helper compartido para tests de integración del backend Healthy.
 * Proporciona: inicialización de la app, limpieza de BD, helpers de autenticación.
 *
 * Uso:
 *   const { app, prisma, getAuthHeader, createTestUser, cleanupUser } = require('../helpers/testSetup');
 */

'use strict';

// Aseguramos que estamos en modo test antes de importar la app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
// Si hay TEST_DATABASE_URL, la usamos; si no, usamos DATABASE_URL de entorno
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (process.env.TEST_REDIS_URL) {
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
}

const request = require('supertest');
const app = require('../../backend/src/app');
const prisma = require('../../backend/src/prisma/client');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE AUTENTICACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera un email único para tests (evita colisiones entre ejecuciones)
 */
function uniqueEmail(prefix = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.healthy.com`;
}

/**
 * Completa el flujo de registro de un usuario de test:
 * register → leer OTP de BD → verify-email → set-password
 * Devuelve el userId y el email.
 */
async function createVerifiedUser({ email, password = 'Test1234!' } = {}) {
  const userEmail = email || uniqueEmail('verified');

  // 1. Registro
  await request(app)
    .post('/auth/register')
    .send({ email: userEmail });

  // 2. Obtener el OTP directamente de la BD (sin necesitar email real)
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const verification = await prisma.verificationCode.findFirst({
    where: { user_id: user.id, type: 'email_verification', used_at: null },
    orderBy: { created_at: 'desc' },
  });

  // 3. Verificar email
  await request(app)
    .post('/auth/verify-email')
    .send({ email: userEmail, code: verification.code });

  // 4. Establecer contraseña
  await request(app)
    .post('/auth/set-password')
    .send({ email: userEmail, password });

  return { userId: user.id, email: userEmail, password };
}

/**
 * Hace login y devuelve el access_token para usar en Authorization header.
 */
async function loginUser({ email, password = 'Test1234!' }) {
  const res = await request(app)
    .post('/auth/login')
    .send({ email, password });

  if (!res.body.success) {
    throw new Error(`Login fallido para ${email}: ${JSON.stringify(res.body)}`);
  }

  return {
    access_token: res.body.data.access_token,
    refresh_token: res.body.data.refresh_token,
    user: res.body.data.user,
  };
}

/**
 * Devuelve el header Authorization Bearer para un access_token.
 */
function getAuthHeader(token) {
  return `Bearer ${token}`;
}

/**
 * Crea un usuario verificado y devuelve también sus tokens.
 */
async function createAndLoginUser(opts = {}) {
  const user = await createVerifiedUser(opts);
  const tokens = await loginUser(user);
  return { ...user, ...tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE LIMPIEZA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina un usuario y todos sus datos (cascada).
 * Los modelos tienen onDelete: Cascade, así que basta con deleteMany en User.
 */
async function cleanupUser(email) {
  try {
    await prisma.user.deleteMany({ where: { email } });
  } catch {
    // Si no existe, ignoramos el error
  }
}

/**
 * Elimina todos los usuarios de test (email que acabe en @test.healthy.com).
 * Útil en afterAll() para limpiar toda la BD de tests.
 */
async function cleanupAllTestUsers() {
  try {
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@test.healthy.com' } },
    });
  } catch {
    // Ignorar
  }
}

/**
 * Desconecta Prisma y Redis al final de la suite.
 */
async function teardown() {
  const redis = require('../../backend/src/services/redis.service');
  await prisma.$disconnect();
  try { redis.disconnect(); } catch { /* ignorar */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DE ONBOARDING PARA TESTS
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_PROFILE = {
  name: 'Test User',
  birthdate: '1995-06-15',
  gender: 'male',
  weight_kg: 80,
  height_cm: 175,
  body_type: 'mesomorph',
  activity_level: 'moderate',
  goal: 'lose_weight',
};

const ONBOARDING_LIFESTYLE = {
  profession: 'Developer',
  work_type: 'office',
  work_hours_per_day: 8,
  stress_level: 3,
  sleep_hours_usual: 7,
  sleep_quality: 'good',
  alcohol_consumption: 'occasional',
  smoker: false,
  daily_water_glasses: 8,
};

const ONBOARDING_TRAINING = {
  available_days_per_week: 3,
  max_session_duration_minutes: 60,
  preferred_training_time: 'morning',
  has_gym_access: true,
  experience_level: 'beginner',
};

const ONBOARDING_NUTRITION = {
  diet_type: 'omnivore',
  meals_per_day_preferred: 3,
  cooks_at_home: true,
  eats_out_frequency: 'sometimes',
  monthly_food_budget_range: 'medium',
};

const ONBOARDING_MOTIVATION = {
  main_motivation: 'health',
  previous_attempts: false,
  tracking_preference: 'basic',
  has_support_network: true,
};

module.exports = {
  app,
  prisma,
  uniqueEmail,
  createVerifiedUser,
  loginUser,
  getAuthHeader,
  createAndLoginUser,
  cleanupUser,
  cleanupAllTestUsers,
  teardown,
  ONBOARDING_PROFILE,
  ONBOARDING_LIFESTYLE,
  ONBOARDING_TRAINING,
  ONBOARDING_NUTRITION,
  ONBOARDING_MOTIVATION,
};
