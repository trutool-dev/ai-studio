'use strict';

/**
 * Tests unitarios para aiService.js — funciones de catálogo de ejercicios.
 * Cubre: buildUserContextPrompt y formatExercisesForPrompt (ahora exportadas).
 * Se testean directamente sin necesitar mockear Anthropic SDK.
 */

// ─── Mocks de dependencias de aiService ──────────────────────────────────────
jest.mock('../../backend/src/services/redis.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG'),
  disconnect: jest.fn(),
}));

jest.mock('../../backend/src/utils/logger.util', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mocking Anthropic SDK is not needed — we import buildUserContextPrompt directly
jest.mock('@anthropic-ai/sdk', () => jest.fn());

// ─── Importar funciones exportadas ────────────────────────────────────────────
const { buildUserContextPrompt, formatExercisesForPrompt, calculateMetabolism } =
  require('../../backend/src/services/aiService');

// ─── Datos de onboarding mínimos ──────────────────────────────────────────────
const MINIMAL_ONBOARDING = {
  physical: {
    age: 30,
    weight_kg: 80,
    height_cm: 175,
    gender: 'male',
    body_type: 'mesomorph',
    activity_level: 'moderate',
    goal: 'gain_muscle',
  },
  lifestyle: {
    profession: 'Developer',
    stress_level: 3,
    sleep_hours_usual: 7,
    sleep_quality: 'good',
    smoker: false,
  },
  training: {
    available_days_per_week: 4,
    max_session_duration_minutes: 60,
    has_gym_access: true,
    home_equipment: 'barbell',
    experience_level: 'intermediate',
    injuries_or_limitations: null,
  },
  nutrition: {
    diet_type: 'omnivore',
    meals_per_day_preferred: 3,
    food_restrictions: [],
  },
  health: { conditions: [] },
  motivation: { main_motivation: 'health', tracking_preference: 'basic' },
};

const SAMPLE_EXERCISES = [
  {
    id: 'uuid-1',
    externalId: 'EX001',
    name: 'Barbell Squat',
    bodyPart: 'upper legs',
    equipment: 'Barbell',
    target: 'quadriceps',
    secondaryMuscles: ['glutes', 'hamstrings'],
  },
  {
    id: 'uuid-2',
    externalId: 'EX002',
    name: 'Push Up',
    bodyPart: 'chest',
    equipment: 'Body Weight',
    target: 'pectorals',
    secondaryMuscles: [],
  },
];

// ─── Tests: buildUserContextPrompt ────────────────────────────────────────────

describe('buildUserContextPrompt — catálogo de ejercicios', () => {
  let metrics;

  beforeAll(() => {
    metrics = calculateMetabolism(MINIMAL_ONBOARDING.physical);
  });

  test('el prompt incluye CATÁLOGO DE EJERCICIOS cuando se pasan ejercicios', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, SAMPLE_EXERCISES);
    expect(prompt).toContain('CATÁLOGO DE EJERCICIOS DISPONIBLES');
  });

  test('el prompt incluye el número de ejercicios del catálogo', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, SAMPLE_EXERCISES);
    expect(prompt).toContain(`${SAMPLE_EXERCISES.length} ejercicios`);
  });

  test('el prompt incluye el nombre de cada ejercicio del catálogo', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, SAMPLE_EXERCISES);
    expect(prompt).toContain('Barbell Squat');
    expect(prompt).toContain('Push Up');
  });

  test('el prompt incluye el ID externo de cada ejercicio', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, SAMPLE_EXERCISES);
    expect(prompt).toContain('ID:EX001');
    expect(prompt).toContain('ID:EX002');
  });

  test('el prompt NO incluye la sección de catálogo cuando exercises es array vacío', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).not.toContain('CATÁLOGO DE EJERCICIOS DISPONIBLES');
  });

  test('el prompt NO incluye la sección de catálogo cuando exercises no se pasa', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null);
    expect(prompt).not.toContain('CATÁLOGO DE EJERCICIOS DISPONIBLES');
  });

  test('el prompt incluye los datos físicos del usuario (peso, objetivo)', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).toContain('80');
    expect(prompt).toContain('175');
    expect(prompt).toContain('gain_muscle');
  });

  test('el prompt incluye TMB y TDEE calculados', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).toContain('TMB:');
    expect(prompt).toContain('TDEE:');
    expect(prompt).toContain('Calorías objetivo:');
  });

  test('el prompt incluye extraContext cuando se proporciona', () => {
    const extraCtx = 'Contexto especial de prueba para el plan.';
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, extraCtx, []);
    expect(prompt).toContain(extraCtx);
  });

  test('el prompt NO incluye CONTEXTO ADICIONAL cuando extraContext es null', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).not.toContain('## CONTEXTO ADICIONAL');
  });

  test('el prompt incluye información de estilo de vida', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).toContain('Developer');
  });

  test('el prompt incluye información de entrenamiento', () => {
    const prompt = buildUserContextPrompt(MINIMAL_ONBOARDING, metrics, null, []);
    expect(prompt).toContain('barbell');
    expect(prompt).toContain('intermediate');
  });
});

// ─── Tests: formatExercisesForPrompt ─────────────────────────────────────────

describe('formatExercisesForPrompt — formato del catálogo', () => {
  test('el catálogo incluye zona corporal y equipamiento de cada ejercicio', () => {
    const formatted = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);
    expect(formatted).toContain('upper legs');
    expect(formatted).toContain('Barbell');
    expect(formatted).toContain('quadriceps');
  });

  test('el catálogo incluye músculos secundarios cuando existen', () => {
    const formatted = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);
    expect(formatted).toContain('glutes');
    expect(formatted).toContain('hamstrings');
  });

  test('el catálogo omite la línea de músculos secundarios cuando el array está vacío', () => {
    const formatted = formatExercisesForPrompt([SAMPLE_EXERCISES[1]]);
    expect(formatted).not.toMatch(/Músculos secundarios:\s*$/m);
  });

  test('usa externalId como ID del ejercicio (formato ID:XXXX)', () => {
    const formatted = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);
    expect(formatted).toContain('(ID:EX001)');
  });

  test('usa id interno si externalId es null', () => {
    const exerciseWithoutExternalId = {
      id: 'internal-uuid-xyz',
      externalId: null,
      name: 'Custom Exercise',
      bodyPart: 'back',
      equipment: 'Cable',
      target: 'lats',
      secondaryMuscles: [],
    };
    const formatted = formatExercisesForPrompt([exerciseWithoutExternalId]);
    expect(formatted).toContain('Custom Exercise');
    expect(formatted).toContain('internal-uuid-xyz');
  });

  test('devuelve string vacío o mensaje cuando el array está vacío', () => {
    const formatted = formatExercisesForPrompt([]);
    expect(typeof formatted).toBe('string');
  });

  test('formatea múltiples ejercicios separados', () => {
    const formatted = formatExercisesForPrompt(SAMPLE_EXERCISES);
    expect(formatted).toContain('Barbell Squat');
    expect(formatted).toContain('Push Up');
  });
});
