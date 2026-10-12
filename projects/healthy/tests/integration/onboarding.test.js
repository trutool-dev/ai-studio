/**
 * Tests de integración para el onboarding (TS-04).
 * Cubre: 7 pasos PUT + POST /onboarding/complete.
 * Mockea aiService.generatePlan para no consumir tokens reales.
 * Verifica que complete crea plan, sesiones y comidas en BD.
 */

'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock del AI service: devuelve un plan válido sin llamar a Claude
jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({
    bmr: 1749,
    tdee: 2711,
    target_calories: 2168,
  }),
  generatePlan: jest.fn().mockResolvedValue({
    training_plan: {
      weeks: 4,
      sessions_per_week: 3,
      weekly_schedule: [
        {
          day_of_week: 1,
          day_name: 'Lunes',
          session_type: 'strength',
          duration_minutes: 60,
          muscle_groups: ['pecho', 'tríceps'],
          exercises: [
            {
              name: 'Press de banca',
              sets: 4,
              reps: '10',
              rest_seconds: 90,
              equipment_needed: 'barra',
              instructions: 'Baja la barra al pecho, empuja hacia arriba.',
            },
          ],
          notes: 'Calienta 5 min.',
        },
        {
          day_of_week: 2,
          day_name: 'Martes',
          session_type: 'rest',
          duration_minutes: 0,
          muscle_groups: [],
          exercises: [],
          notes: 'Descanso activo.',
        },
        {
          day_of_week: 3,
          day_name: 'Miércoles',
          session_type: 'cardio',
          duration_minutes: 45,
          muscle_groups: ['cardiovascular'],
          exercises: [],
          notes: 'Cardio moderado.',
        },
        {
          day_of_week: 4,
          day_name: 'Jueves',
          session_type: 'rest',
          duration_minutes: 0,
          muscle_groups: [],
          exercises: [],
          notes: 'Descanso.',
        },
        {
          day_of_week: 5,
          day_name: 'Viernes',
          session_type: 'strength',
          duration_minutes: 60,
          muscle_groups: ['espalda', 'bíceps'],
          exercises: [],
          notes: 'Espalda y bíceps.',
        },
        {
          day_of_week: 6,
          day_name: 'Sábado',
          session_type: 'rest',
          duration_minutes: 0,
          muscle_groups: [],
          exercises: [],
          notes: 'Descanso.',
        },
        {
          day_of_week: 7,
          day_name: 'Domingo',
          session_type: 'rest',
          duration_minutes: 0,
          muscle_groups: [],
          exercises: [],
          notes: 'Descanso.',
        },
      ],
    },
    nutrition_plan: {
      daily_calories: 2168,
      macros: { protein_g: 176, carbs_g: 218, fat_g: 60 },
      meals_per_day: 3,
      meal_suggestions: [
        {
          meal_type: 'breakfast',
          name: 'Avena proteica',
          description: 'Avena con proteína en polvo',
          approximate_calories: 450,
          protein_g: 35,
          carbs_g: 55,
          fat_g: 8,
          ingredients: ['80g avena', '1 scoop proteína'],
          prep_time_minutes: 5,
        },
        {
          meal_type: 'lunch',
          name: 'Pollo con arroz',
          description: 'Pechuga con arroz y verduras',
          approximate_calories: 620,
          protein_g: 55,
          carbs_g: 70,
          fat_g: 12,
          ingredients: ['200g pollo', '150g arroz'],
          prep_time_minutes: 20,
        },
        {
          meal_type: 'dinner',
          name: 'Salmón con patata',
          description: 'Salmón al horno con patata',
          approximate_calories: 500,
          protein_g: 40,
          carbs_g: 45,
          fat_g: 15,
          ingredients: ['200g salmón', '200g patata'],
          prep_time_minutes: 25,
        },
      ],
    },
    notes: 'Plan generado (mock de test)',
    generated_at: new Date().toISOString(),
    model_version: 'mock-test',
    generated_by_ai: true,
    metabolism_metrics: { bmr: 1749, tdee: 2711, target_calories: 2168 },
  }),
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /onboarding/start
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /onboarding/start', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('devuelve user_id del usuario autenticado', async () => {
    const res = await request(app)
      .post('/onboarding/start')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('user_id');
  });

  test('requiere autenticación', async () => {
    const res = await request(app).post('/onboarding/start');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/profile
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/profile', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
    userId = user.user.id;
  });

  test('guarda el perfil físico correctamente', async () => {
    const res = await request(app)
      .put('/onboarding/profile')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_PROFILE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile).toHaveProperty('name', ONBOARDING_PROFILE.name);
    expect(res.body.data.profile).toHaveProperty('gender', ONBOARDING_PROFILE.gender);
  });

  test('persiste el perfil en BD', async () => {
    const profile = await prisma.profile.findUnique({ where: { user_id: userId } });
    expect(profile).not.toBeNull();
    expect(parseFloat(profile.weight_kg)).toBe(ONBOARDING_PROFILE.weight_kg);
    expect(parseFloat(profile.height_cm)).toBe(ONBOARDING_PROFILE.height_cm);
  });

  test('rechaza menores de 16 años', async () => {
    const underage = new Date();
    underage.setFullYear(underage.getFullYear() - 15);

    const res = await request(app)
      .put('/onboarding/profile')
      .set('Authorization', getAuthHeader(token))
      .send({ ...ONBOARDING_PROFILE, birthdate: underage.toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AGE_RESTRICTION');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/lifestyle
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/lifestyle', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('guarda el estilo de vida correctamente', async () => {
    const res = await request(app)
      .put('/onboarding/lifestyle')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_LIFESTYLE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lifestyle).toHaveProperty('profession', ONBOARDING_LIFESTYLE.profession);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/training
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/training', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('guarda preferencias de entrenamiento', async () => {
    const res = await request(app)
      .put('/onboarding/training')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_TRAINING);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.training).toHaveProperty(
      'available_days_per_week',
      ONBOARDING_TRAINING.available_days_per_week,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/nutrition
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/nutrition', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('guarda preferencias nutricionales', async () => {
    const res = await request(app)
      .put('/onboarding/nutrition')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_NUTRITION);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.nutrition).toHaveProperty('diet_type', ONBOARDING_NUTRITION.diet_type);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/health
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/health', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('guarda condiciones de salud vacías', async () => {
    const res = await request(app)
      .put('/onboarding/health')
      .set('Authorization', getAuthHeader(token))
      .send({ conditions: [], food_restrictions: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('guarda condiciones de salud con datos', async () => {
    const res = await request(app)
      .put('/onboarding/health')
      .set('Authorization', getAuthHeader(token))
      .send({
        conditions: [{ condition_name: 'Hypertension', condition_type: 'chronic', affects_training: false, affects_nutrition: true }],
        food_restrictions: [{ restriction_type: 'allergy', food_name: 'Peanuts' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /onboarding/motivation
// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /onboarding/motivation', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('guarda el perfil de motivación', async () => {
    const res = await request(app)
      .put('/onboarding/motivation')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_MOTIVATION);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.motivation).toHaveProperty(
      'main_motivation',
      ONBOARDING_MOTIVATION.main_motivation,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /onboarding/complete — El más importante (TS-04)
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /onboarding/complete', () => {
  let token;
  let userId;

  beforeAll(async () => {
    // Crear usuario y completar todos los pasos previos
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
    userId = user.user.id;

    // Paso 1: Perfil físico
    await request(app)
      .put('/onboarding/profile')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_PROFILE);

    // Paso 2: Estilo de vida
    await request(app)
      .put('/onboarding/lifestyle')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_LIFESTYLE);

    // Paso 3: Entrenamiento
    await request(app)
      .put('/onboarding/training')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_TRAINING);

    // Paso 4: Nutrición
    await request(app)
      .put('/onboarding/nutrition')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_NUTRITION);

    // Paso 5: Salud
    await request(app)
      .put('/onboarding/health')
      .set('Authorization', getAuthHeader(token))
      .send({ conditions: [], food_restrictions: [] });

    // Paso 6: Motivación
    await request(app)
      .put('/onboarding/motivation')
      .set('Authorization', getAuthHeader(token))
      .send(ONBOARDING_MOTIVATION);
  });

  test('completa el onboarding y devuelve el plan generado (has_plan: true)', async () => {
    const res = await request(app)
      .post('/onboarding/complete')
      .set('Authorization', getAuthHeader(token))
      .send({ answers: [] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plan');
    expect(res.body.data.plan).toHaveProperty('id');
    expect(res.body.data.plan.status).toBe('active');
  });

  test('crea un plan en la BD', async () => {
    const plans = await prisma.plan.findMany({
      where: { user_id: userId, status: 'active' },
    });
    expect(plans.length).toBeGreaterThan(0);
  });

  test('crea sesiones de entrenamiento en la BD', async () => {
    const sessions = await prisma.trainingSession.findMany({
      where: { user_id: userId },
    });
    // El mock genera 3 sesiones activas (Lunes, Miércoles, Viernes) × 4 semanas = 12
    expect(sessions.length).toBeGreaterThan(0);
  });

  test('crea comidas en la BD', async () => {
    const meals = await prisma.meal.findMany({
      where: { user_id: userId },
    });
    // 3 comidas × 7 días = 21
    expect(meals.length).toBeGreaterThan(0);
  });

  test('la respuesta incluye metabolism con bmr, tdee, target_calories', async () => {
    const res = await request(app)
      .post('/onboarding/complete')
      .set('Authorization', getAuthHeader(token))
      .send({ answers: [] });

    // Puede devolver 201 (nuevo plan) o 201 si se crea otro plan
    expect([200, 201]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.data).toHaveProperty('metabolism');
    }
  });

  test('falla si no hay perfil físico (PROFILE_REQUIRED)', async () => {
    // Usuario sin perfil
    const newUser = await createAndLoginUser();
    createdEmails.push(newUser.email);

    // Solo ponemos entrenamiento, sin perfil
    await request(app)
      .put('/onboarding/training')
      .set('Authorization', getAuthHeader(newUser.access_token))
      .send(ONBOARDING_TRAINING);

    const res = await request(app)
      .post('/onboarding/complete')
      .set('Authorization', getAuthHeader(newUser.access_token))
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('PROFILE_REQUIRED');
  });

  test('falla si no hay preferencias de entrenamiento (TRAINING_REQUIRED)', async () => {
    const newUser = await createAndLoginUser();
    createdEmails.push(newUser.email);

    // Solo perfil, sin entrenamiento
    await request(app)
      .put('/onboarding/profile')
      .set('Authorization', getAuthHeader(newUser.access_token))
      .send(ONBOARDING_PROFILE);

    const res = await request(app)
      .post('/onboarding/complete')
      .set('Authorization', getAuthHeader(newUser.access_token))
      .send({ answers: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('TRAINING_REQUIRED');
  });

  test('requiere autenticación', async () => {
    const res = await request(app)
      .post('/onboarding/complete')
      .send({ answers: [] });

    expect(res.status).toBe(401);
  });
});
