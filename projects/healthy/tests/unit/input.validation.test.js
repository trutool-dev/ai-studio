'use strict';

/**
 * SEC-52 (SA-23): validación de entrada en endpoints de escritura y query params,
 * incluida la N-1 (POST /nutrition/meals/:mealId/foods) y comprobación de IDOR.
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

const mockPrisma = {
  $queryRaw: jest.fn(),
  plan: { findFirst: jest.fn() },
  meal: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  food: { findUnique: jest.fn(), findMany: jest.fn() },
  mealFood: { create: jest.fn(), findMany: jest.fn() },
  trainingSession: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  sessionExercise: { findFirst: jest.fn(), update: jest.fn() },
  progressLog: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  dailyLog: { findMany: jest.fn() },
};
jest.mock('../../backend/src/prisma/client', () => mockPrisma);

const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  isUuid, parseIntInRange, parseDateParam, parseOptionalString,
} = require('../../backend/src/utils/query.util');
const { addFoodToMeal, getMeals } = require('../../backend/src/controllers/nutrition.controller');
const { completeSession, getSessions } = require('../../backend/src/controllers/training.controller');
const { searchFoods } = require('../../backend/src/controllers/foods.controller');

let app;
beforeAll(() => {
  jest.isolateModules(() => { app = require('../../backend/src/app'); });
});

const USER = '11111111-1111-4111-8111-111111111111';
const MEAL = '22222222-2222-4222-8222-222222222222';
const FOOD = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const EXERCISE = '55555555-5555-4555-8555-555555555555';
const auth = () => `Bearer ${jwt.sign({ userId: USER, email: 'v@test.healthy.com', sessionId: 's' }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.plan.findFirst.mockResolvedValue(null);
  mockPrisma.meal.findMany.mockResolvedValue([]);
  mockPrisma.meal.findFirst.mockResolvedValue({ id: MEAL, user_id: USER, status: 'scheduled' });
  mockPrisma.meal.update.mockImplementation(async ({ data }) => ({ id: MEAL, ...data }));
  mockPrisma.food.findUnique.mockResolvedValue({ id: FOOD, calories_per_100g: 100, protein_per_100g: 100, carbs_per_100g: 0, fat_per_100g: 0 });
  mockPrisma.mealFood.create.mockResolvedValue({});
  mockPrisma.mealFood.findMany.mockResolvedValue([]);
  mockPrisma.trainingSession.findMany.mockResolvedValue([]);
  mockPrisma.trainingSession.findFirst.mockResolvedValue({ id: SESSION, user_id: USER, status: 'scheduled' });
  mockPrisma.trainingSession.update.mockImplementation(async ({ data }) => ({ id: SESSION, ...data }));
  mockPrisma.sessionExercise.findFirst.mockResolvedValue({ id: 'se1', reps: 10 });
  mockPrisma.sessionExercise.update.mockResolvedValue({ id: 'se1' });
  mockPrisma.progressLog.findMany.mockResolvedValue([]);
  mockPrisma.progressLog.count.mockResolvedValue(0);
  mockPrisma.dailyLog.findMany.mockResolvedValue([]);
  mockPrisma.food.findMany.mockResolvedValue([]);
});

// ─── query.util ──────────────────────────────────────────────────────────────

describe('query.util', () => {
  test('isUuid', () => {
    expect(isUuid(USER)).toBe(true);
    expect(isUuid('nonexistent-id')).toBe(false);
    expect(isUuid(['x'])).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  test.each([
    [undefined, 30], ['abc', 30], ['5', 5], ['-3', 1], ['999', 100], [7, 7], [['1'], 30], [{ a: 1 }, 30], [Infinity, 30],
  ])('parseIntInRange(%p) → %p', (v, expected) => {
    expect(parseIntInRange(v, { def: 30, min: 1, max: 100 })).toBe(expected);
  });

  test('parseDateParam', () => {
    expect(parseDateParam(undefined)).toEqual({ ok: true, date: null });
    expect(parseDateParam('')).toEqual({ ok: true, date: null });
    expect(parseDateParam('2026-10-19').ok).toBe(true);
    expect(parseDateParam('2026-10-19T10:00:00Z').ok).toBe(true);
    expect(parseDateParam('2026-13-45').ok).toBe(false);
    expect(parseDateParam('mañana').ok).toBe(false);
    expect(parseDateParam(['2026-10-19']).ok).toBe(false);
  });

  test('parseOptionalString', () => {
    expect(parseOptionalString(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseOptionalString('Legs')).toEqual({ ok: true, value: 'Legs' });
    expect(parseOptionalString(['a']).ok).toBe(false);
    expect(parseOptionalString('x'.repeat(101)).ok).toBe(false);
  });
});

// ─── Nutrición (N-1) ─────────────────────────────────────────────────────────

describe('POST /nutrition/meals/:mealId/foods (N-1)', () => {
  const post = (mealId, body) => request(app).post(`/nutrition/meals/${mealId}/foods`).set('Authorization', auth()).send(body);

  test('mealId que no es UUID → 404 sin consultar la BD', async () => {
    const res = await post('not-a-uuid', { food_id: FOOD });
    expect(res.status).toBe(404);
    expect(mockPrisma.meal.findFirst).not.toHaveBeenCalled();
  });

  test.each([undefined, 'abc', 123, { not: 'x' }])('food_id=%p → 400', async (foodId) => {
    const res = await post(MEAL, { food_id: foodId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(mockPrisma.mealFood.create).not.toHaveBeenCalled();
  });

  test.each([-5, 0, 'abc', 5001, 1e12, 'NaN'])('quantity_g=%p → 400', async (q) => {
    const res = await post(MEAL, { food_id: FOOD, quantity_g: q });
    expect(res.status).toBe(400);
    expect(mockPrisma.mealFood.create).not.toHaveBeenCalled();
  });

  test('comida de otro usuario (IDOR) → 404: la consulta filtra por user_id', async () => {
    mockPrisma.meal.findFirst.mockResolvedValue(null);
    const res = await post(MEAL, { food_id: FOOD, quantity_g: 100 });
    expect(res.status).toBe(404);
    expect(mockPrisma.meal.findFirst).toHaveBeenCalledWith({ where: { id: MEAL, user_id: USER } });
    expect(mockPrisma.mealFood.create).not.toHaveBeenCalled();
  });

  test('alimento inexistente → 404', async () => {
    mockPrisma.food.findUnique.mockResolvedValue(null);
    const res = await post(MEAL, { food_id: FOOD, quantity_g: 100 });
    expect(res.status).toBe(404);
  });

  test('válido → 200 con quantity_g numérico', async () => {
    mockPrisma.mealFood.findMany.mockResolvedValue([
      { quantity_g: 250, food: { calories_per_100g: 100, protein_per_100g: 20, carbs_per_100g: 10, fat_per_100g: 5 } },
    ]);
    const res = await post(MEAL, { food_id: FOOD, quantity_g: '250' });
    expect(res.status).toBe(200);
    expect(mockPrisma.mealFood.create).toHaveBeenCalledWith({ data: { meal_id: MEAL, food_id: FOOD, quantity_g: 250 } });
    const data = mockPrisma.meal.update.mock.calls[0][0].data;
    expect(data.calories).toBe(250);
    expect(data.protein_g).toBe('50.0');
  });

  test('macros acotadas al máximo de la columna Decimal(6,2)', async () => {
    mockPrisma.mealFood.findMany.mockResolvedValue(Array.from({ length: 5 }, () => (
      { quantity_g: 5000, food: { calories_per_100g: 900, protein_per_100g: 100, carbs_per_100g: 100, fat_per_100g: 100 } }
    )));
    const res = await post(MEAL, { food_id: FOOD, quantity_g: 5000 });
    expect(res.status).toBe(200);
    const data = mockPrisma.meal.update.mock.calls[0][0].data;
    expect(parseFloat(data.protein_g)).toBeLessThanOrEqual(9999.99);
    expect(parseFloat(data.fat_g)).toBeLessThanOrEqual(9999.99);
  });

  test('defensa en el controlador (sin reglas de ruta)', async () => {
    for (const body of [{ food_id: 'x' }, { food_id: FOOD, quantity_g: -1 }, { food_id: FOOD, quantity_g: 'abc' }]) {
      const res = makeRes();
      await addFoodToMeal({ user: { userId: USER }, params: { mealId: MEAL }, body }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    }
    // quantity_g por defecto (100)
    const res = makeRes();
    await addFoodToMeal({ user: { userId: USER }, params: { mealId: MEAL }, body: { food_id: FOOD } }, res, jest.fn());
    expect(mockPrisma.mealFood.create).toHaveBeenCalledWith({ data: { meal_id: MEAL, food_id: FOOD, quantity_g: 100 } });
  });
});

describe('Nutrición — otros endpoints', () => {
  test('PUT /nutrition/meals/:id/complete con id no UUID → 404', async () => {
    const res = await request(app).put('/nutrition/meals/nonexistent-id-12345/complete').set('Authorization', auth());
    expect(res.status).toBe(404);
    expect(mockPrisma.meal.findFirst).not.toHaveBeenCalled();
  });

  test('PUT /nutrition/meals/:id/complete filtra por user_id (IDOR)', async () => {
    mockPrisma.meal.findFirst.mockResolvedValue(null);
    const res = await request(app).put(`/nutrition/meals/${MEAL}/complete`).set('Authorization', auth());
    expect(res.status).toBe(404);
    expect(mockPrisma.meal.findFirst).toHaveBeenCalledWith({ where: { id: MEAL, user_id: USER } });
  });

  test.each(['mañana', '2026-99-99', 'x'])('GET /nutrition/meals?date=%s → 400', async (d) => {
    const res = await request(app).get(`/nutrition/meals?date=${encodeURIComponent(d)}`).set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  test('GET /nutrition/meals?date=a&date=b (array) → 400', async () => {
    const res = await request(app).get('/nutrition/meals?date=2026-10-19&date=2026-10-20').set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  test('GET /nutrition/meals con fecha válida → 200', async () => {
    const res = await request(app).get('/nutrition/meals?date=2026-10-19').set('Authorization', auth());
    expect(res.status).toBe(200);
  });

  test('getMeals sin fecha usa hoy', async () => {
    const res = makeRes();
    await getMeals({ user: { userId: USER }, query: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── Entrenamiento ───────────────────────────────────────────────────────────

describe('Entrenamiento', () => {
  test('GET /training/sessions?status=invalido → 400', async () => {
    const res = await request(app).get('/training/sessions?status=hacked').set('Authorization', auth());
    expect(res.status).toBe(400);
    expect(mockPrisma.trainingSession.findMany).not.toHaveBeenCalled();
  });

  test('GET /training/sessions?status[not]=x no llega como operador a Prisma', async () => {
    const res = await request(app).get('/training/sessions?status[not]=completed').set('Authorization', auth());
    expect(res.status).toBe(200);
    const where = mockPrisma.trainingSession.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
  });

  test('GET /training/sessions?status=completed&date=2026-10-19 → 200 con filtros', async () => {
    const res = await request(app).get('/training/sessions?status=completed&date=2026-10-19').set('Authorization', auth());
    expect(res.status).toBe(200);
    const where = mockPrisma.trainingSession.findMany.mock.calls[0][0].where;
    expect(where).toEqual(expect.objectContaining({ user_id: USER, status: 'completed' }));
  });

  test('GET /training/sessions?date=invalida → 400', async () => {
    const res = await request(app).get('/training/sessions?date=ayer').set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  test('GET /training/sessions/:id no UUID → 404', async () => {
    const res = await request(app).get('/training/sessions/abc').set('Authorization', auth());
    expect(res.status).toBe(404);
  });

  test.each([
    [{ duration_minutes: 9999 }],
    [{ duration_minutes: -1 }],
    [{ duration_minutes: 'abc' }],
    [{ calories_burned: 1e9 }],
    [{ notes: 'x'.repeat(1001) }],
    [{ notes: { $gt: '' } }],
  ])('PUT /training/sessions/:id/complete con %p → 400', async (body) => {
    const res = await request(app).put(`/training/sessions/${SESSION}/complete`).set('Authorization', auth()).send(body);
    expect(res.status).toBe(400);
    expect(mockPrisma.trainingSession.update).not.toHaveBeenCalled();
  });

  test('PUT /training/sessions/:id/complete válido → 200 con enteros', async () => {
    const res = await request(app).put(`/training/sessions/${SESSION}/complete`).set('Authorization', auth())
      .send({ duration_minutes: '45', calories_burned: 300, notes: 'bien' });
    expect(res.status).toBe(200);
    const data = mockPrisma.trainingSession.update.mock.calls[0][0].data;
    expect(data.duration_minutes).toBe(45);
    expect(data.calories_burned).toBe(300);
    expect(mockPrisma.trainingSession.findFirst).toHaveBeenCalledWith({ where: { id: SESSION, user_id: USER } });
  });

  test('PUT /training/sessions/:id/complete con nulls → 200', async () => {
    const res = await request(app).put(`/training/sessions/${SESSION}/complete`).set('Authorization', auth())
      .send({ duration_minutes: null, calories_burned: null, notes: null });
    expect(res.status).toBe(200);
  });

  test('PUT /training/sessions/:id/complete no UUID → 404', async () => {
    const res = await request(app).put('/training/sessions/xyz/complete').set('Authorization', auth()).send({});
    expect(res.status).toBe(404);
  });

  test('completeSession valida también en el controlador', async () => {
    for (const body of [{ duration_minutes: 99999 }, { calories_burned: -5 }, { notes: 5 }, { notes: 'x'.repeat(1001) }]) {
      const res = makeRes();
      await completeSession({ user: { userId: USER }, params: { id: SESSION }, body }, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  test('getSessions valida status en el controlador', async () => {
    const res = makeRes();
    await getSessions({ user: { userId: USER }, query: { status: ['completed'] } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('POST .../exercises/:exerciseId/sets con ids no UUID → 404', async () => {
    const res = await request(app).post(`/training/sessions/${SESSION}/exercises/abc/sets`).set('Authorization', auth()).send({ reps: 10 });
    expect(res.status).toBe(404);
  });

  test('POST .../exercises/:exerciseId/sets con reps excesivas → 400', async () => {
    const res = await request(app).post(`/training/sessions/${SESSION}/exercises/${EXERCISE}/sets`).set('Authorization', auth()).send({ reps: 5000 });
    expect(res.status).toBe(400);
  });

  test('POST .../exercises/:exerciseId/complete válido → 200 y filtra la sesión por user_id', async () => {
    const res = await request(app).post(`/training/sessions/${SESSION}/exercises/${EXERCISE}/complete`).set('Authorization', auth()).send({ reps: 12, weight_kg: 40 });
    expect(res.status).toBe(200);
    expect(mockPrisma.trainingSession.findFirst).toHaveBeenCalledWith({ where: { id: SESSION, user_id: USER } });
  });
});

// ─── Progreso, logs y alimentos ──────────────────────────────────────────────

describe('Progreso, logs y alimentos', () => {
  test.each([
    ['limit=abc&offset=xyz', 30, 0],
    ['limit=-5&offset=-10', 1, 0],
    ['limit=1000', 100, 0],
    ['limit=5&offset=10', 5, 10],
  ])('GET /progress?%s → 200 con limit=%p offset=%p', async (qs, limit, offset) => {
    const res = await request(app).get(`/progress?${qs}`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(limit);
    expect(res.body.data.offset).toBe(offset);
  });

  test('POST /progress con notes demasiado largas → 400', async () => {
    const res = await request(app).post('/progress').set('Authorization', auth()).send({ log_date: '2026-10-19', notes: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  test('POST /progress con weight_kg desmesurado → 400', async () => {
    const res = await request(app).post('/progress').set('Authorization', auth()).send({ log_date: '2026-10-19', weight_kg: 100000 });
    expect(res.status).toBe(400);
  });

  test.each([['abc', 30], ['0', 1], ['9999', 365]])('GET /logs/history?days=%s → days_requested=%p', async (d, expected) => {
    const res = await request(app).get(`/logs/history?days=${d}`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.data.days_requested).toBe(expected);
  });

  test('GET /foods/search?q=a&q=b (array) → 400 en vez de 500', async () => {
    const res = await request(app).get('/foods/search?q=pollo&q=arroz').set('Authorization', auth());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  test('GET /foods/search con q demasiado larga → 400', async () => {
    const res = await request(app).get(`/foods/search?q=${'a'.repeat(101)}`).set('Authorization', auth());
    expect(res.status).toBe(400);
  });

  test('searchFoods con q objeto → 400', async () => {
    const res = makeRes();
    await searchFoods({ query: { q: { $ne: '' } } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('GET /foods/barcode/:code con formato inválido → 400', async () => {
    const res = await request(app).get('/foods/barcode/abc%27--').set('Authorization', auth());
    expect(res.status).toBe(400);
  });
});
