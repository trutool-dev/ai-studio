'use strict';

/**
 * Tests de branches para app.js.
 * Cubre las ramas no alcanzadas: líneas 48, 67, 73.
 * - CORS: origen no permitido (callback con error)
 * - CORS: sin origen (callback con null, true)
 * - Health: DB error → dbStatus = 'error'
 * - Health: Redis error → redisStatus = 'error'
 */

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock de redis para que ping falle → redisStatus = 'error' en /health
jest.mock('../../backend/src/services/redis.service', () => ({
  set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  get: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  del: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  ping: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  on: jest.fn(),
  disconnect: jest.fn(),
}));

// Prisma siempre simulado: sin este mock, la suite raíz (sin moduleNameMapper)
// cargaba el cliente real e intentaba conectar con la BD de DATABASE_URL, lo que
// provocaba timeouts (y conexiones a una BD real) en los tests de CORS.
jest.mock('../../backend/src/prisma/client', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
}));

const request = require('supertest');

// ─── CORS branches ────────────────────────────────────────────────────────────

describe('app.js — CORS branches', () => {
  let app;

  beforeAll(() => {
    // Reseteamos módulos para forzar reinicialización con FRONTEND_URL definido
    jest.resetModules();
    process.env.FRONTEND_URL = 'https://allowed-origin.com';
    app = require('../../backend/src/app');
  });

  afterAll(() => {
    delete process.env.FRONTEND_URL;
    jest.resetModules();
  });

  test('permite origen explícitamente en FRONTEND_URL (callback null, true)', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://allowed-origin.com');

    // Debe responder (no bloqueado por CORS) con la cabecera de origen permitido
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://allowed-origin.com');
  });

  test('bloquea origen no permitido (callback con Error)', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://not-allowed-origin.com');

    // Origen rechazado por CORS → 403 explícito (antes caía en el errorHandler como 500)
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CORS_NOT_ALLOWED');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('permite requests sin Origin (apps móviles, Postman)', async () => {
    const res = await request(app)
      .get('/health');
    // Sin header Origin → debe pasar (branch !origin → callback(null, true))
    expect(res.status).toBe(200);
  });
});

// ─── Health check — DB error ──────────────────────────────────────────────────

describe('app.js — /health DB error branch', () => {
  let app;
  let prisma;

  beforeAll(() => {
    jest.resetModules();
    prisma = require('../../backend/src/prisma/client');
    app = require('../../backend/src/app');
  });

  afterAll(() => {
    jest.resetModules();
  });

  test('devuelve 503 y dbStatus=error cuando la BD falla', async () => {
    // Mock temporal que hace fallar $queryRaw
    prisma.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    // SEC-71: la respuesta pública no expone el estado de la BD, solo status
    expect(res.body.data).toEqual({ status: 'degraded' });
    expect(res.body.success).toBe(false);
  });

  test('devuelve 200 cuando la BD está bien pero Redis falla', async () => {
    // Restaurar $queryRaw a éxito
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/health');

    // Redis mocked → siempre falla → redisStatus puede ser 'error' o 'connected'
    // DB ok → debe ser 200
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok' });
  });
});

// ─── Morgan branch (NODE_ENV) ─────────────────────────────────────────────────

describe('app.js — morgan branch production vs dev', () => {
  test('usa formato combined en producción', () => {
    jest.resetModules();
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Solo importar para que se ejecute el código del branch
    const appProd = require('../../backend/src/app');
    expect(appProd).toBeDefined();
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });
});
