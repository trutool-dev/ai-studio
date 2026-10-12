'use strict';

/**
 * Tests de integración para GET /exercises y GET /exercises/:id.
 * El router crea su propio PrismaClient con PrismaPg+Pool internamente,
 * por lo que mockeamos @prisma/adapter-pg, pg y ../generated/prisma
 * para controlar las respuestas de BD sin conexión real.
 *
 * Implementa: TEST-EX-03
 */

// ─── Mocks de infraestructura PG/Prisma ───────────────────────────────────────

// Mapa de ejercicios en memoria que controla el comportamiento del mock
const exercisesDb = [];

const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCount = jest.fn();
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockPoolEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    end: mockPoolEnd,
  })),
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../backend/src/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    exercise: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
    },
    $disconnect: mockDisconnect,
  })),
}));

// ─── Mock de servicios externos ───────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1749, tdee: 2711, target_calories: 2168 }),
  generatePlan: jest.fn().mockResolvedValue({
    training_plan: { weeks: 4, sessions_per_week: 3, weekly_schedule: [] },
    nutrition_plan: { daily_calories: 2168, macros: {}, meals_per_day: 3, meal_suggestions: [] },
    notes: 'Mock plan',
    generated_at: new Date().toISOString(),
    model_version: 'mock',
    generated_by_ai: true,
    metabolism_metrics: { bmr: 1749, tdee: 2711, target_calories: 2168 },
  }),
  regeneratePlan: jest.fn().mockResolvedValue({}),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
  generateFallbackPlan: jest.fn().mockReturnValue({}),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Generamos un JWT válido para los tests autenticados
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

const app = require('../../backend/src/app');

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const SAMPLE_EXERCISES = [
  {
    id: 'uuid-ex-001',
    externalId: 'EX001',
    name: 'Barbell Squat',
    category: 'Legs',
    bodyPart: 'upper legs',
    equipment: 'Barbell',
    target: 'quadriceps',
    secondaryMuscles: ['glutes', 'hamstrings'],
    gifUrl: 'https://example.com/squat.gif',
    thumbnailUrl: null,
    difficulty: 'intermediate',
  },
  {
    id: 'uuid-ex-002',
    externalId: 'EX002',
    name: 'Push Up',
    category: 'Chest',
    bodyPart: 'chest',
    equipment: 'Body Weight',
    target: 'pectorals',
    secondaryMuscles: [],
    gifUrl: null,
    thumbnailUrl: null,
    difficulty: 'beginner',
  },
  {
    id: 'uuid-ex-003',
    externalId: 'EX003',
    name: 'Dumbbell Curl',
    category: 'Arms',
    bodyPart: 'upper arms',
    equipment: 'Dumbbell',
    target: 'biceps brachii',
    secondaryMuscles: ['brachialis'],
    gifUrl: 'https://example.com/curl.gif',
    thumbnailUrl: null,
    difficulty: 'beginner',
  },
  {
    id: 'uuid-ex-004',
    externalId: 'EX004',
    name: 'Lat Pulldown',
    category: 'Back',
    bodyPart: 'back',
    equipment: 'Cable',
    target: 'lats',
    secondaryMuscles: ['biceps brachii'],
    gifUrl: null,
    thumbnailUrl: null,
    difficulty: 'beginner',
  },
  {
    id: 'uuid-ex-005',
    externalId: 'EX005',
    name: 'Running',
    category: 'Cardio',
    bodyPart: 'cardiovascular system',
    equipment: 'Body Weight',
    target: 'cardiovascular system',
    secondaryMuscles: [],
    gifUrl: null,
    thumbnailUrl: null,
    difficulty: 'beginner',
  },
];

// ─── Helper: generar JWT válido ───────────────────────────────────────────────

