'use strict';

/**
 * SEC-32 (SA-06 + JB-07) — rate limiting de la plataforma.
 * - `trust proxy` configurable con TRUST_PROXY (por defecto 1, nunca `true`)
 * - `apiLimiter` montado DESPUÉS de `authenticate` (clave = userId)
 * - limitador por IP delante de la autenticación
 * - con trust proxy = 1 cada cliente real tiene su propio contador; sin él,
 *   todos comparten el contador de la IP del proxy (el fallo original)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn(),
  generatePlan: jest.fn(),
  regeneratePlan: jest.fn(),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
  generateFallbackPlan: jest.fn(),
}));

jest.mock('../../backend/src/services/redis.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
}));

jest.mock('../../backend/src/prisma/client', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  profile: { findUnique: jest.fn().mockResolvedValue(null) },
  trainingPreferences: { findUnique: jest.fn().mockResolvedValue(null) },
  nutritionPreferences: { findUnique: jest.fn().mockResolvedValue(null) },
}));

// apiLimiter espía: registra el req.user que ve en cada petición
const seenUsers = [];
jest.mock('../../backend/src/middleware/rateLimiter.middleware', () => {
  const noOp = (_req, _res, next) => next();
  return {
    authRateLimiter: noOp,
    registrationLimiter: noOp,
    planRegenerateLimiter: noOp,
    planGenerationLimiter: noOp,
    apiLimiter: (req, _res, next) => { seenUsers.push(req.user ? req.user.userId : null); next(); },
  };
});

// express solo está instalado en backend/ (la suite raíz no lo resuelve por nombre)
const express = require('../../backend/node_modules/express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { parseTrustProxy } = require('../../backend/src/config/env');
const { createLimiter } = require('../../backend/src/middleware/platformRateLimit.middleware');

function token(userId = 'user-rl-1') {
  return jwt.sign({ userId, email: 'rl@test.healthy.com', sessionId: 's1' }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

describe('parseTrustProxy', () => {
  test.each([
    [undefined, 1],
    ['', 1],
    ['  ', 1],
    ['1', 1],
    ['2', 2],
    ['0', 0],
    ['true', 1],
    ['loopback', 1],
    ['-1', 1],
    ['99', 1],
  ])('TRUST_PROXY=%p → %p', (value, expected) => {
    expect(parseTrustProxy(value)).toBe(expected);
  });
});

describe('app.js — trust proxy', () => {
  afterEach(() => { delete process.env.TRUST_PROXY; });

  test('por defecto confía en 1 salto (proxy de Railway)', () => {
    jest.isolateModules(() => {
      delete process.env.TRUST_PROXY;
      const app = require('../../backend/src/app');
      expect(app.get('trust proxy')).toBe(1);
    });
  });

  test('respeta TRUST_PROXY numérico', () => {
    jest.isolateModules(() => {
      process.env.TRUST_PROXY = '2';
      const app = require('../../backend/src/app');
      expect(app.get('trust proxy')).toBe(2);
    });
  });

  test('nunca acepta `true` (X-Forwarded-For falsificable)', () => {
    jest.isolateModules(() => {
      process.env.TRUST_PROXY = 'true';
      const app = require('../../backend/src/app');
      expect(app.get('trust proxy')).toBe(1);
    });
  });
});

describe('app.js — apiLimiter después de authenticate', () => {
  let app;
  beforeAll(() => {
    jest.isolateModules(() => { app = require('../../backend/src/app'); });
  });
  beforeEach(() => { seenUsers.length = 0; });

  test('el limitador por usuario recibe req.user.userId en rutas autenticadas', async () => {
    const res = await request(app).get('/user/me/profile').set('Authorization', `Bearer ${token('user-abc')}`);
    expect(res.status).toBe(404); // perfil inexistente en el mock, pero la petición llega al controlador
    expect(seenUsers).toEqual(['user-abc']);
  });

  test('sin token → 401 antes de llegar al limitador por usuario', async () => {
    const res = await request(app).get('/nutrition/meals');
    expect(res.status).toBe(401);
    expect(seenUsers).toEqual([]);
  });

  test.each(['/onboarding/start', '/plans', '/training/today', '/progress', '/logs/today', '/foods/search', '/exercises'])(
    '%s exige autenticación a nivel de app',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(seenUsers).toEqual([]);
    },
  );
});

describe('limitador por IP con trust proxy', () => {
  function buildApp(trustProxy) {
    const mini = express();
    mini.set('trust proxy', trustProxy);
    mini.use(createLimiter({ windowMs: 60_000, max: 2, code: 'RATE_LIMIT_EXCEEDED', message: 'x', skipInTest: false }));
    mini.get('/', (req, res) => res.json({ ip: req.ip }));
    return mini;
  }

  test('con trust proxy = 1, cada cliente (X-Forwarded-For) tiene su propio contador', async () => {
    const mini = buildApp(1);
    for (let i = 0; i < 2; i++) {
      const r = await request(mini).get('/').set('X-Forwarded-For', '203.0.113.10');
      expect(r.status).toBe(200);
      expect(r.body.ip).toBe('203.0.113.10');
    }
    const blocked = await request(mini).get('/').set('X-Forwarded-For', '203.0.113.10');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('RATE_LIMIT_EXCEEDED');

    // Otro cliente detrás del mismo proxy no queda bloqueado
    const other = await request(mini).get('/').set('X-Forwarded-For', '203.0.113.20');
    expect(other.status).toBe(200);
  });

  test('con trust proxy = 1, un X-Forwarded-For con varias IPs usa la añadida por el proxy (no la falsificada)', async () => {
    const mini = buildApp(1);
    const r = await request(mini).get('/').set('X-Forwarded-For', '198.51.100.99, 203.0.113.30');
    expect(r.body.ip).toBe('203.0.113.30');
  });

  test('sin trust proxy todos comparten el contador de la IP del proxy (comportamiento anterior)', async () => {
    const mini = buildApp(0);
    await request(mini).get('/').set('X-Forwarded-For', '203.0.113.1');
    await request(mini).get('/').set('X-Forwarded-For', '203.0.113.2');
    const third = await request(mini).get('/').set('X-Forwarded-For', '203.0.113.3');
    expect(third.status).toBe(429);
  });

  test('en NODE_ENV=test los limitadores de plataforma se saltan por defecto', async () => {
    const mini = express();
    mini.use(createLimiter({ windowMs: 60_000, max: 1, code: 'X', message: 'x' }));
    mini.get('/', (_req, res) => res.json({ ok: true }));
    await request(mini).get('/');
    const second = await request(mini).get('/');
    expect(second.status).toBe(200);
  });
});
