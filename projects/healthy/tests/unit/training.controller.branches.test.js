'use strict';

/**
 * Tests de branches para training.controller.js.
 * Cubre las ramas no alcanzadas (líneas 19-20, 34, 53, 73, 78-97).
 * - getSessions: rama date definida (date filter), rama status definida
 * - getSessionById: rama session not found
 * - completeSession: rama session not found, rama ya completada
 * - completeExercise: rama session not found, rama ejercicio not found, reps undefined
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
  regeneratePlan: jest.fn(),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
  generateFallbackPlan: jest.fn(),
}));

const prisma = require('../../backend/src/prisma/client');
const {
  getSessions,
  getSessionById,
  completeSession,
  completeExercise,
} = require('../../backend/src/controllers/training.controller');

// ─── Mock de req/res/next ─────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { userId: 'user-test-id' },
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

const mockNext = jest.fn();

// ─── getSessions ──────────────────────────────────────────────────────────────

describe('getSessions — branches de query params', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aplica filtro de status cuando está definido', async () => {
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([]);
    const req = makeReq({ query: { status: 'completed' } });
    const res = makeMockRes();

    await getSessions(req, res, mockNext);

    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('aplica filtro de fecha cuando date está definido', async () => {
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([
      { id: 'session-1', scheduled_date: new Date(), status: 'scheduled', session_exercises: [] },
    ]);
    const req = makeReq({ query: { date: '2026-01-15' } });
    const res = makeMockRes();

    await getSessions(req, res, mockNext);

    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduled_date: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('funciona sin query params (sin filtros extra)', async () => {
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([]);
    const req = makeReq({ query: {} });
    const res = makeMockRes();

    await getSessions(req, res, mockNext);

    expect(prisma.trainingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: 'user-test-id' },
      })
    );
  });

  test('aplica ambos filtros date y status juntos', async () => {
    prisma.trainingSession.findMany = jest.fn().mockResolvedValue([]);
    const req = makeReq({ query: { date: '2026-03-10', status: 'scheduled' } });
    const res = makeMockRes();

    await getSessions(req, res, mockNext);

    const callArg = prisma.trainingSession.findMany.mock.calls[0][0];
    expect(callArg.where).toHaveProperty('status', 'scheduled');
    expect(callArg.where).toHaveProperty('scheduled_date');
  });

  test('llama a next en caso de error de DB', async () => {
    prisma.trainingSession.findMany = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ query: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await getSessions(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── getSessionById ───────────────────────────────────────────────────────────

describe('getSessionById — branch session not found', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando la sesión no existe', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'nonexistent-id' } });
    const res = makeMockRes();

    await getSessionById(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'NOT_FOUND' })
    );
  });

  test('devuelve 200 cuando la sesión existe', async () => {
    const fakeSession = {
      id: 'session-abc',
      user_id: 'user-test-id',
      status: 'scheduled',
      session_exercises: [],
      plan: null,
    };
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(fakeSession);
    const req = makeReq({ params: { id: 'session-abc' } });
    const res = makeMockRes();

    await getSessionById(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ session: fakeSession }) })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockRejectedValue(new Error('Timeout'));
    const req = makeReq({ params: { id: 'some-id' } });
    const res = makeMockRes();
    const next = jest.fn();

    await getSessionById(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── completeSession ──────────────────────────────────────────────────────────

describe('completeSession — branches not found y ya completada', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando la sesión no existe', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'bad-id' }, body: {} });
    const res = makeMockRes();

    await completeSession(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND' })
    );
  });

  test('devuelve 400 cuando la sesión ya está completada', async () => {
    const completedSession = { id: 'session-done', status: 'completed', user_id: 'user-test-id' };
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(completedSession);
    const req = makeReq({ params: { id: 'session-done' }, body: {} });
    const res = makeMockRes();

    await completeSession(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SESSION_ALREADY_COMPLETED' })
    );
  });

  test('completa la sesión cuando está en estado scheduled', async () => {
    const pendingSession = { id: 'session-pending', status: 'scheduled', user_id: 'user-test-id' };
    const updatedSession = { ...pendingSession, status: 'completed', completed_at: new Date() };
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(pendingSession);
    prisma.trainingSession.update = jest.fn().mockResolvedValue(updatedSession);
    const req = makeReq({ params: { id: 'session-pending' }, body: { duration_minutes: 45, calories_burned: 300, notes: 'Great session' } });
    const res = makeMockRes();

    await completeSession(req, res, mockNext);

    expect(prisma.trainingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('completa la sesión sin campos opcionales (branches || null)', async () => {
    const pendingSession = { id: 'session-x', status: 'scheduled', user_id: 'user-test-id' };
    const updatedSession = { ...pendingSession, status: 'completed' };
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(pendingSession);
    prisma.trainingSession.update = jest.fn().mockResolvedValue(updatedSession);
    const req = makeReq({ params: { id: 'session-x' }, body: {} });
    const res = makeMockRes();

    await completeSession(req, res, mockNext);

    // Sin duration_minutes, calories_burned, notes → deben ser null
    expect(prisma.trainingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duration_minutes: null, calories_burned: null, notes: null }),
      })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockRejectedValue(new Error('DB crash'));
    const req = makeReq({ params: { id: 'x' }, body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await completeSession(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── completeExercise ─────────────────────────────────────────────────────────

describe('completeExercise — branches not found y reps undefined', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando la sesión no existe', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'bad-session', exerciseId: 'ex-1' }, body: {} });
    const res = makeMockRes();

    await completeExercise(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND', message: 'Sesión no encontrada' })
    );
  });

  test('devuelve 404 cuando el ejercicio no existe en la sesión', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue({ id: 'session-1', status: 'scheduled' });
    prisma.sessionExercise.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { id: 'session-1', exerciseId: 'nonexistent-ex' }, body: {} });
    const res = makeMockRes();

    await completeExercise(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND', message: 'Ejercicio no encontrado en esta sesión' })
    );
  });

  test('completa el ejercicio usando reps del body cuando está definido', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue({ id: 'session-1' });
    const sessionExercise = { id: 'se-1', session_id: 'session-1', exercise_id: 'ex-1', reps: 10, completed: false };
    prisma.sessionExercise.findFirst = jest.fn().mockResolvedValue(sessionExercise);
    prisma.sessionExercise.update = jest.fn().mockResolvedValue({ ...sessionExercise, completed: true, reps: 12 });
    const req = makeReq({ params: { id: 'session-1', exerciseId: 'ex-1' }, body: { weight_kg: 50, reps: 12 } });
    const res = makeMockRes();

    await completeExercise(req, res, mockNext);

    expect(prisma.sessionExercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reps: 12, completed: true }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('completa el ejercicio usando reps del sessionExercise cuando reps es undefined en body', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue({ id: 'session-1' });
    const sessionExercise = { id: 'se-1', session_id: 'session-1', exercise_id: 'ex-1', reps: 8, completed: false };
    prisma.sessionExercise.findFirst = jest.fn().mockResolvedValue(sessionExercise);
    prisma.sessionExercise.update = jest.fn().mockResolvedValue({ ...sessionExercise, completed: true });
    const req = makeReq({ params: { id: 'session-1', exerciseId: 'ex-1' }, body: { weight_kg: 30 } }); // reps undefined
    const res = makeMockRes();

    await completeExercise(req, res, mockNext);

    // reps undefined → usa sessionExercise.reps (8)
    expect(prisma.sessionExercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reps: 8, weight_kg: 30 }),
      })
    );
  });

  test('usa null para weight_kg cuando no está en el body', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockResolvedValue({ id: 'session-1' });
    const sessionExercise = { id: 'se-1', reps: 10, completed: false };
    prisma.sessionExercise.findFirst = jest.fn().mockResolvedValue(sessionExercise);
    prisma.sessionExercise.update = jest.fn().mockResolvedValue({ ...sessionExercise, completed: true });
    const req = makeReq({ params: { id: 'session-1', exerciseId: 'ex-1' }, body: {} });
    const res = makeMockRes();

    await completeExercise(req, res, mockNext);

    expect(prisma.sessionExercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ weight_kg: null }),
      })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.trainingSession.findFirst = jest.fn().mockRejectedValue(new Error('Network error'));
    const req = makeReq({ params: { id: 'x', exerciseId: 'y' }, body: {} });
    const res = makeMockRes();
    const next = jest.fn();

    await completeExercise(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
