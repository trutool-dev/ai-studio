/**
 * Tests de integración para progreso (TS-06).
 * Cubre: GET /progress, POST /progress, GET /progress/stats.
 * Verifica: flag needs_plan_regeneration, aislamiento entre usuarios.
 */

'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock de aiService para controlar shouldRegeneratePlan
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
  prisma,
  createAndLoginUser,
  getAuthHeader,
  cleanupUser,
  cleanupAllTestUsers,
  teardown,
} = require('../helpers/testSetup');

// Importar el mock para poder controlarlo por test
const aiService = require('../../backend/src/services/aiService');

const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await cleanupUser(email);
  }
  await cleanupAllTestUsers();
  await teardown();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress — Historial
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /progress', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
    userId = user.user.id;
  });

  test('devuelve lista vacía si no hay registros', async () => {
    const res = await request(app)
      .get('/progress')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('logs');
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.data.total).toBe(0);
  });

  test('devuelve los registros del usuario', async () => {
    // Insertar un registro de progreso
    await prisma.progressLog.create({
      data: {
        user_id: userId,
        log_date: new Date(),
        weight_kg: 80.5,
        notes: 'Test log',
      },
    });

    const res = await request(app)
      .get('/progress')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    expect(res.body.data.logs[0]).toHaveProperty('weight_kg');
  });

  test('acepta parámetros de paginación limit y offset', async () => {
    const res = await request(app)
      .get('/progress?limit=5&offset=0')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(5);
    expect(res.body.data.offset).toBe(0);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/progress');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /progress — Crear registro
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /progress', () => {
  let token;
  let otherToken;
  const logDate = '2026-01-15';

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;

    const otherUser = await createAndLoginUser();
    createdEmails.push(otherUser.email);
    otherToken = otherUser.access_token;
  });

  test('crea un registro de progreso correctamente', async () => {
    const res = await request(app)
      .post('/progress')
      .set('Authorization', getAuthHeader(token))
      .send({
        log_date: logDate,
        weight_kg: 79.5,
        body_fat_percentage: 18.5,
        notes: 'Buen día',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('log');
    expect(res.body.data.log).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('needs_plan_regeneration');
    expect(typeof res.body.data.needs_plan_regeneration).toBe('boolean');
  });

  test('no permite dos registros para la misma fecha', async () => {
    const res = await request(app)
      .post('/progress')
      .set('Authorization', getAuthHeader(token))
      .send({
        log_date: logDate,
        weight_kg: 79.0,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('PROGRESS_ALREADY_EXISTS');
  });

  test('un segundo usuario puede registrar para la misma fecha sin conflicto', async () => {
    const res = await request(app)
      .post('/progress')
      .set('Authorization', getAuthHeader(otherToken))
      .send({
        log_date: logDate,
        weight_kg: 70.0,
      });

    // Otro usuario puede registrar sin conflicto porque es su propio dato
    expect(res.status).toBe(201);
  });

  test('needs_plan_regeneration es false por defecto (sin estancamiento)', async () => {
    aiService.shouldRegeneratePlan.mockReturnValueOnce(false);

    const res = await request(app)
      .post('/progress')
      .set('Authorization', getAuthHeader(token))
      .send({
        log_date: '2026-02-01',
        weight_kg: 79.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.needs_plan_regeneration).toBe(false);
  });

  test('needs_plan_regeneration es true cuando hay estancamiento detectado', async () => {
    aiService.shouldRegeneratePlan.mockReturnValueOnce(true);

    const res = await request(app)
      .post('/progress')
      .set('Authorization', getAuthHeader(token))
      .send({
        log_date: '2026-03-01',
        weight_kg: 79.5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.needs_plan_regeneration).toBe(true);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app)
      .post('/progress')
      .send({ log_date: '2026-04-01', weight_kg: 80 });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /progress/stats — Estadísticas
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /progress/stats', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
    userId = user.user.id;
  });

  test('devuelve stats vacías si no hay registros', async () => {
    const res = await request(app)
      .get('/progress/stats')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.last_weight).toBeNull();
    expect(res.body.data.streak).toBe(0);
    expect(res.body.data.total_logs).toBe(0);
  });

  test('calcula stats cuando hay registros de peso', async () => {
    // Insertar registros de peso
    const dates = [
      { daysBack: 2, weight: 81.0 },
      { daysBack: 1, weight: 80.5 },
    ];

    for (const { daysBack, weight } of dates) {
      const d = new Date();
      d.setDate(d.getDate() - daysBack);
      await prisma.progressLog.create({
        data: {
          user_id: userId,
          log_date: d,
          weight_kg: weight,
        },
      });
    }

    const res = await request(app)
      .get('/progress/stats')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.last_weight).not.toBeNull();
    expect(res.body.data.total_logs).toBeGreaterThan(0);
    expect(res.body.data).toHaveProperty('total_change');
    expect(res.body.data).toHaveProperty('total_change_direction');
  });

  test('la respuesta incluye todas las propiedades esperadas', async () => {
    const res = await request(app)
      .get('/progress/stats')
      .set('Authorization', getAuthHeader(token));

    expect(res.body.data).toHaveProperty('last_weight');
    expect(res.body.data).toHaveProperty('first_weight');
    expect(res.body.data).toHaveProperty('total_change');
    expect(res.body.data).toHaveProperty('total_change_direction');
    expect(res.body.data).toHaveProperty('streak');
    expect(res.body.data).toHaveProperty('total_logs');
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/progress/stats');
    expect(res.status).toBe(401);
  });

  test('aislamiento: un usuario no ve el progreso de otro', async () => {
    const otherUser = await createAndLoginUser();
    createdEmails.push(otherUser.email);

    // Stats del otro usuario devuelve 0 registros
    const res = await request(app)
      .get('/progress/stats')
      .set('Authorization', getAuthHeader(otherUser.access_token));

    // El otro usuario tiene 0 logs (los del usuario principal son suyos)
    expect(res.status).toBe(200);
    expect(res.body.data.total_logs).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aislamiento entre usuarios
// ─────────────────────────────────────────────────────────────────────────────

describe('Aislamiento de datos entre usuarios', () => {
  let userAToken;
  let userBToken;
  let userAId;

  beforeAll(async () => {
    const userA = await createAndLoginUser();
    createdEmails.push(userA.email);
    userAToken = userA.access_token;
    userAId = userA.user.id;

    const userB = await createAndLoginUser();
    createdEmails.push(userB.email);
    userBToken = userB.access_token;

    // Crear un log de progreso para usuario A
    await prisma.progressLog.create({
      data: {
        user_id: userAId,
        log_date: new Date('2026-05-01'),
        weight_kg: 85.0,
        notes: 'Datos privados de usuario A',
      },
    });
  });

  test('usuario B no puede ver el historial de usuario A', async () => {
    // El GET /progress devuelve solo los datos del usuario autenticado
    const resB = await request(app)
      .get('/progress')
      .set('Authorization', getAuthHeader(userBToken));

    expect(resB.status).toBe(200);
    // Los logs de B no incluyen datos de A
    const userBLogs = resB.body.data.logs;
    const hasUserAData = userBLogs.some(
      (log) => log.user_id === userAId,
    );
    expect(hasUserAData).toBe(false);
  });

  test('los stats de usuario B no incluyen datos de usuario A', async () => {
    const resB = await request(app)
      .get('/progress/stats')
      .set('Authorization', getAuthHeader(userBToken));

    // Usuario B no tiene logs → total 0
    expect(resB.status).toBe(200);
    expect(resB.body.data.total_logs).toBe(0);
  });
});
