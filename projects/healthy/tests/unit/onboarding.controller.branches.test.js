'use strict';

/**
 * Tests de branches para onboarding.controller.js.
 * Cubre las ramas no alcanzadas: líneas 32, 60, 76, 92, 108, 138, 154, 178-179, 224-227, 238, 313.
 *
 * Ramas clave:
 * - start: try/catch (next en error)
 * - saveProfile: rama birthdate undefined, rama age >= 16 (válido), error
 * - saveLifestyle: error
 * - saveTraining: rama has_gym_access ?? false
 * - saveNutrition: error
 * - saveHealth: rama conditions vacío, rama food_restrictions vacío, rama consent ya dado
 * - saveMotivation: error
 * - complete: rama profile null, rama training null, rama answers.length > 0,
 *             rama catalogExercises.length > 0, rama trainingSessions.length > 0,
 *             rama meals.length > 0
 */

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1500, tdee: 2000, target_calories: 1800 }),
  generatePlan: jest.fn().mockResolvedValue({
    training_plan: {
      weeks: 2,
      sessions_per_week: 3,
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
  }),
  regeneratePlan: jest.fn(),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
}));

jest.mock('../../backend/src/services/exerciseSelector.service', () => ({
  getExercisesForProfile: jest.fn().mockResolvedValue([]),
  formatExercisesForPrompt: jest.fn().mockReturnValue(''),
}));

const prisma = require('../../backend/src/prisma/client');
const {
  start,
  saveProfile,
  saveLifestyle,
  saveTraining,
  saveNutrition,
  saveHealth,
  saveMotivation,
  complete,
} = require('../../backend/src/controllers/onboarding.controller');

function makeReq(overrides = {}) {
  return {
    user: { userId: 'user-onboarding-test' },
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

// ─── start ─────────────────────────────────────────────────────────────────────

describe('start', () => {
  test('devuelve 200 con user_id', async () => {
    const req = makeReq();
    const res = makeMockRes();
    await start(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ user_id: 'user-onboarding-test' }) })
    );
  });
});

// ─── saveProfile ──────────────────────────────────────────────────────────────

