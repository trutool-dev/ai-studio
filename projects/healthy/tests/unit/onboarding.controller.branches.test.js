'use strict';

/**
 * Tests de branches para onboarding.controller.js.
 *
 * Actualizado para la auditoría 2026-10-19:
 * - SEC-28: payload del frontend y formato antiguo.
 * - SEC-29: edad ≥ 16 y rangos (400).
 * - SEC-33/47: consentimiento explícito (healthConsent === true) y retirada.
 * - SEC-36/54: persistencia en transacción y catálogo como `exercises`.
 */

// Prisma y Redis en memoria también con la config raíz (sin conexiones reales)
jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1500, tdee: 2000, target_calories: 1800, effective_goal: 'lose_weight', flags: [] }),
  generatePlan: jest.fn(),
  regeneratePlan: jest.fn(),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
}));

jest.mock('../../backend/src/services/exerciseSelector.service', () => ({
  getExercisesForProfile: jest.fn().mockResolvedValue([]),
  formatExercisesForPrompt: jest.fn().mockReturnValue(''),
}));

const prisma = require('../../backend/src/prisma/client');
const aiService = require('../../backend/src/services/aiService');
const exerciseSelector = require('../../backend/src/services/exerciseSelector.service');
const {
  start,
  saveProfile,
  saveLifestyle,
  saveTraining,
  saveNutrition,
  saveHealth,
  saveMotivation,
  withdrawHealthConsent,
  complete,
} = require('../../backend/src/controllers/onboarding.controller');

const DEFAULT_PLAN = {
  training_plan: {
    weeks: 2,
    sessions_per_week: 1,
    weekly_schedule: [
      { day_of_week: 1, session_type: 'strength', notes: 'Day 1' },
      { day_of_week: 3, session_type: 'rest', notes: 'Rest' },
    ],
  },
  nutrition_plan: {
    daily_calories: 1800,
    macros: {},
    meals_per_day: 3,
    meal_suggestions: [
      { meal_type: 'breakfast', approximate_calories: 400, protein_g: 30, carbs_g: 50, fat_g: 10 },
    ],
  },
  generated_by_ai: true,
  model_version: 'mock',
};

function makeReq(overrides = {}) {
  return { user: { userId: 'user-onboarding-test' }, params: {}, query: {}, body: {}, ...overrides };
}

function makeMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const CONSENT_OK = { health_consent_given_at: new Date(), health_consent_version: '1.0' };
const NO_CONSENT = { health_consent_given_at: null, health_consent_version: null };

beforeEach(() => {
  jest.clearAllMocks();
  aiService.generatePlan.mockResolvedValue(DEFAULT_PLAN);
  exerciseSelector.getExercisesForProfile.mockResolvedValue([]);
});

// ─── start ─────────────────────────────────────────────────────────────────────

describe('start', () => {
  test('devuelve 200 con user_id', async () => {
    const res = makeMockRes();
    await start(makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ user_id: 'user-onboarding-test' }) }));
  });
});

// ─── saveProfile ──────────────────────────────────────────────────────────────

