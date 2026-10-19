'use strict';

/**
 * SEC-39 (SA-15 + JB-08): /health/ai deshabilitado por defecto, token obligatorio,
 * comparación en tiempo constante, rate limit propio y sin filtrar errores del SDK.
 * SEC-71 (VUL-2026-017 / B-02): /health público mínimo; detalle solo con ADMIN_TOKEN.
 *
 * El SDK de Anthropic está simulado: nunca se hacen llamadas reales.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

const mockCreate = jest.fn();
// Ruta explícita: es el mismo archivo que resuelve `require('@anthropic-ai/sdk')` desde backend/src
jest.mock('../../backend/node_modules/@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: mockCreate },
})));

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

const mockPing = jest.fn();
jest.mock('../../backend/src/services/redis.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  ping: (...args) => mockPing(...args),
  on: jest.fn(),
}));

const mockQueryRaw = jest.fn();
jest.mock('../../backend/src/prisma/client', () => ({
  $queryRaw: (...args) => mockQueryRaw(...args),
}));

const request = require('supertest');
const express = require('../../backend/node_modules/express');
const { createLimiter } = require('../../backend/src/middleware/platformRateLimit.middleware');

const ADMIN = 'a'.repeat(40);
const ENV_KEYS = ['ENABLE_DEV_ENDPOINTS', 'ADMIN_TOKEN', 'ANTHROPIC_API_KEY'];
const saved = {};

let app;
beforeAll(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  jest.isolateModules(() => { app = require('../../backend/src/app'); });
});
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  process.env.NODE_ENV = 'test';
});

function enableAi() {
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_DEV_ENDPOINTS = 'true';
  process.env.ADMIN_TOKEN = ADMIN;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
}

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.NODE_ENV = 'test';
  mockCreate.mockReset();
  mockPing.mockReset().mockResolvedValue('PONG');
  mockQueryRaw.mockReset().mockResolvedValue([{ 1: 1 }]);
});

// ─────────────────────────────────────────────────────────────────────────────
// /health/ai
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health/ai — deshabilitado (404) salvo configuración explícita', () => {
  test('sin ENABLE_DEV_ENDPOINTS → 404 y sin llamar al SDK', async () => {
    process.env.ADMIN_TOKEN = ADMIN;
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('ENABLE_DEV_ENDPOINTS distinto de "true" → 404', async () => {
    enableAi();
    process.env.ENABLE_DEV_ENDPOINTS = '1';
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(404);
  });

  test('sin ADMIN_TOKEN definido → 404 (antes quedaba abierto)', async () => {
    enableAi();
    delete process.env.ADMIN_TOKEN;
    const res = await request(app).get('/health/ai');
    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('ADMIN_TOKEN demasiado corto → 404', async () => {
    enableAi();
    process.env.ADMIN_TOKEN = 'short';
    const res = await request(app).get('/health/ai').set('X-Admin-Token', 'short');
    expect(res.status).toBe(404);
  });

  test.each(['production', 'staging ', 'prod', 'Production', ''])('NODE_ENV=%p fuera de la allowlist → 404', async (env) => {
    enableAi();
    process.env.NODE_ENV = env;
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('NODE_ENV=staging está permitido', async () => {
    enableAi();
    process.env.NODE_ENV = 'staging';
    mockCreate.mockResolvedValue({ content: [{ text: 'OK' }] });
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(200);
  });
});

describe('GET /health/ai — habilitado', () => {
  beforeEach(enableAi);

  test('sin cabecera X-Admin-Token → 401 sin llamar al SDK', async () => {
    const res = await request(app).get('/health/ai');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('token incorrecto (misma longitud) → 401', async () => {
    const res = await request(app).get('/health/ai').set('X-Admin-Token', 'b'.repeat(40));
    expect(res.status).toBe(401);
  });

  test('token incorrecto (prefijo del correcto) → 401', async () => {
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN.slice(0, 39));
    expect(res.status).toBe(401);
  });

  test('token correcto y SDK OK → 200 sin eco de la respuesta del modelo', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'OK' }] });
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ key_set: true, ai: 'ok' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('error del SDK → 503 genérico sin err.message ni status del proveedor', async () => {
    const sdkErr = Object.assign(new Error('invalid x-api-key: sk-ant-secret-detail'), { status: 401 });
    mockCreate.mockRejectedValue(sdkErr);
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI_UNAVAILABLE');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('invalid x-api-key');
    expect(raw).not.toContain('sk-ant');
    expect(res.body).not.toHaveProperty('status');
  });

  test('error del SDK sin status → 503', async () => {
    mockCreate.mockRejectedValue(new Error('network'));
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.status).toBe(503);
  });

  test('key_set=false si no hay ANTHROPIC_API_KEY', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockCreate.mockResolvedValue({ content: [{ text: 'OK' }] });
    const res = await request(app).get('/health/ai').set('X-Admin-Token', ADMIN);
    expect(res.body.data.key_set).toBe(false);
  });
});

describe('aiHealthLimiter — límite estricto', () => {
  test('el limitador (5/h por IP) devuelve 429 al superarlo', async () => {
    const mini = express();
    mini.use(createLimiter({ windowMs: 60 * 60 * 1000, max: 5, code: 'RATE_LIMIT_EXCEEDED', message: 'x', skipInTest: false }));
    mini.get('/', (_req, res) => res.json({ ok: true }));
    for (let i = 0; i < 5; i++) expect((await request(mini).get('/')).status).toBe(200);
    expect((await request(mini).get('/')).status).toBe(429);
  });

  test('aiHealthLimiter y healthLimiter se exportan como middlewares', () => {
    const limiters = require('../../backend/src/middleware/platformRateLimit.middleware');
    expect(typeof limiters.aiHealthLimiter).toBe('function');
    expect(typeof limiters.healthLimiter).toBe('function');
    expect(typeof limiters.sensitiveActionLimiter).toBe('function');
  });
});
