'use strict';

/**
 * SEC-28 (JB-01) y SEC-29 (JB-02 + SA-18) — contrato frontend ↔ backend del onboarding.
 *
 * Reproduce el payload REAL del frontend (OnboardingNutrition/Health/Training/Profile
 * y el POST /onboarding/complete con el store completo) contra el controlador con
 * Prisma en memoria y el SDK de Anthropic simulado (sin llamadas reales).
 */

jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));
jest.mock('../../backend/src/utils/logger.util', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../backend/src/services/exerciseSelector.service', () => ({
  getExercisesForProfile: jest.fn().mockResolvedValue([]),
  formatExercisesForPrompt: jest.fn().mockReturnValue(''),
}));

const mockCreate = jest.fn();
// Ruta explícita al paquete que carga aiService (backend/node_modules): sin esto Jest puede
// resolver otra copia del SDK y la llamada NO quedaría simulada.
jest.mock('../../backend/node_modules/@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const prisma = require('../../backend/src/prisma/client');
const ctrl = require('../../backend/src/controllers/onboarding.controller');
const aiService = require('../../backend/src/services/aiService');
const { buildExclusions, partitionMeals } = require('../../backend/src/validation/dietaryRestrictions');

const USER_ID = 'user-contract-1';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
const req = (body) => ({ user: { userId: USER_ID }, params: {}, query: {}, body });
const call = async (fn, body) => {
  const res = makeRes();
  const next = jest.fn();
  await fn(req(body), res, next);
  return { res, next, status: res.status.mock.calls[0] && res.status.mock.calls[0][0], json: res.json.mock.calls[0] && res.json.mock.calls[0][0] };
};

// Store del frontend tal y como lo envía OnboardingComplete.tsx
const FRONT_STORE = {
  goal: 'lose_weight',
  profile: { gender: 'female', age: 34, weight: 68, height: 165, bodyType: 'average' },
  lifestyle: { profession: 'Enfermera', workSchedule: 'flexible', stressLevel: 3 },
  training: { daysPerWeek: 3, equipment: ['home'], experience: 'beginner' },
  nutrition: { dietType: 'omnivore', restrictions: ['nuts', 'lactose'], budget: 'medium' },
  health: { conditions: ['diabetes', 'none_cond'], injuries: ['knee'] },
  motivation: { motivations: ['health'], previousAttempts: 'few', mainChallenge: 'constancia' },
};

beforeAll(() => {
  // Salvaguarda: nunca poner una API key si el SDK no está simulado
  if (!jest.isMockFunction(require('../../backend/node_modules/@anthropic-ai/sdk'))) {
    throw new Error('El SDK de Anthropic no está simulado');
  }
});

beforeEach(() => {
  prisma._reset();
  jest.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  aiService._resetClient();
  prisma._db.user.push({ id: USER_ID, email: 'c@test.local', health_consent_given_at: null, health_consent_version: null });
  // Respuesta truncada del modelo → se usa el plan de respaldo (y se captura el prompt)
  mockCreate.mockResolvedValue({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{' }], usage: { input_tokens: 10, output_tokens: 5 } });
});

afterAll(() => { delete process.env.ANTHROPIC_API_KEY; });

describe('SEC-28 — los datos de salud del frontend llegan al prompt', () => {
  test('flujo real: PUT nutrition/health + complete → alergias, lesión y condición en el prompt y fuera del fallback', async () => {
    // Paso nutrición (antes del consentimiento): las restricciones quedan pendientes
    const nut = await call(ctrl.saveNutrition, { diet_type: 'omnivore', restrictions: ['nuts', 'lactose'], budget: 'medium' });
    expect(nut.status).toBe(200);
    expect(nut.json.data.restrictions_pending_consent).toBe(true);

    // Paso salud: el frontend envía ids y healthConsent: true
    const health = await call(ctrl.saveHealth, { conditions: ['diabetes'], injuries: ['knee'], healthConsent: true });
    expect(health.status).toBe(200);
    expect(prisma._db.healthCondition.map((c) => c.condition_name)).toEqual(['Diabetes']);

    const done = await call(ctrl.complete, FRONT_STORE);
    expect(done.next).not.toHaveBeenCalled();
    expect(done.status).toBe(201);

    // Guardado en BD
    expect(prisma._db.foodRestriction.map((r) => r.food_name).sort()).toEqual(['Frutos secos', 'Lactosa (lácteos)']);
    expect(prisma._db.foodRestriction.every((r) => r.severity)).toBe(true);
    expect(prisma._db.trainingPreferences[0].injuries_or_limitations).toBe('knee');

    // Llega al prompt
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('RESTRICCIONES ALIMENTARIAS');
    expect(prompt).toContain('Frutos secos');
    expect(prompt).toContain('Lactosa');
    expect(prompt).toContain('rodilla');
    expect(prompt).toContain('Diabetes');
    // La profesión no se envía (minimización)
    expect(prompt).not.toContain('Enfermera');

    // El plan (respaldo) no contiene frutos secos ni lácteos
    const plan = done.json.data.generated_plan;
    expect(plan.generated_by_ai).toBe(false);
    const { rejected } = partitionMeals(plan.nutrition_plan.meal_suggestions, buildExclusions([{ food_name: 'Frutos secos' }, { food_name: 'Lactosa' }]));
    expect(rejected).toEqual([]);
    const allText = JSON.stringify(plan.nutrition_plan.meal_suggestions).toLowerCase();
    expect(allText).not.toMatch(/nuez|nueces|yogur|leche|queso/);
    // Lesión de rodilla: sin sentadillas en el respaldo
    expect(JSON.stringify(plan.training_plan)).not.toContain('Sentadillas');
    // Aviso médico por condición declarada
    expect(plan.notes).toMatch(/médico/);
  });

  test('las restricciones nunca se truncan aunque otros campos sean largos', () => {
    const metrics = aiService.calculateMetabolism({ age: 30, weight_kg: 70, height_cm: 170, gender: 'male', goal: 'maintain' });
    const many = Array.from({ length: 20 }, (_, i) => ({ condition_name: `Condición larga ${i} `.padEnd(100, 'x'), condition_type: 'disease' }));
    const prompt = aiService.buildUserContextPrompt({
      physical: { age: 30, weight_kg: 70, height_cm: 170, gender: 'male', goal: 'maintain' },
      lifestyle: { profession: 'x'.repeat(100) },
      training: { available_days_per_week: 3, injuries_or_limitations: 'knee, lower_back' },
      nutrition: { food_restrictions: [{ restriction_type: 'allergy', food_name: 'Frutos secos' }] },
      health: { conditions: many },
    }, metrics, null, []);
    expect(prompt.indexOf('Frutos secos')).toBeGreaterThan(-1);
    expect(prompt.indexOf('Frutos secos')).toBeLessThan(prompt.indexOf('Condición larga 0'));
    expect(prompt).toContain('espalda');
  });

  test.each(['keto', 'other'])('dieta %s → 2xx (sin 500 por enum)', async (diet) => {
    await call(ctrl.saveHealth, { conditions: [], injuries: [], healthConsent: true });
    const nut = await call(ctrl.saveNutrition, { diet_type: diet, restrictions: [], budget: 'low' });
    expect(nut.status).toBe(200);
    const done = await call(ctrl.complete, { ...FRONT_STORE, nutrition: { dietType: diet, restrictions: [], budget: 'low' } });
    expect(done.next).not.toHaveBeenCalled();
    expect(done.status).toBe(201);
    expect(prisma._db.nutritionPreferences[0].diet_type).toBeNull();
  });

  test('objetivos del frontend (stay_active / improve_habits) se mapean al enum', async () => {
    await call(ctrl.saveHealth, { healthConsent: true });
    const done = await call(ctrl.complete, { ...FRONT_STORE, goal: 'stay_active' });
    expect(done.status).toBe(201);
    expect(prisma._db.profile[0].goal).toBe('maintain');
  });

  test('PUT /training con el formato del frontend (days_per_week, equipment[], experience)', async () => {
    const r = await call(ctrl.saveTraining, { days_per_week: 4, equipment: ['gym', 'home'], experience: 'intermediate' });
    expect(r.status).toBe(200);
    expect(prisma._db.trainingPreferences[0]).toEqual(expect.objectContaining({
      available_days_per_week: 4, has_gym_access: true, home_equipment: 'full', experience_level: 'intermediate',
    }));
  });

  test('PUT /profile con el formato del frontend (age, sin name ni birthdate)', async () => {
    const r = await call(ctrl.saveProfile, { goal: 'improve_habits', gender: 'other', age: 40, weight_kg: 80, height_cm: 180, body_type: 'slim' });
    expect(r.status).toBe(200);
    expect(prisma._db.profile[0]).toEqual(expect.objectContaining({ name: 'Usuario', goal: 'general_health', body_type: 'ectomorph', gender: 'other' }));
  });

  test('PUT /lifestyle y /motivation con el formato del frontend', async () => {
    expect((await call(ctrl.saveLifestyle, { profession: 'Dev', work_schedule: 'flexible', stress_level: 2 })).status).toBe(200);
    expect(prisma._db.lifestyleProfile[0].usual_schedule).toBeNull();
    expect((await call(ctrl.saveMotivation, { motivations: ['appearance'], previous_attempts: 'many', main_challenge: 'tiempo' })).status).toBe(200);
    expect(prisma._db.motivationProfile[0]).toEqual(expect.objectContaining({ main_motivation: 'aesthetics', previous_attempts: true }));
  });
});

describe('SEC-29 — edad mínima y rangos fisiológicos', () => {
  beforeEach(async () => { await call(ctrl.saveHealth, { healthConsent: true }); });

  test('complete con edad 14 → 400 AGE_RESTRICTION y sin llamada a la IA', async () => {
    const done = await call(ctrl.complete, { ...FRONT_STORE, profile: { ...FRONT_STORE.profile, age: 14 } });
    expect(done.status).toBe(400);
    expect(done.json.error).toBe('AGE_RESTRICTION');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(prisma._db.profile).toHaveLength(0);
  });

  test('PUT /profile con edad 15 → 400 AGE_RESTRICTION', async () => {
    const r = await call(ctrl.saveProfile, { age: 15, weight_kg: 60, height_cm: 160 });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('AGE_RESTRICTION');
  });

  test('PUT /profile con birthdate futura o inválida → 400', async () => {
    expect((await call(ctrl.saveProfile, { name: 'X', birthdate: '2999-01-01' })).status).toBe(400);
    expect((await call(ctrl.saveProfile, { name: 'X', birthdate: 'no-es-fecha' })).status).toBe(400);
    expect((await call(ctrl.saveProfile, { name: 'X' })).status).toBe(400);
  });

  test.each([
    [{ weight: 20 }, 'weight_kg'],
    [{ weight: 400 }, 'weight_kg'],
    [{ height: 60 }, 'height_cm'],
    [{ height: 300 }, 'height_cm'],
    [{ age: 130 }, 'age'],
    [{ age: 30.5 }, 'age'],
    [{ weight: 'abc' }, 'weight_kg'],
  ])('complete con %j → 400 VALIDATION_ERROR (%s)', async (patch, field) => {
    const done = await call(ctrl.complete, { ...FRONT_STORE, profile: { ...FRONT_STORE.profile, ...patch } });
    expect(done.status).toBe(400);
    expect(done.json.error).toBe('VALIDATION_ERROR');
    expect(done.json.details[0].field).toBe(field);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('perfil guardado previamente con menor de edad → 400 antes de la IA', async () => {
    const birthdate = new Date();
    birthdate.setFullYear(birthdate.getFullYear() - 12);
    prisma._db.profile.push({ id: 'p1', user_id: USER_ID, name: 'Legacy', birthdate, weight_kg: 40, height_cm: 150, goal: 'lose_weight' });
    prisma._db.trainingPreferences.push({ id: 't1', user_id: USER_ID, available_days_per_week: 3, home_equipment: 'none', has_gym_access: false });
    const done = await call(ctrl.complete, {});
    expect(done.status).toBe(400);
    expect(done.json.error).toBe('AGE_RESTRICTION');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('edad 16 exacta se acepta', async () => {
    const done = await call(ctrl.complete, { ...FRONT_STORE, profile: { ...FRONT_STORE.profile, age: 16 } });
    expect(done.status).toBe(201);
  });
});
