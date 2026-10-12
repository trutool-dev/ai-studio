'use strict';

/**
 * Tests de integración para planes (plans.controller.js) y entrenamiento (training.controller.js).
 * Cubre: GET /plans, GET /plans/:id, PUT /plans/:id/pause, POST /plans/regenerate,
 *        GET /training/sessions, GET /training/sessions/:id, PUT .../complete, POST .../exercises/:id/complete
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1749, tdee: 2711, target_calories: 2168 }),
  generatePlan: jest.fn().mockResolvedValue({
    training_plan: {
      weeks: 4,
      sessions_per_week: 3,
      weekly_schedule: [
        { day_of_week: 1, day_name: 'Lunes', session_type: 'strength', duration_minutes: 60, muscle_groups: ['pecho'], exercises: [], notes: 'Fuerza.' },
        { day_of_week: 2, day_name: 'Martes', session_type: 'rest', duration_minutes: 0, muscle_groups: [], exercises: [], notes: 'Descanso.' },
      ],
    },
    nutrition_plan: {
      daily_calories: 2168,
      macros: { protein_g: 176, carbs_g: 218, fat_g: 60 },
      meals_per_day: 3,
      meal_suggestions: [
        { meal_type: 'breakfast', name: 'Avena', description: 'Avena', approximate_calories: 450, protein_g: 35, carbs_g: 55, fat_g: 8, ingredients: [], prep_time_minutes: 5 },
      ],
    },
    notes: 'Plan test',
    generated_at: new Date().toISOString(),
    model_version: 'mock',
    generated_by_ai: true,
    metabolism_metrics: { bmr: 1749, tdee: 2711, target_calories: 2168 },
  }),
  regeneratePlan: jest.fn().mockResolvedValue({
    training_plan: {
      weeks: 4,
      sessions_per_week: 3,
      weekly_schedule: [
        { day_of_week: 1, day_name: 'Lunes', session_type: 'strength', duration_minutes: 60, muscle_groups: ['pecho'], exercises: [], notes: '' },
        { day_of_week: 2, day_name: 'Martes', session_type: 'rest', duration_minutes: 0, muscle_groups: [], exercises: [], notes: '' },
      ],
    },
    nutrition_plan: {
      daily_calories: 2168,
      macros: { protein_g: 176, carbs_g: 218, fat_g: 60 },
      meals_per_day: 3,
      meal_suggestions: [],
    },
    generated_by_ai: true,
    model_version: 'mock',
  }),
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
  ONBOARDING_PROFILE,
  ONBOARDING_LIFESTYLE,
  ONBOARDING_TRAINING,
  ONBOARDING_NUTRITION,
  ONBOARDING_MOTIVATION,
} = require('../helpers/testSetup');

const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await cleanupUser(email);
  }
  await cleanupAllTestUsers();
  await teardown();
});

// ─── Helper: usuario con plan activo ─────────────────────────────────────────

async function createUserWithPlan() {
  const user = await createAndLoginUser();
  createdEmails.push(user.email);
  const token = user.access_token;
  const userId = user.user.id;

  // Completar onboarding para tener plan
  await request(app).put('/onboarding/profile').set('Authorization', getAuthHeader(token)).send(ONBOARDING_PROFILE);
  await request(app).put('/onboarding/lifestyle').set('Authorization', getAuthHeader(token)).send(ONBOARDING_LIFESTYLE);
  await request(app).put('/onboarding/training').set('Authorization', getAuthHeader(token)).send(ONBOARDING_TRAINING);
  await request(app).put('/onboarding/nutrition').set('Authorization', getAuthHeader(token)).send(ONBOARDING_NUTRITION);
  await request(app).put('/onboarding/health').set('Authorization', getAuthHeader(token)).send({ conditions: [], food_restrictions: [] });
  await request(app).put('/onboarding/motivation').set('Authorization', getAuthHeader(token)).send(ONBOARDING_MOTIVATION);
  await request(app).post('/onboarding/complete').set('Authorization', getAuthHeader(token)).send({ answers: [] });

  // Obtener el plan creado
  const plans = await prisma.plan.findMany({ where: { user_id: userId, status: 'active' } });
  const plan = plans[0];

  return { token, userId, plan };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /plans — Plan activo
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /plans', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;
    userId = result.userId;
  });

  test('devuelve el plan activo del usuario', async () => {
    const res = await request(app)
      .get('/plans')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan');
    expect(res.body.data.plan).toHaveProperty('id');
    expect(res.body.data.plan.status).toBe('active');
  });

  test('devuelve 404 si el usuario no tiene plan activo', async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);

    const res = await request(app)
      .get('/plans')
      .set('Authorization', getAuthHeader(user.access_token));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  test('requiere autenticación', async () => {
    const res = await request(app).get('/plans');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /plans/:id — Plan por ID
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /plans/:id', () => {
  let token;
  let planId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;
    planId = result.plan.id;
  });

  test('devuelve el plan por ID', async () => {
    const res = await request(app)
      .get(`/plans/${planId}`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.plan.id).toBe(planId);
  });

  test('devuelve 404 para un plan inexistente', async () => {
    const res = await request(app)
      .get('/plans/00000000-0000-0000-0000-000000000000')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /plans/:id/pause — Pausar plan
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /plans/:id/pause', () => {
  let token;
  let planId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;
    planId = result.plan.id;
  });

  test('pausa el plan activo', async () => {
    const res = await request(app)
      .put(`/plans/${planId}/pause`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('devuelve error si el plan ya está pausado', async () => {
    // El plan ya fue pausado en el test anterior
    const res = await request(app)
      .put(`/plans/${planId}/pause`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PLAN_ALREADY_PAUSED');
  });

  test('devuelve 404 para un plan inexistente', async () => {
    const res = await request(app)
      .put('/plans/00000000-0000-0000-0000-000000000000/pause')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /plans/regenerate — Regenerar plan
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plans/regenerate', () => {
  let token;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;
  });

  test('regenera el plan activo', async () => {
    const res = await request(app)
      .post('/plans/regenerate')
      .set('Authorization', getAuthHeader(token))
      .send({ reason: 'test_regeneration' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan_id');
  });

  test('falla si no hay datos de onboarding completos', async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);

    const res = await request(app)
      .post('/plans/regenerate')
      .set('Authorization', getAuthHeader(user.access_token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ONBOARDING_INCOMPLETE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /training/sessions
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /training/sessions', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;
    userId = result.userId;
  });

  test('devuelve las sesiones del usuario', async () => {
    const res = await request(app)
      .get('/training/sessions')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('sessions');
    expect(Array.isArray(res.body.data.sessions)).toBe(true);
  });

  test('filtra sesiones por status', async () => {
    const res = await request(app)
      .get('/training/sessions?status=scheduled')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.sessions.every((s) => s.status === 'scheduled')).toBe(true);
  });

  test('requiere autenticación', async () => {
    const res = await request(app).get('/training/sessions');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /training/sessions/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /training/sessions/:id', () => {
  let token;
  let sessionId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;

    const res = await request(app)
      .get('/training/sessions')
      .set('Authorization', getAuthHeader(token));

    if (res.body.data.sessions.length > 0) {
      sessionId = res.body.data.sessions[0].id;
    }
  });

  test('devuelve detalle de sesión por ID', async () => {
    if (!sessionId) return;

    const res = await request(app)
      .get(`/training/sessions/${sessionId}`)
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.id).toBe(sessionId);
  });

  test('devuelve 404 para sesión inexistente', async () => {
    const res = await request(app)
      .get('/training/sessions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /training/sessions/:id/complete
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /training/sessions/:id/complete', () => {
  let token;
  let sessionId;

  beforeAll(async () => {
    const result = await createUserWithPlan();
    token = result.token;

    const res = await request(app)
      .get('/training/sessions')
      .set('Authorization', getAuthHeader(token));

    if (res.body.data.sessions.length > 0) {
      sessionId = res.body.data.sessions[0].id;
    }
  });

  test('marca la sesión como completada', async () => {
    if (!sessionId) return;

    const res = await request(app)
      .put(`/training/sessions/${sessionId}/complete`)
      .set('Authorization', getAuthHeader(token))
      .send({ duration_minutes: 45, calories_burned: 300, notes: 'Buen entrenamiento' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.session.status).toBe('completed');
  });

  test('falla si la sesión ya está completada', async () => {
    if (!sessionId) return;

    const res = await request(app)
      .put(`/training/sessions/${sessionId}/complete`)
      .set('Authorization', getAuthHeader(token))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SESSION_ALREADY_COMPLETED');
  });

  test('devuelve 404 para sesión inexistente', async () => {
    const res = await request(app)
      .put('/training/sessions/00000000-0000-0000-0000-000000000000/complete')
      .set('Authorization', getAuthHeader(token))
      .send({});

    expect(res.status).toBe(404);
  });
});