describe('saveProfile — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('permite guardar perfil sin birthdate (branch birthdate undefined)', async () => {
    prisma.profile.upsert = jest.fn().mockResolvedValue({ id: 'profile-1', user_id: 'user-onboarding-test' });
    const req = makeReq({ body: { name: 'Test', gender: 'male', weight_kg: 75, height_cm: 175 } });
    const res = makeMockRes();

    await saveProfile(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rechaza usuario menor de 16 años (branch age < 16)', async () => {
    const req = makeReq({ body: { birthdate: '2020-01-01' } }); // ~6 años
    const res = makeMockRes();

    await saveProfile(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'AGE_RESTRICTION' })
    );
  });

  test('permite usuario de exactamente 16 años o más (branch age >= 16)', async () => {
    const birthdate = new Date();
    birthdate.setFullYear(birthdate.getFullYear() - 18);
    prisma.profile.upsert = jest.fn().mockResolvedValue({ id: 'profile-1' });
    const req = makeReq({ body: { birthdate: birthdate.toISOString(), name: 'Test', gender: 'male' } });
    const res = makeMockRes();

    await saveProfile(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.profile.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { name: 'Test' } });
    const res = makeMockRes();
    const next = jest.fn();

    await saveProfile(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveLifestyle ─────────────────────────────────────────────────────────────

describe('saveLifestyle — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('guarda estilo de vida correctamente', async () => {
    prisma.lifestyleProfile.upsert = jest.fn().mockResolvedValue({ id: 'ls-1' });
    const req = makeReq({ body: { profession: 'Developer', work_type: 'office' } });
    const res = makeMockRes();

    await saveLifestyle(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.lifestyleProfile.upsert = jest.fn().mockRejectedValue(new Error('DB timeout'));
    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await saveLifestyle(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveTraining ──────────────────────────────────────────────────────────────

describe('saveTraining — branches has_gym_access', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usa false cuando has_gym_access no está definido (branch ?? false)', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockResolvedValue({ id: 'tp-1' });
    const req = makeReq({ body: { available_days_per_week: 3 } }); // sin has_gym_access
    const res = makeMockRes();

    await saveTraining(req, res, jest.fn());

    expect(prisma.trainingPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ has_gym_access: false }),
        update: expect.objectContaining({ has_gym_access: false }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('usa el valor provisto cuando has_gym_access es true', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockResolvedValue({ id: 'tp-2' });
    const req = makeReq({ body: { available_days_per_week: 4, has_gym_access: true } });
    const res = makeMockRes();

    await saveTraining(req, res, jest.fn());

    expect(prisma.trainingPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ has_gym_access: true }),
      })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.trainingPreferences.upsert = jest.fn().mockRejectedValue(new Error('Error'));
    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await saveTraining(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveNutrition ─────────────────────────────────────────────────────────────

describe('saveNutrition — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('guarda preferencias nutricionales', async () => {
    prisma.nutritionPreferences.upsert = jest.fn().mockResolvedValue({ id: 'np-1' });
    const req = makeReq({ body: { diet_type: 'omnivore', meals_per_day_preferred: 3 } });
    const res = makeMockRes();

    await saveNutrition(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.nutritionPreferences.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await saveNutrition(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveHealth ────────────────────────────────────────────────────────────────

describe('saveHealth — branches conditions vacío, consent ya dado', () => {
  beforeEach(() => jest.clearAllMocks());

  test('no borra conditions cuando el array está vacío (branch conditions.length > 0 falso)', async () => {
    prisma.healthCondition.deleteMany = jest.fn();
    prisma.healthCondition.createMany = jest.fn();
    prisma.foodRestriction.deleteMany = jest.fn();
    prisma.foodRestriction.createMany = jest.fn();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ health_consent_given_at: null });
    prisma.user.update = jest.fn().mockResolvedValue({});

    const req = makeReq({ body: { conditions: [], food_restrictions: [] } });
    const res = makeMockRes();

    await saveHealth(req, res, jest.fn());

    expect(prisma.healthCondition.deleteMany).not.toHaveBeenCalled();
    expect(prisma.foodRestriction.deleteMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('guarda conditions cuando el array no está vacío (branch conditions.length > 0 verdadero)', async () => {
    prisma.healthCondition.deleteMany = jest.fn().mockResolvedValue({});
    prisma.healthCondition.createMany = jest.fn().mockResolvedValue({});
    prisma.foodRestriction.deleteMany = jest.fn();
    prisma.foodRestriction.createMany = jest.fn();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ health_consent_given_at: null });
    prisma.user.update = jest.fn().mockResolvedValue({});

    const req = makeReq({ body: { conditions: [{ condition_name: 'Diabetes', condition_type: 'chronic' }], food_restrictions: [] } });
    const res = makeMockRes();

    await saveHealth(req, res, jest.fn());

    expect(prisma.healthCondition.deleteMany).toHaveBeenCalled();
    expect(prisma.healthCondition.createMany).toHaveBeenCalled();
  });

  test('guarda food_restrictions cuando el array no está vacío', async () => {
    prisma.healthCondition.deleteMany = jest.fn();
    prisma.healthCondition.createMany = jest.fn();
    prisma.foodRestriction.deleteMany = jest.fn().mockResolvedValue({});
    prisma.foodRestriction.createMany = jest.fn().mockResolvedValue({});
    prisma.user.findUnique = jest.fn().mockResolvedValue({ health_consent_given_at: null });
    prisma.user.update = jest.fn().mockResolvedValue({});

    const req = makeReq({ body: { conditions: [], food_restrictions: [{ restriction_type: 'allergy', food_name: 'Gluten' }] } });
    const res = makeMockRes();

    await saveHealth(req, res, jest.fn());

    expect(prisma.foodRestriction.deleteMany).toHaveBeenCalled();
    expect(prisma.foodRestriction.createMany).toHaveBeenCalled();
  });

  test('no actualiza consent cuando ya fue dado (branch !user.health_consent_given_at falso)', async () => {
    prisma.healthCondition.deleteMany = jest.fn();
    prisma.foodRestriction.deleteMany = jest.fn();
    prisma.user.findUnique = jest.fn().mockResolvedValue({ health_consent_given_at: new Date() }); // ya dado
    prisma.user.update = jest.fn();

    const req = makeReq({ body: { conditions: [], food_restrictions: [] } });
    const res = makeMockRes();

    await saveHealth(req, res, jest.fn());

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { conditions: [], food_restrictions: [] } });
    const res = makeMockRes();
    const next = jest.fn();

    await saveHealth(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── saveMotivation ───────────────────────────────────────────────────────────

describe('saveMotivation — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('guarda perfil de motivación', async () => {
    prisma.motivationProfile.upsert = jest.fn().mockResolvedValue({ id: 'mp-1' });
    const req = makeReq({ body: { main_motivation: 'health', previous_attempts: false } });
    const res = makeMockRes();

    await saveMotivation(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.motivationProfile.upsert = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await saveMotivation(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── complete ─────────────────────────────────────────────────────────────────

describe('complete — branches profile/training null, answers, exercises, meals', () => {
  const aiService = require('../../backend/src/services/aiService');
  const exerciseSelector = require('../../backend/src/services/exerciseSelector.service');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupBasePrisma() {
    prisma.profile.findUnique = jest.fn().mockResolvedValue({
      id: 'p-1',
      user_id: 'user-onboarding-test',
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
    prisma.onboardingAnswer.deleteMany = jest.fn().mockResolvedValue({});
    prisma.onboardingAnswer.createMany = jest.fn().mockResolvedValue({});
    prisma.profile.update = jest.fn().mockResolvedValue({});
    prisma.plan.updateMany = jest.fn().mockResolvedValue({});
    prisma.plan.create = jest.fn().mockResolvedValue({ id: 'plan-new', status: 'active', start_date: new Date(), end_date: new Date(), generated_by_ai: true });
    prisma.trainingSession.createMany = jest.fn().mockResolvedValue({});
    prisma.meal.createMany = jest.fn().mockResolvedValue({});
  }

  test('devuelve 400 cuando profile es null (branch !profile)', async () => {
    prisma.profile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue({ id: 'tp-1' });
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PROFILE_REQUIRED' })
    );
  });

  test('devuelve 400 cuando training es null (branch !training)', async () => {
    prisma.profile.findUnique = jest.fn().mockResolvedValue({ id: 'p-1', birthdate: new Date('1990-01-01') });
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'TRAINING_REQUIRED' })
    );
  });

  test('guarda answers cuando answers.length > 0 (branch)', async () => {
    setupBasePrisma();
    const req = makeReq({ body: { answers: [{ question_key: 'q1', answer_value: 'a1' }] } });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.onboardingAnswer.deleteMany).toHaveBeenCalled();
    expect(prisma.onboardingAnswer.createMany).toHaveBeenCalled();
  });

  test('no guarda answers cuando answers está vacío (branch answers.length > 0 falso)', async () => {
    setupBasePrisma();
    const req = makeReq({ body: { answers: [] } });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.onboardingAnswer.deleteMany).not.toHaveBeenCalled();
    expect(prisma.onboardingAnswer.createMany).not.toHaveBeenCalled();
  });

  test('usa ejercicios del catálogo cuando hay ejercicios disponibles (branch catalogExercises.length > 0)', async () => {
    setupBasePrisma();
    exerciseSelector.getExercisesForProfile.mockResolvedValue([
      { id: 'ex-1', name: 'Push Up', externalId: '001', category: 'Chest', bodyPart: 'chest', equipment: 'Body Weight', target: 'pectorals', secondaryMuscles: [], instructionsEs: null, difficulty: 'beginner' },
    ]);
    exerciseSelector.formatExercisesForPrompt.mockReturnValue('- Push Up (ID:001)');

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(exerciseSelector.formatExercisesForPrompt).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('crea sessions de entrenamiento cuando hay sesiones en el plan', async () => {
    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({
      training_plan: {
        weeks: 1,
        sessions_per_week: 1,
        weekly_schedule: [
          { day_of_week: 1, session_type: 'strength', notes: 'Chest' },
        ],
      },
      nutrition_plan: {
        daily_calories: 1800,
        macros: {},
        meals_per_day: 3,
        meal_suggestions: [],
      },
      generated_by_ai: true,
      model_version: 'mock',
    });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.trainingSession.createMany).toHaveBeenCalled();
  });

  test('NO crea sessions cuando todas son rest (branch trainingSessions.length > 0 falso)', async () => {
    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({
      training_plan: {
        weeks: 1,
        sessions_per_week: 0,
        weekly_schedule: [
          { day_of_week: 1, session_type: 'rest', notes: '' },
          { day_of_week: 2, session_type: 'rest', notes: '' },
        ],
      },
      nutrition_plan: {
        daily_calories: 1800,
        macros: {},
        meals_per_day: 3,
        meal_suggestions: [],
      },
      generated_by_ai: true,
      model_version: 'mock',
    });

    prisma.trainingSession.createMany = jest.fn();

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.trainingSession.createMany).not.toHaveBeenCalled();
  });

  test('crea meals cuando hay meal_suggestions', async () => {
    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({
      training_plan: {
        weeks: 1,
        sessions_per_week: 0,
        weekly_schedule: [],
      },
      nutrition_plan: {
        daily_calories: 1800,
        macros: {},
        meals_per_day: 2,
        meal_suggestions: [
          { meal_type: 'breakfast', approximate_calories: 400, protein_g: 30, carbs_g: 50, fat_g: 10 },
          { meal_type: 'lunch', approximate_calories: 600, protein_g: 40, carbs_g: 70, fat_g: 15 },
        ],
      },
      generated_by_ai: true,
      model_version: 'mock',
    });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.meal.createMany).toHaveBeenCalled();
  });

  test('NO crea meals cuando meal_suggestions está vacío', async () => {
    setupBasePrisma();
    aiService.generatePlan.mockResolvedValue({
      training_plan: { weeks: 1, sessions_per_week: 0, weekly_schedule: [] },
      nutrition_plan: { daily_calories: 1800, macros: {}, meals_per_day: 0, meal_suggestions: [] },
      generated_by_ai: true,
      model_version: 'mock',
    });

    prisma.meal.createMany = jest.fn();

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(prisma.meal.createMany).not.toHaveBeenCalled();
  });

  test('maneja injuries_or_limitations con string (branch split)', async () => {
    setupBasePrisma();
    prisma.trainingPreferences.findUnique.mockResolvedValue({
      available_days_per_week: 3,
      max_session_duration_minutes: 60,
      has_gym_access: false,
      home_equipment: 'none',
      experience_level: 'intermediate',
      injuries_or_limitations: 'knee, lower_back',
    });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(exerciseSelector.getExercisesForProfile).toHaveBeenCalledWith(
      expect.objectContaining({ injuries: expect.arrayContaining(['knee', 'lower_back']) }),
      80
    );
  });

  test('maneja nutrition presente (branch nutrition ?)', async () => {
    setupBasePrisma();
    prisma.nutritionPreferences.findUnique.mockResolvedValue({
      diet_type: 'vegan',
      meals_per_day_preferred: 4,
    });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('maneja healthConditions no vacío (branch health: healthConditions.length > 0)', async () => {
    setupBasePrisma();
    prisma.healthCondition.findMany.mockResolvedValue([
      { condition_name: 'Diabetes', condition_type: 'chronic', affects_training: false, affects_nutrition: true, notes: null },
    ]);

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('maneja motivation no null (branch motivation ||  undefined)', async () => {
    setupBasePrisma();
    prisma.motivationProfile.findUnique.mockResolvedValue({ main_motivation: 'health', previous_attempts: false });

    const req = makeReq({ body: {} });
    const res = makeMockRes();

    await complete(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('llama a next en caso de error', async () => {
    prisma.profile.findUnique = jest.fn().mockRejectedValue(new Error('Crash'));
    prisma.lifestyleProfile.findUnique = jest.fn().mockResolvedValue(null);
    prisma.trainingPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.nutritionPreferences.findUnique = jest.fn().mockResolvedValue(null);
    prisma.healthCondition.findMany = jest.fn().mockResolvedValue([]);
    prisma.foodRestriction.findMany = jest.fn().mockResolvedValue([]);
    prisma.motivationProfile.findUnique = jest.fn().mockResolvedValue(null);

    const req = makeReq({ body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await complete(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
