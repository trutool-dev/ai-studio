'use strict';

/**
 * SEC-48 (SA-19): DELETE /user/me transaccional, con reautenticación y purga de Redis.
 * SEC-49 (SA-20): export Art. 15/20 completo y sin secretos.
 */

const fs = require('fs');
const path = require('path');

const mockPrisma = {
  user: { findUnique: jest.fn(), delete: jest.fn() },
  authSession: { findMany: jest.fn() },
  profile: { findUnique: jest.fn() },
  lifestyleProfile: { findUnique: jest.fn() },
  trainingPreferences: { findUnique: jest.fn() },
  nutritionPreferences: { findUnique: jest.fn() },
  healthCondition: { findMany: jest.fn() },
  foodRestriction: { findMany: jest.fn() },
  motivationProfile: { findUnique: jest.fn() },
  onboardingAnswer: { findMany: jest.fn() },
  plan: { findMany: jest.fn() },
  trainingSession: { findMany: jest.fn() },
  meal: { findMany: jest.fn() },
  progressLog: { findMany: jest.fn() },
  dailyLog: { findMany: jest.fn() },
  tokenUsageLog: { findMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('../../backend/src/prisma/client', () => mockPrisma);

const mockRedis = { del: jest.fn(), keys: jest.fn(), scan: undefined };
jest.mock('../../backend/src/services/redis.service', () => mockRedis);

const mockRevokeAll = jest.fn().mockResolvedValue(undefined);
jest.mock('../../backend/src/middleware/auth.middleware', () => ({
  authenticate: (_req, _res, next) => next(),
  revokeAllUserSessions: (...args) => mockRevokeAll(...args),
}));

const { hashPassword } = require('../../backend/src/utils/crypto.util');
const {
  deleteAccount,
  exportData,
  getProfile,
  EXPORTED_USER_MODELS,
  EXCLUDED_USER_MODELS,
  purgeUserFromRedis,
} = require('../../backend/src/controllers/user.controller');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

const USER_ID = 'user-123';
let HASH;

beforeAll(async () => { HASH = await hashPassword('CorrectPass1!'); });

beforeEach(() => {
  jest.clearAllMocks();
  mockRedis.scan = undefined;
  mockRedis.del.mockResolvedValue(1);
  mockRedis.keys.mockResolvedValue([]);
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));
  mockPrisma.authSession.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
  mockPrisma.user.delete.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /user/me/profile — estado del consentimiento art. 9 (SEC-47)
// ─────────────────────────────────────────────────────────────────────────────

describe('getProfile — health_consent', () => {
  const GIVEN_AT = new Date('2026-10-01T10:00:00Z');

  beforeEach(() => {
    delete process.env.HEALTH_CONSENT_VERSION;
    mockPrisma.profile.findUnique.mockResolvedValue({ birthdate: '1990-01-01', weight_kg: '70', height_cm: '175', gender: 'male', goal: 'lose_weight' });
    mockPrisma.trainingPreferences.findUnique.mockResolvedValue({ available_days_per_week: 3 });
    mockPrisma.nutritionPreferences.findUnique.mockResolvedValue({ diet_type: 'omnivore' });
  });

  async function callProfile() {
    const res = makeRes();
    const next = jest.fn();
    await getProfile({ user: { userId: USER_ID } }, res, next);
    expect(next).not.toHaveBeenCalled();
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  }

  it('consentimiento vigente → valid true con su fecha', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ health_consent_given_at: GIVEN_AT, health_consent_version: '1.0' });
    const { status, body } = await callProfile();
    expect(status).toBe(200);
    expect(body.data.health_consent).toEqual({ valid: true, given_at: GIVEN_AT });
    expect(body.data.sessions_per_week).toBe(3);
  });

  it('consentimiento retirado → valid false y sin fecha', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ health_consent_given_at: null, health_consent_version: 'withdrawn:1.0:2026-10-20T00:00:00.000Z' });
    const { body } = await callProfile();
    expect(body.data.health_consent).toEqual({ valid: false, given_at: null });
  });

  it('versión antigua del consentimiento → valid false', async () => {
    process.env.HEALTH_CONSENT_VERSION = '2.0';
    mockPrisma.user.findUnique.mockResolvedValue({ health_consent_given_at: GIVEN_AT, health_consent_version: '1.0' });
    const { body } = await callProfile();
    expect(body.data.health_consent.valid).toBe(false);
    delete process.env.HEALTH_CONSENT_VERSION;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /user/me
// ─────────────────────────────────────────────────────────────────────────────

describe('deleteAccount — reautenticación', () => {
  test.each([undefined, {}, { password: '' }, { password: 123 }])('body %p sin contraseña válida → 400', async (body) => {
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID }, body }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('usuario inexistente → 404', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID }, body: { password: 'x' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('contraseña incorrecta → 401 sin borrar nada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, password_hash: HASH });
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID }, body: { password: 'WrongPass1!' }, ip: '1.2.3.4' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('INVALID_CREDENTIALS');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    expect(mockRedis.del).not.toHaveBeenCalled();
    expect(mockRevokeAll).not.toHaveBeenCalled();
  });

  test('usuario sin password_hash → 401', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, password_hash: null });
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID }, body: { password: 'x' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('deleteAccount — borrado', () => {
  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, password_hash: HASH });
  });

  test('borra el usuario dentro de $transaction (cascada) y purga Redis', async () => {
    mockRedis.keys.mockImplementation(async (pattern) => {
      if (pattern === `plan:${USER_ID}:*`) return [`plan:${USER_ID}:abc`, `plan:${USER_ID}:2026-10-19`];
      if (pattern === `ai:tokens:${USER_ID}:*`) return [`ai:tokens:${USER_ID}:2026-10-19`];
      return [];
    });
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID, sessionId: 's-current' }, body: { password: 'CorrectPass1!' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    // Los access tokens emitidos quedan revocados
    expect(mockRevokeAll).toHaveBeenCalledWith(USER_ID);

    const deleted = mockRedis.del.mock.calls[0];
    expect(deleted).toEqual(expect.arrayContaining([
      'session:s1', 'session:s2', 'session:s-current',
      `plan:${USER_ID}:abc`, `plan:${USER_ID}:2026-10-19`, `plan:idx:${USER_ID}`,
      `ai:tokens:${USER_ID}:2026-10-19`, `user:${USER_ID}`,
    ]));
    // Sin claves de otros usuarios
    expect(deleted.every((k) => k.includes(USER_ID) || k.startsWith('session:'))).toBe(true);
  });

  test('no duplica la sesión actual si ya estaba en BD', async () => {
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID, sessionId: 's1' }, body: { password: 'CorrectPass1!' } }, res, jest.fn());
    const deleted = mockRedis.del.mock.calls[0];
    expect(deleted.filter((k) => k === 'session:s1')).toHaveLength(1);
  });

  test('si la transacción falla → next(err) y no se purga Redis', async () => {
    const err = new Error('tx failed');
    mockPrisma.$transaction.mockRejectedValue(err);
    const next = jest.fn();
    await deleteAccount({ user: { userId: USER_ID }, body: { password: 'CorrectPass1!' } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(err);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  test('Redis caído no impide el borrado (200)', async () => {
    mockRedis.keys.mockRejectedValue(new Error('redis down'));
    const res = makeRes();
    await deleteAccount({ user: { userId: USER_ID }, body: { password: 'CorrectPass1!' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('purgeUserFromRedis — SCAN', () => {
  test('usa SCAN con cursor hasta volver a 0 cuando está disponible', async () => {
    const calls = [];
    mockRedis.scan = jest.fn(async (cursor, _m, pattern) => {
      calls.push([cursor, pattern]);
      if (pattern === `plan:${USER_ID}:*`) {
        return cursor === '0' ? ['7', [`plan:${USER_ID}:a`]] : ['0', [`plan:${USER_ID}:b`]];
      }
      return ['0', []];
    });
    await purgeUserFromRedis(USER_ID, []);
    expect(mockRedis.keys).not.toHaveBeenCalled();
    expect(calls).toEqual(expect.arrayContaining([['0', `plan:${USER_ID}:*`], ['7', `plan:${USER_ID}:*`]]));
    expect(mockRedis.del.mock.calls[0]).toEqual(expect.arrayContaining([`plan:${USER_ID}:a`, `plan:${USER_ID}:b`]));
  });

  test('devuelve 0 si Redis falla', async () => {
    mockRedis.del.mockRejectedValue(new Error('down'));
    await expect(purgeUserFromRedis(USER_ID, [])).resolves.toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /user/me/export
// ─────────────────────────────────────────────────────────────────────────────

describe('exportData', () => {
  function seedExport() {
    mockPrisma.user.findUnique.mockResolvedValue({
      email: 'a@test.healthy.com', phone_number: '+34600000000', email_verified: true, phone_verified: false,
      status: 'active', created_at: new Date(0), updated_at: new Date(0),
      health_consent_given_at: new Date(0), health_consent_version: '1.0',
    });
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'p1', user_id: USER_ID, name: 'Ana' });
    mockPrisma.lifestyleProfile.findUnique.mockResolvedValue(null);
    mockPrisma.trainingPreferences.findUnique.mockResolvedValue(null);
    mockPrisma.nutritionPreferences.findUnique.mockResolvedValue(null);
    mockPrisma.healthCondition.findMany.mockResolvedValue([{ id: 'h1', user_id: USER_ID, condition_name: 'asma', affects_training: true }]);
    mockPrisma.foodRestriction.findMany.mockResolvedValue([]);
    mockPrisma.motivationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.onboardingAnswer.findMany.mockResolvedValue([{ id: 'o1', user_id: USER_ID, question_key: 'q', answer_value: 'a' }]);
    mockPrisma.plan.findMany.mockResolvedValue([{ id: 'pl1', type: 'combined' }]);
    mockPrisma.trainingSession.findMany.mockResolvedValue([{ id: 't1', user_id: USER_ID, session_exercises: [] }]);
    mockPrisma.meal.findMany.mockResolvedValue([{ id: 'm1', user_id: USER_ID, meal_foods: [] }]);
    mockPrisma.progressLog.findMany.mockResolvedValue([]);
    mockPrisma.dailyLog.findMany.mockResolvedValue([{ id: 'd1', user_id: USER_ID, sleep_quality: 4 }]);
    mockPrisma.authSession.findMany.mockResolvedValue([{ id: 's1', ip_address: '1.2.3.4', created_at: new Date(0) }]);
    mockPrisma.tokenUsageLog.findMany.mockResolvedValue([{ request_type: 'plan_generation', input_tokens: 1 }]);
  }

  test('incluye todas las secciones y datos nuevos, sin user_id ni secretos', async () => {
    seedExport();
    const res = makeRes();
    await exportData({ user: { userId: USER_ID } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];

    expect(body.user.phone_number).toBe('+34600000000');
    expect(body.user.email_verified).toBe(true);
    expect(body.consent.health_consent_version).toBe('1.0');
    expect(body.health_conditions[0].affects_training).toBe(true);
    expect(body.onboarding_answers).toHaveLength(1);
    expect(body.training_sessions).toHaveLength(1);
    expect(body.meals).toHaveLength(1);
    expect(body.daily_logs[0].sleep_quality).toBe(4);
    expect(body.sessions[0].ip_address).toBe('1.2.3.4');
    expect(body.ai_usage).toHaveLength(1);
    expect(body.recipients.map((r) => r.name)).toContain('Anthropic');

    const raw = JSON.stringify(body);
    expect(raw).not.toContain('user_id');
    expect(raw).not.toContain('password_hash');
    expect(raw).not.toContain('refresh_token');

    // La consulta de usuario y de sesiones no selecciona secretos
    const userSelect = mockPrisma.user.findUnique.mock.calls[0][0].select;
    expect(userSelect.password_hash).toBeUndefined();
    const sessionSelect = mockPrisma.authSession.findMany.mock.calls[0][0].select;
    expect(sessionSelect.refresh_token).toBeUndefined();
    // Todas las consultas filtran por el usuario autenticado
    expect(mockPrisma.meal.findMany.mock.calls[0][0].where).toEqual({ user_id: USER_ID });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment'));
  });

  test('usuario inexistente → 404', async () => {
    seedExport();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = makeRes();
    await exportData({ user: { userId: USER_ID } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('error de BD → next(err)', async () => {
    seedExport();
    const err = new Error('db');
    mockPrisma.meal.findMany.mockRejectedValue(err);
    const next = jest.fn();
    await exportData({ user: { userId: USER_ID } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('campos opcionales del usuario ausentes → null', async () => {
    seedExport();
    mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@b.c', status: 'active', created_at: new Date(0) });
    const res = makeRes();
    await exportData({ user: { userId: USER_ID } }, res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(body.user.phone_number).toBeNull();
    expect(body.consent.health_consent_given_at).toBeNull();
    expect(body.profile).toEqual({ id: 'p1', name: 'Ana' });
    expect(body.lifestyle).toBeNull();
  });
});

describe('cobertura del export frente a schema.prisma', () => {
  test('todo modelo con user_id está exportado o excluido explícitamente', () => {
    const schema = fs.readFileSync(path.join(__dirname, '../../backend/prisma/schema.prisma'), 'utf8');
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
      .filter(([, , bodyText]) => /^\s*user_id\s+String/m.test(bodyText))
      .map(([, name]) => name);
    expect(models.length).toBeGreaterThan(10);
    const covered = [...Object.keys(EXPORTED_USER_MODELS), ...EXCLUDED_USER_MODELS];
    const missing = models.filter((m) => !covered.includes(m));
    expect(missing).toEqual([]);
  });
});
