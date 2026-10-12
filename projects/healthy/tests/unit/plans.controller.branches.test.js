'use strict';

/**
 * Tests de branches para plans.controller.js.
 * Cubre las ramas no alcanzadas: líneas 30, 52, 79, 90, 112, 127.
 *
 * Ramas clave:
 * - getActivePlan: rama plan null
 * - getPlanById: rama plan null
 * - regeneratePlan: rama profile/training null, injuries con string, nutrition presente/ausente,
 *                  health con conditions, catalogExercises.length > 0
 * - pausePlan: rama plan null, plan ya pausado
 */

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1500, tdee: 2000, target_calories: 1800 }),
  generatePlan: jest.fn().mockResolvedValue({
    training_plan: { weeks: 4, sessions_per_week: 3, weekly_schedule: [] },
    nutrition_plan: { daily_calories: 1800, macros: {}, meals_per_day: 3, meal_suggestions: [] },
    generated_by_ai: true,
    model_version: 'mock',
  }),
  regeneratePlan: jest.fn().mockResolvedValue({
    training_plan: { weeks: 4, sessions_per_week: 3, weekly_schedule: [] },
    nutrition_plan: { daily_calories: 1800, macros: {}, meals_per_day: 3, meal_suggestions: [] },
    generated_by_ai: true,
    model_version: 'mock',
  }),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
}));

jest.mock('../../backend/src/services/exerciseSelector.service', () => ({
  getExercisesForProfile: jest.fn().mockResolvedValue([]),
  formatExercisesForPrompt: jest.fn().mockReturnValue(''),
}));

const prisma = require('../../backend/src/prisma/client');
const {
  getActivePlan,
  getPlanById,
  regeneratePlan,
  pausePlan,
} = require('../../backend/src/controllers/plans.controller');

