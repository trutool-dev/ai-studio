'use strict';

/**
 * Tests de integración para logs diarios (TS-08).
 * Cubre: GET /logs/today, PUT /logs/today, GET /logs/history
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1749, tdee: 2711, target_calories: 2168 }),
  generatePlan: jest.fn().mockResolvedValue({}),
  regeneratePlan: jest.fn().mockResolvedValue({}),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
  generateFallbackPlan: jest.fn().mockReturnValue({}),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

const request = require('supertest');
const {
  app,
  createAndLoginUser,
  getAuthHeader,
  cleanupUser,
  cleanupAllTestUsers,
  teardown,
} = require('../helpers/testSetup');

const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await cleanupUser(email);
  }
  await cleanupAllTestUsers();
  await teardown();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /logs/today
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logs/today', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('crea y devuelve el log del día al primer acceso', async () => {
    const res = await request(app)
      .get('/logs/today')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('log');
    expect(res.body.data.log).toHaveProperty('id');
    expect(res.body.data.log).toHaveProperty('log_date');
  });

  test('segunda llamada devuelve el mismo log (idempotente)', async () => {
    const res1 = await request(app)
      .get('/logs/today')
      .set('Authorization', getAuthHeader(token));
    const res2 = await request(app)
      .get('/logs/today')
      .set('Authorization', getAuthHeader(token));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.data.log.id).toBe(res2.body.data.log.id);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/logs/today');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /logs/today
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /logs/today', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('actualiza agua y sueño correctamente', async () => {
    const res = await request(app)
      .put('/logs/today')
      .set('Authorization', getAuthHeader(token))
      .send({ water_ml: 2000, sleep_hours: 8 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('log');
    expect(res.body.data.log.water_ml).toBe(2000);
    expect(parseFloat(res.body.data.log.sleep_hours)).toBe(8);
  });

  test('actualiza energía, pasos y ánimo', async () => {
    const res = await request(app)
      .put('/logs/today')
      .set('Authorization', getAuthHeader(token))
      .send({ energy_level: 4, steps: 8500, mood: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.log.energy_level).toBe(4);
    expect(res.body.data.log.steps).toBe(8500);
    expect(res.body.data.log.mood).toBe(4);
  });

  test('actualización parcial no borra campos previos', async () => {
    // Primero establecer water_ml
    await request(app)
      .put('/logs/today')
      .set('Authorization', getAuthHeader(token))
      .send({ water_ml: 1500 });

    // Luego actualizar solo steps
    const res = await request(app)
      .put('/logs/today')
      .set('Authorization', getAuthHeader(token))
      .send({ steps: 10000 });

    expect(res.status).toBe(200);
    expect(res.body.data.log.steps).toBe(10000);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app)
      .put('/logs/today')
      .send({ water_ml: 1000 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /logs/history
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /logs/history', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('devuelve array vacío si no hay historial', async () => {
    const res = await request(app)
      .get('/logs/history')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.data).toHaveProperty('days_requested');
  });

  test('acepta parámetro days', async () => {
    const res = await request(app)
      .get('/logs/history?days=7')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.days_requested).toBe(7);
  });

  test('limita days a 365 como máximo', async () => {
    const res = await request(app)
      .get('/logs/history?days=9999')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.days_requested).toBe(365);
  });

  test('incluye averages cuando hay datos con valores', async () => {
    // Primero crear un log con datos mediante PUT
    await request(app)
      .put('/logs/today')
      .set('Authorization', getAuthHeader(token))
      .send({ water_ml: 2000, sleep_hours: 7, energy_level: 4, steps: 6000 });

    const res = await request(app)
      .get('/logs/history?days=30')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('averages');
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/logs/history');
    expect(res.status).toBe(401);
  });

  test('aislamiento: solo devuelve logs del usuario autenticado', async () => {
    const otherUser = await createAndLoginUser();
    createdEmails.push(otherUser.email);

    const res = await request(app)
      .get('/logs/history')
      .set('Authorization', getAuthHeader(otherUser.access_token));

    // El otro usuario no tiene logs de este test
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });
});
