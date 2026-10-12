'use strict';

/**
 * Tests unitarios para exerciseSelector.service.js
 * Cubre: formatExercisesForPrompt (función pura exportada),
 *        getExercisesForProfile (lógica observable via mock de Prisma).
 *
 * El servicio usa PrismaClient con PrismaPg+Pool directamente (no el cliente compartido),
 * por lo que mockeamos @prisma/adapter-pg, pg y ../generated/prisma antes de importar.
 */

// ─── Mocks de dependencias de infraestructura ─────────────────────────────────

// Mock de pg Pool para evitar conexiones reales
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock del adaptador de Prisma para PG
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

// Mock del cliente Prisma generado — instancia con exercise.findMany controlable
const mockFindMany = jest.fn();
jest.mock('../../backend/src/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    exercise: {
      findMany: mockFindMany,
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock del logger para silenciar warnings en tests
jest.mock('../../backend/src/utils/logger.util', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}));

// ─── Importar después de los mocks ────────────────────────────────────────────

const {
  getExercisesForProfile,
  formatExercisesForPrompt,
} = require('../../backend/src/services/exerciseSelector.service');

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const SAMPLE_EXERCISES = [
  {
    id: 'uuid-1',
    externalId: 'EX001',
    name: 'Barbell Squat',
    category: 'Legs',
    bodyPart: 'upper legs',
    equipment: 'Barbell',
    target: 'quadriceps',
    secondaryMuscles: ['glutes', 'hamstrings'],
    instructionsEs: 'Coloca la barra sobre los trapecios. Baja hasta que los muslos queden paralelos al suelo.',
    instructionsEn: 'Place the bar on your traps. Lower until thighs are parallel.',
    gifUrl: 'https://example.com/squat.gif',
    difficulty: 'intermediate',
  },
  {
    id: 'uuid-2',
    externalId: 'EX002',
    name: 'Push Up',
    category: 'Chest',
    bodyPart: 'chest',
    equipment: 'Body Weight',
    target: 'pectorals',
    secondaryMuscles: [],
    instructionsEs: null,
    instructionsEn: 'Keep your body in a straight line.',
    gifUrl: null,
    difficulty: 'beginner',
  },
  {
    id: 'uuid-3',
    externalId: 'EX003',
    name: 'Dumbbell Curl',
    category: 'Arms',
    bodyPart: 'upper arms',
    equipment: 'Dumbbell',
    target: 'biceps brachii',
    secondaryMuscles: ['brachialis'],
    instructionsEs: 'Sujeta las mancuernas con los brazos extendidos y flexiona el codo hacia arriba.',
    instructionsEn: null,
    gifUrl: 'https://example.com/curl.gif',
    difficulty: 'beginner',
  },
];