function makeReq(overrides = {}) {
  return {
    user: { userId: 'user-plans-test' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function makeMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── getActivePlan ─────────────────────────────────────────────────────────────

describe('getActivePlan — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando no hay plan activo (branch !plan)', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq();
    const res = makeMockRes();

    await getActivePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND' })
    );
  });

  test('devuelve el plan cuando existe', async () => {
    const fakePlan = { id: 'plan-1', status: 'active', training_sessions: [], meals: [] };
    prisma.plan.findFirst = jest.fn().mockResolvedValue(fakePlan);
    const req = makeReq();
    const res = makeMockRes();

    await getActivePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: fakePlan }) })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.plan.findFirst = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq();
    const res = makeMockRes();
    const next = jest.fn();

    await getActivePlan(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── getPlanById ───────────────────────────────────────────────────────────────

describe('getPlanById — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando el plan no existe (branch !plan)', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-plan' } });
    const res = makeMockRes();

    await getPlanById(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND' })
    );
  });

  test('devuelve el plan cuando existe', async () => {
    const fakePlan = { id: 'plan-2', status: 'active', training_sessions: [], meals: [] };
    prisma.plan.findFirst = jest.fn().mockResolvedValue(fakePlan);
    const req = makeReq({ params: { id: 'plan-2' } });
    const res = makeMockRes();

    await getPlanById(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.plan.findFirst = jest.fn().mockRejectedValue(new Error('Timeout'));
    const req = makeReq({ params: { id: 'x' } });
    const res = makeMockRes();
    const next = jest.fn();

    await getPlanById(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── regeneratePlan ────────────────────────────────────────────────────────────

describe('regeneratePlan — branches', () => {
  const aiService = require('../../backend/src/services/aiService');
  const exerciseSelector = require('../../backend/src/services/exerciseSelector.service');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupBasePrisma() {
    prisma.profile.findUnique = jest.fn().mockResolvedValue({
      birthdate: new Date('1990-01-01'),
      weight_kg: 75,
      height_cm: 175,
      gender: 'male',
      body_type: 'mesomorph',
      activity_level: 'moderate',
      goal: 'lose_weight',
    });
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue({
      available_days_per_week: 3,
      max_session_duration_minutes: 60,
      has_gym_access: true,
      home_equipment: 'none',
      experience_level: 'beginner',
      injuries_or_limitations: null,
    });
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.progressLog.findMany = jest.fn().mockResolvedValue([]);
    prisma.plan.updateMany = jest.fn().mockResolvedValue({});
    prisma.plan.create = jest.fn().mockResolvedValue({ id: 'new-plan', status: 'active', start_date: new Date(), end_date: new Date(), generated_by_ai: true });
  }

  test('devuelve 400 cuando profile o training es null', async () => {
    prisma.profile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.progressLog.findMany = jest.fn().mockResolvedValue([]);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'ONBOARDING_INCOMPLETE' })
    );
  });

  test('regenera plan correctamente cuando hay datos completos', async () => {
    setupBasePrisma();
    const req = makeReq({ body: { reason: 'manual_request' } });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(aiService.regeneratePlan).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('maneja injuries con string (branch injuries split)', async () => {
    setupBasePrisma();
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      available_days_per_week: 3,
      max_session_duration_minutes: 60,
      has_gym_access: false,
      home_equipment: 'dumbbells',
      experience_level: 'intermediate',
      injuries_or_limitations: 'shoulder, knee',
    });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(exerciseSelector.getExercisesForProfile).toHaveBeenCalledWith(
      expect.objectContaining({ injuries: expect.arrayContaining(['shoulder', 'knee']) }),
      80
    );
  });

  test('usa catálogo de ejercicios cuando está disponible (branch catalogExercises.length > 0)', async () => {
    setupBasePrisma();
    exerciseSelector.getExercisesForProfile.mockResolvedValue([
      { id: 'ex-1', name: 'Squat', externalId: '101', category: 'Legs', bodyPart: 'legs', equipment: 'Body Weight', target: 'quads', secondaryMuscles: [], instructionsEs: null, difficulty: 'beginner' },
    ]);
    exerciseSelector.formatExercisesForPrompt.mockReturnValue('- Squat (ID:101)');

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(exerciseSelector.formatExercisesForPrompt).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('maneja nutrition presente (branch nutrition ? en onboardingData)', async () => {
    setupBasePrisma();
    prisma.nutritionPreferences.findUnique.mockResolvedValue({ diet_type: 'vegan', meals_per_day_preferred: 3 });
    prisma.foodRestriction.findMany.mockResolvedValue([{ restriction_type: 'allergy', food_name: 'Nuts' }]);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('maneja health con conditions (branch health: healthConditions.length > 0)', async () => {
    setupBasePrisma();
    prisma.healthCondition.findMany.mockResolvedValue([
      { condition_name: 'Asthma', condition_type: 'respiratory' },
    ]);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await regeneratePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.profile.findUnique = jest.fn().mockRejectedValue(new Error('Crash'));
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.progressLog.findMany = jest.fn().mockResolvedValue([]);

    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await regeneratePlan(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── pausePlan ─────────────────────────────────────────────────────────────────

describe('pausePlan — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando el plan no existe (branch !plan)', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'bad-plan' } });
    const res = makeMockRes();

    await pausePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND' })
    );
  });

  test('devuelve 400 cuando el plan ya está pausado (branch plan.status === paused)', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue({ id: 'plan-p', status: 'paused' });
    const req = makeReq({ params: { id: 'plan-p' } });
    const res = makeMockRes();

    await pausePlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PLAN_ALREADY_PAUSED' })
    );
  });

  test('pausa el plan cuando está activo', async () => {
    prisma.plan.findFirst = jest.fn().mockResolvedValue({ id: 'plan-a', status: 'active' });
    prisma.plan.update = jest.fn().mockResolvedValue({ id: 'plan-a', status: 'paused' });
    const req = makeReq({ params: { id: 'plan-a' } });
    const res = makeMockRes();

    await pausePlan(req, res, jest.fn());

    expect(prisma.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'paused' } })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.plan.findFirst = jest.fn().mockRejectedValue(new Error('Error'));
    const req = makeReq({ params: { id: 'x' } });
    const res = makeMockRes();
    const next = jest.fn();

    await pausePlan(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
