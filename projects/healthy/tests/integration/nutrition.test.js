/**
 * Tests de integración para nutrición (TS-06).
 * Cubre: GET /nutrition/today, GET /nutrition/meals,
 *        PUT /nutrition/meals/:id/complete, GET /foods/search.
 * Verifica que un usuario no puede acceder a datos de otro (403/404).
 */

'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
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

const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await cleanupUser(email);
  }
  await cleanupAllTestUsers();
  await teardown();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /nutrition/today y /nutrition/meals
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /nutrition/today', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
    userId = user.user.id;
  });

  test('devuelve lista de comidas del día (vacía si no hay)', async () => {
    const res = await request(app)
      .get('/nutrition/today')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('meals');
    expect(Array.isArray(res.body.data.meals)).toBe(true);
    expect(res.body.data).toHaveProperty('totals');
    expect(res.body.data).toHaveProperty('total_meals');
  });

  test('incluye totales de macros del día', async () => {
    const { totals } = (
      await request(app)
        .get('/nutrition/today')
        .set('Authorization', getAuthHeader(token))
    ).body.data;

    expect(totals).toHaveProperty('calories');
    expect(totals).toHaveProperty('protein_g');
    expect(totals).toHaveProperty('carbs_g');
    expect(totals).toHaveProperty('fat_g');
    expect(totals).toHaveProperty('completed');
    expect(typeof totals.calories).toBe('number');
  });

  test('devuelve solo las comidas del usuario autenticado', async () => {
    // Crear comida para este usuario
    const plan = await prisma.plan.create({
      data: { user_id: userId, type: 'combined', start_date: new Date(), end_date: new Date(), status: 'active' },
    });
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    await prisma.meal.create({
      data: {
        user_id: userId,
        plan_id: plan.id,
        meal_type: 'lunch',
        scheduled_date: today,
        calories: 500,
        protein_g: 40,
        carbs_g: 50,
        fat_g: 15,
        status: 'scheduled',
      },
    });

    const res = await request(app)
      .get('/nutrition/today')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    // Solo debería ver sus propias comidas
    const { meals } = res.body.data;
    meals.forEach((meal) => expect(meal.user_id).toBe(userId));
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/nutrition/today');
    expect(res.status).toBe(401);
  });
});

describe('GET /nutrition/meals', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('acepta parámetro de fecha ?date=YYYY-MM-DD', async () => {
    const date = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/nutrition/meals?date=${date}`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('requiere autenticación', async () => {
    const res = await request(app).get('/nutrition/meals');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /nutrition/meals/:id/complete
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /nutrition/meals/:id/complete', () => {
  let token;
  let otherToken;
  let mealId;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;

    const otherUser = await createAndLoginUser();
    createdEmails.push(otherUser.email);
    otherToken = otherUser.access_token;

    // Crear una comida para el usuario principal
    const plan = await prisma.plan.create({
      data: {
        user_id: user.user.id,
        type: 'combined',
        start_date: new Date(),
        end_date: new Date(),
        status: 'active',
      },
    });

    const meal = await prisma.meal.create({
      data: {
        user_id: user.user.id,
        plan_id: plan.id,
        meal_type: 'breakfast',
        scheduled_date: new Date(),
        calories: 400,
        protein_g: 30,
        carbs_g: 45,
        fat_g: 10,
        status: 'scheduled',
      },
    });
    mealId = meal.id;
  });

  test('marca la comida como completada', async () => {
    const res = await request(app)
      .put(`/nutrition/meals/${mealId}/complete`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.meal.status).toBe('completed');
  });

  test('comida ya completada → 400 MEAL_ALREADY_COMPLETED', async () => {
    const res = await request(app)
      .put(`/nutrition/meals/${mealId}/complete`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MEAL_ALREADY_COMPLETED');
  });

  test('otro usuario no puede completar la comida → 404', async () => {
    // Crear una nueva comida sin completar para este test
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    const plan = await prisma.plan.create({
      data: {
        user_id: user.user.id,
        type: 'combined',
        start_date: new Date(),
        end_date: new Date(),
        status: 'active',
      },
    });
    const newMeal = await prisma.meal.create({
      data: {
        user_id: user.user.id,
        plan_id: plan.id,
        meal_type: 'dinner',
        scheduled_date: new Date(),
        calories: 500,
        protein_g: 40,
        carbs_g: 50,
        fat_g: 15,
        status: 'scheduled',
      },
    });

    // Otro usuario intenta completar la comida
    const res = await request(app)
      .put(`/nutrition/meals/${newMeal.id}/complete`)
      .set('Authorization', getAuthHeader(otherToken));

    expect(res.status).toBe(404);
  });

  test('ID de comida inexistente → 404', async () => {
    const res = await request(app)
      .put('/nutrition/meals/nonexistent-id-12345/complete')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(404);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).put(`/nutrition/meals/${mealId}/complete`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /foods/search
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /foods/search', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('busca alimentos con query válida', async () => {
    const res = await request(app)
      .get('/foods/search?q=pollo')
      .set('Authorization', getAuthHeader(token));

    // Puede devolver 200 con resultados vacíos (BD de test no tiene seed)
    // o 200 con resultados
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('foods');
    expect(Array.isArray(res.body.data.foods)).toBe(true);
    expect(res.body.data).toHaveProperty('from_cache');
  });

  test('query de 1 carácter → 400 QUERY_TOO_SHORT', async () => {
    const res = await request(app)
      .get('/foods/search?q=a')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('QUERY_TOO_SHORT');
  });

  test('sin parámetro q → 400', async () => {
    const res = await request(app)
      .get('/foods/search')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(400);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/foods/search?q=pollo');
    expect(res.status).toBe(401);
  });

  test('busca con query de exactamente 2 caracteres → 200', async () => {
    const res = await request(app)
      .get('/foods/search?q=po')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /foods/barcode/:code
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /foods/barcode/:code', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('código inexistente → 404', async () => {
    const res = await request(app)
      .get('/foods/barcode/0000000000000')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/foods/barcode/1234567890');
    expect(res.status).toBe(401);
  });
});