function makeToken(userId = 'test-user-id') {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

function authHeader(token) {
  return `Bearer ${token}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /exercises — sin autenticación
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /exercises — autenticación', () => {
  test('devuelve 401 sin token de autenticación', async () => {
    const res = await request(app).get('/exercises');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('devuelve 401 con token malformado', async () => {
    const res = await request(app)
      .get('/exercises')
      .set('Authorization', 'Bearer token-invalido-xxx');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /exercises — con autenticación válida
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /exercises — con auth válida', () => {
  let token;

  beforeAll(() => {
    token = makeToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 200 con estructura { success, data: { exercises, total } }', async () => {
    mockFindMany.mockResolvedValueOnce(SAMPLE_EXERCISES);
    mockCount.mockResolvedValueOnce(SAMPLE_EXERCISES.length);

    const res = await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('exercises');
    expect(res.body.data).toHaveProperty('total');
    expect(Array.isArray(res.body.data.exercises)).toBe(true);
    expect(res.body.data.total).toBe(SAMPLE_EXERCISES.length);
  });

  test('devuelve los ejercicios con los campos correctos', async () => {
    mockFindMany.mockResolvedValueOnce([SAMPLE_EXERCISES[0]]);
    mockCount.mockResolvedValueOnce(1);

    const res = await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const exercise = res.body.data.exercises[0];
    expect(exercise).toHaveProperty('id');
    expect(exercise).toHaveProperty('externalId');
    expect(exercise).toHaveProperty('name');
    expect(exercise).toHaveProperty('category');
    expect(exercise).toHaveProperty('bodyPart');
    expect(exercise).toHaveProperty('equipment');
    expect(exercise).toHaveProperty('target');
  });

  test('devuelve lista vacía cuando no hay ejercicios en BD', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.exercises).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  test('incluye limit y offset en la respuesta', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    expect(res.body.data).toHaveProperty('limit');
    expect(res.body.data).toHaveProperty('offset');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /exercises?category=Arms — filtro por categoría
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /exercises — filtros de query', () => {
  let token;

  beforeAll(() => {
    token = makeToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('filtra por categoría (category=Arms)', async () => {
    const armsExercises = SAMPLE_EXERCISES.filter((e) => e.category === 'Arms');
    mockFindMany.mockResolvedValueOnce(armsExercises);
    mockCount.mockResolvedValueOnce(armsExercises.length);

    const res = await request(app)
      .get('/exercises?category=Arms')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    // Verificamos que el filtro se pasa a Prisma correctamente
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.category).toBe('Arms');
  });

  test('filtra por equipamiento (equipment=Dumbbell)', async () => {
    const dumbbellExercises = SAMPLE_EXERCISES.filter((e) => e.equipment === 'Dumbbell');
    mockFindMany.mockResolvedValueOnce(dumbbellExercises);
    mockCount.mockResolvedValueOnce(dumbbellExercises.length);

    const res = await request(app)
      .get('/exercises?equipment=Dumbbell')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.equipment).toBe('Dumbbell');
  });

  test('filtra por dificultad (difficulty=beginner)', async () => {
    const beginnerExercises = SAMPLE_EXERCISES.filter((e) => e.difficulty === 'beginner');
    mockFindMany.mockResolvedValueOnce(beginnerExercises);
    mockCount.mockResolvedValueOnce(beginnerExercises.length);

    const res = await request(app)
      .get('/exercises?difficulty=beginner')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.difficulty).toBe('beginner');
  });

  test('filtra por músculo objetivo (target=lats)', async () => {
    const latsExercises = SAMPLE_EXERCISES.filter((e) => e.target.includes('lats'));
    mockFindMany.mockResolvedValueOnce(latsExercises);
    mockCount.mockResolvedValueOnce(latsExercises.length);

    const res = await request(app)
      .get('/exercises?target=lats')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.target).toEqual({ contains: 'lats', mode: 'insensitive' });
  });

  test('respeta el límite (limit=2)', async () => {
    const limited = SAMPLE_EXERCISES.slice(0, 2);
    mockFindMany.mockResolvedValueOnce(limited);
    mockCount.mockResolvedValueOnce(SAMPLE_EXERCISES.length);

    const res = await request(app)
      .get('/exercises?limit=2')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(2);
    // El take en la llamada a Prisma debe ser 2
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(2);
  });

  test('limita el máximo en 100 incluso si se pide más', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    const res = await request(app)
      .get('/exercises?limit=999')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBeLessThanOrEqual(100);
  });

  test('respeta el offset (offset=2)', async () => {
    const offsetExercises = SAMPLE_EXERCISES.slice(2);
    mockFindMany.mockResolvedValueOnce(offsetExercises);
    mockCount.mockResolvedValueOnce(SAMPLE_EXERCISES.length);

    const res = await request(app)
      .get('/exercises?offset=2')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.skip).toBe(2);
  });

  test('siempre filtra por externalId not null', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    mockCount.mockResolvedValueOnce(0);

    await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.externalId).toEqual({ not: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /exercises/:id — detalle de un ejercicio
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /exercises/:id', () => {
  let token;

  beforeAll(() => {
    token = makeToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve 401 sin autenticación', async () => {
    const res = await request(app).get('/exercises/uuid-ex-001');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('devuelve 200 con el ejercicio cuando el ID existe', async () => {
    const exercise = SAMPLE_EXERCISES[0];
    mockFindUnique.mockResolvedValueOnce(exercise);

    const res = await request(app)
      .get(`/exercises/${exercise.id}`)
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('exercise');
    expect(res.body.data.exercise.id).toBe(exercise.id);
    expect(res.body.data.exercise.name).toBe('Barbell Squat');
  });

  test('devuelve 404 cuando el ID no existe', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/exercises/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('NOT_FOUND');
  });

  test('llama a findUnique con el ID correcto del parámetro de ruta', async () => {
    const targetId = 'uuid-ex-002';
    mockFindUnique.mockResolvedValueOnce(SAMPLE_EXERCISES[1]);

    await request(app)
      .get(`/exercises/${targetId}`)
      .set('Authorization', authHeader(token));

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: targetId },
    });
  });

  test('devuelve 500 cuando Prisma lanza un error inesperado', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await request(app)
      .get('/exercises/uuid-ex-001')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });

  test('GET /exercises devuelve 500 cuando Prisma falla en findMany', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Connection lost'));

    const res = await request(app)
      .get('/exercises')
      .set('Authorization', authHeader(token));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });
});