const BASE_PROFILE = {
  equipment: 'barbell',
  experience_level: 'intermediate',
  goal: 'muscle_gain',
  injuries: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// formatExercisesForPrompt — función pura exportada
// ─────────────────────────────────────────────────────────────────────────────

describe('formatExercisesForPrompt', () => {
  test('con array vacío devuelve mensaje apropiado', () => {
    const result = formatExercisesForPrompt([]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/no hay ejercicios/i);
  });

  test('con null devuelve mensaje apropiado', () => {
    const result = formatExercisesForPrompt(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toMatch(/no hay ejercicios/i);
  });

  test('formatea correctamente un ejercicio con todos los campos', () => {
    const result = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);

    // Nombre e ID externo
    expect(result).toContain('Barbell Squat');
    expect(result).toContain('EX001');

    // Categoría, zona y equipamiento
    expect(result).toContain('Legs');
    expect(result).toContain('upper legs');
    expect(result).toContain('Barbell');

    // Músculo objetivo
    expect(result).toContain('quadriceps');

    // Músculos secundarios
    expect(result).toContain('glutes');
    expect(result).toContain('hamstrings');
  });

  test('incluye instrucciones en español si están disponibles (truncadas a 150 chars)', () => {
    const result = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);
    // La instrucción en español existe y debe aparecer parcialmente
    expect(result).toContain('Coloca la barra');
  });

  test('omite la sección de instrucciones si instructionsEs es null', () => {
    const result = formatExercisesForPrompt([SAMPLE_EXERCISES[1]]);
    // Push Up no tiene instructionsEs; no debe lanzar error
    expect(result).toContain('Push Up');
    expect(result).not.toContain('Instrucciones: null');
  });

  test('formatea múltiples ejercicios separados entre sí', () => {
    const result = formatExercisesForPrompt(SAMPLE_EXERCISES);

    // Los tres ejercicios deben estar en el resultado
    expect(result).toContain('Barbell Squat');
    expect(result).toContain('Push Up');
    expect(result).toContain('Dumbbell Curl');

    // Deben estar separados (al menos una línea en blanco entre ellos)
    const blocks = result.split('\n\n');
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  test('omite sección de músculos secundarios si el array está vacío', () => {
    const result = formatExercisesForPrompt([SAMPLE_EXERCISES[1]]);
    // Push Up tiene secondaryMuscles: [] — no debe mostrar la línea de secundarios
    expect(result).not.toContain('Músculos secundarios:');
  });

  test('incluye músculos secundarios cuando los hay', () => {
    const result = formatExercisesForPrompt([SAMPLE_EXERCISES[0]]);
    expect(result).toContain('Músculos secundarios:');
    expect(result).toContain('glutes');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getExercisesForProfile — comportamientos observables
// ─────────────────────────────────────────────────────────────────────────────

describe('getExercisesForProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve [] cuando el perfil es null', async () => {
    const result = await getExercisesForProfile(null);
    expect(result).toEqual([]);
  });

  test('devuelve [] cuando el perfil no es un objeto', async () => {
    const result = await getExercisesForProfile('invalid');
    expect(result).toEqual([]);
  });

  test('devuelve [] cuando Prisma no devuelve ejercicios', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await getExercisesForProfile(BASE_PROFILE);
    expect(result).toEqual([]);
  });

  test('devuelve los ejercicios cuando Prisma los devuelve', async () => {
    mockFindMany.mockResolvedValueOnce(SAMPLE_EXERCISES);
    const result = await getExercisesForProfile(BASE_PROFILE);
    expect(result).toHaveLength(SAMPLE_EXERCISES.length);
    expect(result[0].name).toBe('Barbell Squat');
  });

  test('devuelve [] en lugar de lanzar error cuando Prisma falla', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('DB connection failed'));
    const result = await getExercisesForProfile(BASE_PROFILE);
    expect(result).toEqual([]);
  });

  test('pasa filtro de dificultad según experience_level beginner', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, experience_level: 'beginner' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.difficulty).toEqual({ in: ['beginner'] });
  });

  test('pasa filtro de dificultad intermedio (incluye beginner e intermediate)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, experience_level: 'intermediate' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.difficulty).toEqual({ in: ['beginner', 'intermediate'] });
  });

  test('pasa filtro de dificultad avanzado (todos los niveles)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, experience_level: 'advanced' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.difficulty).toEqual({ in: ['beginner', 'intermediate', 'advanced'] });
  });

  test('aplica filtro de categorías según objetivo muscle_gain', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, goal: 'muscle_gain' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.category).toEqual({
      in: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
    });
  });

  test('no aplica filtro de categoría para objetivo wellness (null)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, goal: 'wellness' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.category).toBeUndefined();
  });

  test('no aplica filtro de equipamiento para gym_full (null)', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, equipment: 'gym_full' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.equipment).toBeUndefined();
  });

  test('aplica filtro de equipamiento para dumbbells', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, equipment: 'dumbbells' });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.equipment).toEqual({ in: ['Dumbbell', 'Body Weight'] });
  });

  test('aplica exclusiones de lesión para knee', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, injuries: ['knee'] });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.AND).toBeDefined();
    expect(Array.isArray(callArgs.where.AND)).toBe(true);
    expect(callArgs.where.AND.length).toBeGreaterThan(0);
  });

  test('no agrega AND de lesiones cuando injuries está vacío', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile({ ...BASE_PROFILE, injuries: [] });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.AND).toBeUndefined();
  });

  test('siempre filtra por externalId not null', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile(BASE_PROFILE);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.externalId).toEqual({ not: null });
  });

  test('respeta el límite por defecto de 80', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile(BASE_PROFILE);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(80);
  });

  test('respeta un límite personalizado', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await getExercisesForProfile(BASE_PROFILE, 10);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.take).toBe(10);
  });
});
