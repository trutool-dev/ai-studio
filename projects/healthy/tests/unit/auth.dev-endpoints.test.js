'use strict';

/**
 * SEC-30 (SA-04): endpoints /auth/dev/* bloqueados por defecto (fail-closed).
 * Se monta auth.routes en una app Express mínima y se prueban todas las ramas
 * de la guarda: bandera, NODE_ENV, token configurado, cabecera, dominio de email.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));
jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountExistsEmail: jest.fn().mockResolvedValue(true),
}));

const express = require('../../backend/node_modules/express');
const request = require('supertest');
const prisma = require('../../backend/src/prisma/client');
const authRoutes = require('../../backend/src/routes/auth.routes');
const ctrl = require('../../backend/src/controllers/auth.controller');

const TOKEN = 'dev-token-for-tests-0123456789-abcdef';
const ENV_KEYS = ['ENABLE_DEV_ENDPOINTS', 'NODE_ENV', 'DEV_ENDPOINTS_TOKEN', 'ADMIN_TOKEN', 'DEV_ENDPOINTS_EMAIL_DOMAINS'];
const savedEnv = {};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use((_req, res) => res.status(404).json({ success: false, error: 'NOT_FOUND' }));
  return app;
}

function enable(overrides = {}) {
  process.env.ENABLE_DEV_ENDPOINTS = 'true';
  process.env.NODE_ENV = 'test';
  process.env.DEV_ENDPOINTS_TOKEN = TOKEN;
  delete process.env.ADMIN_TOKEN;
  delete process.env.DEV_ENDPOINTS_EMAIL_DOMAINS;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

async function seedUser(email) {
  return prisma.user.create({ data: { email, password_hash: '', status: 'pending_verification', email_verified: false } });
}

beforeAll(() => { for (const k of ENV_KEYS) savedEnv[k] = process.env[k]; });
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
beforeEach(() => prisma._reset());

describe('SEC-30 — guarda de /auth/dev/*', () => {
  const app = buildApp();
  const email = 'dev@test.healthy.com';

  test('sin ENABLE_DEV_ENDPOINTS → 404 (fail-closed por defecto)', async () => {
    enable({ ENABLE_DEV_ENDPOINTS: undefined });
    await seedUser(email);
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', TOKEN).send({ email });
    expect(r.status).toBe(404);
  });

  test.each(['production', 'prod', 'Production', '', undefined])('NODE_ENV=%p fuera de la allowlist → 404', async (env) => {
    enable({ NODE_ENV: env });
    await seedUser(email);
    const r = await request(app).post('/auth/dev/auto-verify').set('X-Dev-Token', TOKEN).send({ email, password: 'Whatever123!' });
    expect(r.status).toBe(404);
    expect(prisma._db.user[0].password_hash).toBe('');
  });

  test('sin token configurado → 404 aunque la bandera esté activa', async () => {
    enable({ DEV_ENDPOINTS_TOKEN: undefined });
    const r = await request(app).post('/auth/dev/code').send({ email });
    expect(r.status).toBe(404);
  });

  test('token configurado demasiado corto → 404', async () => {
    enable({ DEV_ENDPOINTS_TOKEN: 'short' });
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', 'short').send({ email });
    expect(r.status).toBe(404);
  });

  test('sin cabecera de token → 404', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).post('/auth/dev/code').send({ email });
    expect(r.status).toBe(404);
  });

  test('token incorrecto → 404', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', `${TOKEN}x`).send({ email });
    expect(r.status).toBe(404);
  });

  test('GET /auth/dev/code con email en query ya no existe → 404', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).get(`/auth/dev/code?email=${encodeURIComponent(email)}`).set('X-Dev-Token', TOKEN);
    expect(r.status).toBe(404);
  });

  test('habilitado + token correcto → devuelve un OTP nuevo que verifica el email', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', TOKEN).send({ email });
    expect(r.status).toBe(200);
    expect(r.body.data.code).toMatch(/^\d{6}$/);
    const v = await request(app).post('/auth/verify-email').send({ email, code: r.body.data.code });
    expect(v.status).toBe(200);
  });

  test('ADMIN_TOKEN sirve como token de respaldo (cabecera X-Admin-Token)', async () => {
    enable({ DEV_ENDPOINTS_TOKEN: undefined, ADMIN_TOKEN: TOKEN });
    await seedUser(email);
    const r = await request(app).post('/auth/dev/code').set('X-Admin-Token', TOKEN).send({ email });
    expect(r.status).toBe(200);
  });

  test('email fuera del dominio de pruebas → 403', async () => {
    enable();
    await seedUser('real.person@gmail.com');
    const r = await request(app).post('/auth/dev/auto-verify').set('X-Dev-Token', TOKEN)
      .send({ email: 'real.person@gmail.com', password: 'Whatever123!' });
    expect(r.status).toBe(403);
    expect(prisma._db.user[0].password_hash).toBe('');
  });

  test('DEV_ENDPOINTS_EMAIL_DOMAINS amplía la lista de dominios permitidos', async () => {
    enable({ DEV_ENDPOINTS_EMAIL_DOMAINS: 'example.org, test.healthy.com' });
    await seedUser('qa@example.org');
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', TOKEN).send({ email: 'qa@example.org' });
    expect(r.status).toBe(200);
  });

  test('auto-verify exige password (ya no hay contraseña por defecto)', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).post('/auth/dev/auto-verify').set('X-Dev-Token', TOKEN).send({ email });
    expect(r.status).toBe(400);
    expect(prisma._db.user[0].password_hash).toBe('');
  });

  test('auto-verify habilitado verifica y fija contraseña', async () => {
    enable();
    await seedUser(email);
    const r = await request(app).post('/auth/dev/auto-verify').set('X-Dev-Token', TOKEN)
      .send({ email, password: 'Whatever123!' });
    expect(r.status).toBe(200);
    expect(prisma._db.user[0]).toEqual(expect.objectContaining({ email_verified: true, status: 'active' }));
    const login = await request(app).post('/auth/login').send({ email, password: 'Whatever123!' });
    expect(login.status).toBe(200);
  });

  test('usuario inexistente (habilitado) → 404 de usuario', async () => {
    enable();
    const r = await request(app).post('/auth/dev/code').set('X-Dev-Token', TOKEN).send({ email: 'ghost@test.healthy.com' });
    expect(r.status).toBe(404);
    const r2 = await request(app).post('/auth/dev/auto-verify').set('X-Dev-Token', TOKEN)
      .send({ email: 'ghost@test.healthy.com', password: 'Whatever123!' });
    expect(r2.status).toBe(404);
  });
});

describe('SEC-30 — defensa en profundidad en los controladores', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  test('los controladores devuelven 404 aunque se monten sin la guarda', async () => {
    enable({ ENABLE_DEV_ENDPOINTS: 'false' });
    for (const fn of [ctrl.getDevCode, ctrl.devAutoVerify]) {
      const res = makeRes();
      await fn({ body: { email: 'dev@test.healthy.com', password: 'x' }, headers: {} }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });

  test('sin email o password en el body → 400 (validación interna)', async () => {
    enable();
    const res1 = makeRes();
    await ctrl.getDevCode({ body: {}, headers: {} }, res1, jest.fn());
    expect(res1.status).toHaveBeenCalledWith(400);
    const res2 = makeRes();
    await ctrl.devAutoVerify({ body: { email: 'dev@test.healthy.com' }, headers: {} }, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test('errores de BD se delegan a next', async () => {
    enable();
    const original = prisma.user.findUnique;
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB down'));
    try {
      const next1 = jest.fn();
      await ctrl.getDevCode({ body: { email: 'dev@test.healthy.com' }, headers: {} }, makeRes(), next1);
      expect(next1).toHaveBeenCalledWith(expect.any(Error));
      const next2 = jest.fn();
      await ctrl.devAutoVerify({ body: { email: 'dev@test.healthy.com', password: 'Whatever123!' }, headers: {} }, makeRes(), next2);
      expect(next2).toHaveBeenCalledWith(expect.any(Error));
    } finally {
      prisma.user.findUnique = original;
    }
  });
});