describe('saveProfile — branches', () => {
  test('rechaza perfil sin edad ni birthdate (400 VALIDATION_ERROR)', async () => {
    prisma.profile.upsert = jest.fn();
    const res = makeMockRes();
    await saveProfile(makeReq({ body: { name: 'Test', gender: 'male', weight_kg: 75, height_cm: 175 } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  test('rechaza usuario menor de 16 años (branch age < 16)', async () => {
    const res = makeMockRes();
    await saveProfile(makeReq({ body: { birthdate: '2020-01-01' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'AGE_RESTRICTION' }));
  });

  test('permite usuario de 16 años o más con birthdate (formato antiguo)', async () => {
    const birthdate = new Date();
    birthdate.setFullYear(birthdate.getFullYear() - 18);
    prisma.profile.upsert = jest.fn().mockResolvedValue({ id: 'profile-1' });
    const res = makeMockRes();
    await saveProfile(makeReq({ body: { birthdate: birthdate.toISOString(), name: 'Test', gender: 'male' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.profile.upsert.mock.calls[0][0].create.name).toBe('Test');
  });

  test('llama a next en caso de error de BD', async () => {
    prisma.profile.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await saveProfile(makeReq({ body: { name: 'Test', age: 30 } }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveLifestyle ─────────────────────────────────────────────────────────────

describe('saveLifestyle — branches', () => {
  test('guarda estilo de vida correctamente (lista blanca de campos)', async () => {
    prisma.lifestyleProfile.upsert = jest.fn().mockResolvedValue({ id: 'ls-1' });
    const res = makeMockRes();
    await saveLifestyle(makeReq({ body: { profession: 'Developer', work_type: 'office', id: 'forzado', user_id: 'otro' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const { create } = prisma.lifestyleProfile.upsert.mock.calls[0][0];
    expect(create.user_id).toBe('user-onboarding-test');
    expect(create.id).toBeUndefined();
  });

  test('profesión demasiado larga → 400 (SEC-63)', async () => {
    const res = makeMockRes();
    await saveLifestyle(makeReq({ body: { profession: 'x'.repeat(101) } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('llama a next en caso de error', async () => {
    prisma.lifestyleProfile.upsert = jest.fn().mockRejectedValue(new Error('DB timeout'));
    const next = jest.fn();
    await saveLifestyle(makeReq({ body: {} }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveTraining ──────────────────────────────────────────────────────────────

describe('saveTraining — branches has_gym_access', () => {
  test('usa false cuando has_gym_access no está definido (branch ?? false)', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockResolvedValue({ id: 'tp-1' });
    const res = makeMockRes();
    await saveTraining(makeReq({ body: { available_days_per_week: 3 } }), res, jest.fn());
    expect(prisma.trainingPreferences.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ has_gym_access: false }),
      update: expect.objectContaining({ has_gym_access: false }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('usa el valor provisto cuando has_gym_access es true', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockResolvedValue({ id: 'tp-2' });
    await saveTraining(makeReq({ body: { available_days_per_week: 4, has_gym_access: true } }), makeMockRes(), jest.fn());
    expect(prisma.trainingPreferences.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ has_gym_access: true }),
    }));
  });

  test('sin días disponibles → 400', async () => {
    const res = makeMockRes();
    await saveTraining(makeReq({ body: {} }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('llama a next en caso de error', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockRejectedValue(new Error('Error'));
    const next = jest.fn();
    await saveTraining(makeReq({ body: { days_per_week: 3 } }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveNutrition ─────────────────────────────────────────────────────────────

describe('saveNutrition — branches', () => {
  test('guarda preferencias nutricionales', async () => {
    prisma.nutritionPreferences.upsert = jest.fn().mockResolvedValue({ id: 'np-1' });
    const res = makeMockRes();
    await saveNutrition(makeReq({ body: { diet_type: 'omnivore', meals_per_day_preferred: 3 } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('guarda restricciones si ya hay consentimiento', async () => {
    prisma.nutritionPreferences.upsert = jest.fn().mockResolvedValue({ id: 'np-1' });
    prisma.user.findUnique = jest.fn().mockResolvedValue(CONSENT_OK);
    prisma.foodRestriction.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.foodRestriction.createMany = jest.fn().mockResolvedValue({ count: 1 });
    const res = makeMockRes();
    await saveNutrition(makeReq({ body: { diet_type: 'vegan', restrictions: ['soy'] } }), res, jest.fn());
    expect(prisma.foodRestriction.createMany).toHaveBeenCalledWith({ data: [
      { user_id: 'user-onboarding-test', restriction_type: 'allergy', food_name: 'Soja', severity: 'severe' },
    ] });
    expect(res.json.mock.calls[0][0].data.restrictions_pending_consent).toBe(false);
  });

  test('llama a next en caso de error', async () => {
    prisma.nutritionPreferences.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await saveNutrition(makeReq({ body: {} }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveHealth ────────────────────────────────────────────────────────────────

describe('saveHealth — consentimiento explícito (SEC-33)', () => {
  beforeEach(() => {
    prisma.healthCondition.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.healthCondition.createMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.foodRestriction.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    prisma.foodRestriction.createMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.trainingPreferences.upsert = jest.fn().mockResolvedValue({});
    prisma.user.findUnique = jest.fn().mockResolvedValue(NO_CONSENT);
    prisma.user.update = jest.fn().mockResolvedValue({});
  });

  test.each([
    [{}],
    [{ conditions: [], food_restrictions: [] }],
    [{ healthConsent: false }],
    [{ healthConsent: 'true' }],
  ])('body %j sin healthConsent === true → 400 y no registra consentimiento', async (body) => {
    const res = makeMockRes();
    await saveHealth(makeReq({ body }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'HEALTH_CONSENT_REQUIRED' }));
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.healthCondition.createMany).not.toHaveBeenCalled();
  });

  test('con healthConsent: true registra consentimiento con versión y guarda datos (formato frontend)', async () => {
    const res = makeMockRes();
    await saveHealth(makeReq({ body: { conditions: ['asthma'], injuries: ['back', 'none_inj'], healthConsent: true } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ health_consent_given_at: expect.any(Date), health_consent_version: '1.0' }),
    }));
    expect(prisma.healthCondition.createMany.mock.calls[0][0].data[0]).toEqual(expect.objectContaining({ condition_name: 'Asma', user_id: 'user-onboarding-test' }));
    expect(prisma.trainingPreferences.upsert.mock.calls[0][0].update).toEqual({ injuries_or_limitations: 'back' });
  });

  test('arrays vacíos explícitos sustituyen (borran) lo anterior', async () => {
    await saveHealth(makeReq({ body: { conditions: [], food_restrictions: [], healthConsent: true } }), makeMockRes(), jest.fn());
    expect(prisma.healthCondition.deleteMany).toHaveBeenCalled();
    expect(prisma.healthCondition.createMany).not.toHaveBeenCalled();
    expect(prisma.foodRestriction.deleteMany).toHaveBeenCalled();
  });

  test('formato antiguo: objetos con lista blanca de campos (SEC-61)', async () => {
    await saveHealth(makeReq({ body: {
      healthConsent: true,
      conditions: [{ condition_name: 'Diabetes', condition_type: 'chronic', id: 'x', user_id: 'otro' }],
      food_restrictions: [{ restriction_type: 'allergy', food_name: 'Gluten', created_at: '2000-01-01' }],
    } }), makeMockRes(), jest.fn());
    const cond = prisma.healthCondition.createMany.mock.calls[0][0].data[0];
    expect(cond).toEqual({ user_id: 'user-onboarding-test', condition_name: 'Diabetes', condition_type: 'disease', affects_training: false, affects_nutrition: false, notes: null });
    const restr = prisma.foodRestriction.createMany.mock.calls[0][0].data[0];
    expect(restr).toEqual({ user_id: 'user-onboarding-test', restriction_type: 'allergy', food_name: 'Gluten', severity: 'severe' });
  });

  test('no vuelve a registrar consentimiento si ya es vigente', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(CONSENT_OK);
    const res = makeMockRes();
    await saveHealth(makeReq({ body: { healthConsent: true } }), res, jest.fn());
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('condition_name demasiado largo → 400 (SEC-63)', async () => {
    const res = makeMockRes();
    await saveHealth(makeReq({ body: { healthConsent: true, conditions: [{ condition_name: 'x'.repeat(101) }] } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await saveHealth(makeReq({ body: { healthConsent: true } }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── withdrawHealthConsent ────────────────────────────────────────────────────

describe('withdrawHealthConsent (SEC-47)', () => {
  test('borra datos art. 9 y anula el consentimiento', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(CONSENT_OK);
    prisma.healthCondition.deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    prisma.foodRestriction.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.trainingPreferences.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.user.update = jest.fn().mockResolvedValue({});
    const res = makeMockRes();
    await withdrawHealthConsent(makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toEqual(expect.objectContaining({
      withdrawn: true, deleted: { conditions: 2, food_restrictions: 1, injuries_cleared: true },
    }));
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.health_consent_given_at).toBeNull();
    expect(data.health_consent_version).toMatch(/^withdrawn:1\.0:/);
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await withdrawHealthConsent(makeReq(), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveMotivation ───────────────────────────────────────────────────────────

describe('saveMotivation — branches', () => {
  test('guarda perfil de motivación', async () => {
    prisma.motivationProfile.upsert = jest.fn().mockResolvedValue({ id: 'mp-1' });
    const res = makeMockRes();
    await saveMotivation(makeReq({ body: { main_motivation: 'health', previous_attempts: false } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('valor inválido → 400', async () => {
    const res = makeMockRes();
    await saveMotivation(makeReq({ body: { main_motivation: 'dinero' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('llama a next en caso de error', async () => {
    prisma.motivationProfile.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const next = jest.fn();
    await saveMotivation(makeReq({ body: {} }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── complete ─────────────────────────────────────────────────────────────────

describe('complete — branches', () => {
  function setupBasePrisma() {
    prisma.user.findUnique = jest.fn().mockResolvedValue(CONSENT_OK);
    prisma.profile.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1', user_id: 'user-onboarding-test', birthdate: new Date('1990-01-01'),
      weight_kg: 75, height_cm: 175, gender: 'male', body_type: 'mesomorph', activity_level: 'moderate', goal: 'lose_weight',
    });
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue({
      available_days_per_week: 3, max_session_duration_minutes: 60, has_gym_access: true,
      home_equipment: 'none', experience_level: 'beginner', injuries_or_limitations: null,
    });
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.onboardingAnswer.deleteMany = jest.fn().mockResolvedValue({});
    prisma.onboardingAnswer.createMany = jest.fn().mockResolvedValue({});
    prisma.profile.update = jest.fn().mockResolvedValue({});
    prisma.plan.updateMany = jest.fn().mockResolvedValue({});
    prisma.plan.create = jest.fn().mockResolvedValue({ id: 'plan-new', status: 'active', start_date: new Date(), end_date: new Date(), generated_by_ai: true });
    prisma.trainingSession.createMany = jest.fn().mockResolvedValue({});
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([{ id: 's-1' }, { id: 's-2' }]);
    prisma.sessionExercise.createMany = jest.fn().mockResolvedValue({});
    prisma.meal.createMany = jest.fn().mockResolvedValue({});
  }

  test('403 HEALTH_CONSENT_REQUIRED sin consentimiento y sin llamar a la IA (SEC-33)', async () => {
    setupBasePrisma();
    prisma.user.findUnique = jest.fn().mockResolvedValue(NO_CONSENT);
    const res = makeMockRes();
    await complete(makeReq({ body: {} }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'HEALTH_CONSENT_REQUIRED' }));
    expect(aiService.generatePlan).not.toHaveBeenCalled();
  });

  test('403 si el consentimiento es de una versión anterior (SEC-47)', async () => {
    setupBasePrisma();
    process.env.HEALTH_CONSENT_VERSION = '2.0';
    try {
      const res = makeMockRes();
      await complete(makeReq({ body: {} }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    } finally {
      delete process.env.HEALTH_CONSENT_VERSION;
    }
  });

  test('devuelve 400 cuando profile es null (branch !profile)', async () => {
    setupBasePrisma();
    prisma.profile.findUnique = jest.fn().mockResolvedValue(null);
    const res = makeMockRes();
    await complete(makeReq({ body: {} }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'PROFILE_REQUIRED' }));
  });

  test('devuelve 400 cuando training es null (branch !training)', async () => {
    setupBasePrisma();
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue(null);
    const res = makeMockRes();
    await complete(makeReq({ body: {} }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TRAINING_REQUIRED' }));
  });

  test('guarda answers con lista blanca de campos (SEC-61)', async () => {
    setupBasePrisma();
    await complete(makeReq({ body: { answers: [{ question_key: 'q1', answer_value: 'a1', question_category: 'training', id: 'x' }] } }), makeMockRes(), jest.fn());
    expect(prisma.onboardingAnswer.deleteMany).toHaveBeenCalled();
    expect(prisma.onboardingAnswer.createMany).toHaveBeenCalledWith({ data: [
      { user_id: 'user-onboarding-test', question_key: 'q1', answer_value: 'a1', question_category: 'training' },
    ] });
  });

  test('answers inválidas → 400', async () => {
    setupBasePrisma();
    const res = makeMockRes();
    await complete(makeReq({ body: { answers: [{ question_key: 'q1' }] } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('no guarda answers cuando answers está vacío', async () => {
    setupBasePrisma();
    await complete(makeReq({ body: { answers: [] } }), makeMockRes(), jest.fn());
    expect(prisma.onboardingAnswer.createMany).not.toHaveBeenCalled();
  });

  test('pasa el catálogo como `exercises` y usa los IDs válidos del plan (SEC-54)', async () => {
    setupBasePrisma();
    exerciseSelector.getExercisesForProfile.mockResolvedValue([
      { id: 'ex-1', name: 'Push Up', externalId: '001' },
      { id: 'ex-2', name: 'Squat', externalId: '002' },
    ]);
    aiService.generatePlan.mockResolvedValue({
      ...DEFAULT_PLAN,
      training_plan: { weeks: 1, sessions_per_week: 1, weekly_schedule: [
        { day_of_week: 1, session_type: 'strength', exercises: [
          { id: '002', name: 'Squat', sets: 4, reps: '8-10', rest_seconds: 90 },
          { id: '999', name: 'Inventado', sets: 3, reps: '10', rest_seconds: 60 },
        ] },
      ] },
    });
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([{ id: 's-1' }]);
    const res = makeMockRes();
    await complete(makeReq({ body: {} }), res, jest.fn());

    expect(aiService.generatePlan.mock.calls[0][3]).toBeNull();
    expect(aiService.generatePlan.mock.calls[0][4]).toHaveLength(2);
    expect(prisma.sessionExercise.createMany).toHaveBeenCalledWith({ data: [
      { session_id: 's-1', exercise_id: 'ex-2', sets: 4, reps: 8, rest_seconds: 90, order_index: 1 },
    ] });
    const day = res.json.mock.calls[0][0].data.generated_plan.training_plan.weekly_schedule[0];
    expect(day.exercises.map((e) => e.id)).toEqual(['002']);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('rota el catálogo si un día no tiene ejercicios válidos', async () => {
    setupBasePrisma();
    exerciseSelector.getExercisesForProfile.mockResolvedValue([{ id: 'ex-1', externalId: '001' }]);
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([{ id: 's-1' }]);
    aiService.generatePlan.mockResolvedValue({ ...DEFAULT_PLAN, training_plan: { weeks: 1, sessions_per_week: 1, weekly_schedule: [{ day_of_week: 2, session_type: 'cardio' }] } });
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(prisma.sessionExercise.createMany.mock.calls[0][0].data).toHaveLength(4);
  });

  test('persistencia en transacción (SEC-36)', async () => {
    setupBasePrisma();
    prisma.$transaction.mockClear();
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.plan.create).toHaveBeenCalled();
  });

  test('NO crea sessions cuando todas son rest', async () => {
    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({ ...DEFAULT_PLAN, training_plan: { weeks: 1, sessions_per_week: 0, weekly_schedule: [{ day_of_week: 1, session_type: 'rest' }] } });
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
  });

  test('crea meals cuando hay meal_suggestions y no cuando está vacío', async () => {
    setupBasePrisma();
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(prisma.meal.createMany.mock.calls[0][0].data).toHaveLength(7);

    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({ ...DEFAULT_PLAN, nutrition_plan: { ...DEFAULT_PLAN.nutrition_plan, meal_suggestions: [] } });
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(prisma.meal.createMany).not.toHaveBeenCalled();
  });

  test('injuries_or_limitations antiguas se normalizan a claves canónicas', async () => {
    setupBasePrisma();
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      available_days_per_week: 3, max_session_duration_minutes: 60, has_gym_access: false,
      home_equipment: 'none', experience_level: 'intermediate', injuries_or_limitations: 'knee, lower_back',
    });
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    expect(exerciseSelector.getExercisesForProfile).toHaveBeenCalledWith(
      expect.objectContaining({ injuries: ['knee', 'back'] }), 80);
  });

  test('envía restricciones, condiciones y motivación (lista blanca) a la IA', async () => {
    setupBasePrisma();
    prisma.nutritionPreferences.findUnique.mockResolvedValue({ diet_type: 'vegan', meals_per_day_preferred: 4 });
    prisma.foodRestriction.findMany.mockResolvedValue([{ restriction_type: 'allergy', food_name: 'Frutos secos', id: 'r1' }]);
    prisma.healthCondition.findMany.mockResolvedValue([{ condition_name: 'Diabetes', condition_type: 'disease', affects_training: false, affects_nutrition: true, notes: 'privado' }]);
    prisma.motivationProfile.findUnique.mockResolvedValue({ main_motivation: 'health', previous_attempts_notes: 'privado' });
    prisma.lifestyleProfile.findUnique.mockResolvedValue({ profession: 'Abogada', work_type: 'office', stress_level: 4 });
    await complete(makeReq({ body: {} }), makeMockRes(), jest.fn());
    const data = aiService.generatePlan.mock.calls[0][1];
    expect(data.nutrition.food_restrictions).toEqual([{ restriction_type: 'allergy', food_name: 'Frutos secos' }]);
    expect(data.health.conditions[0].notes).toBeUndefined();
    expect(data.lifestyle.profession).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('privado');
  });

  test('llama a next en caso de error', async () => {
    setupBasePrisma();
    prisma.profile.findUnique = jest.fn().mockRejectedValue(new Error('Crash'));
    const next = jest.fn();
    await complete(makeReq({ body: {} }), makeMockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
