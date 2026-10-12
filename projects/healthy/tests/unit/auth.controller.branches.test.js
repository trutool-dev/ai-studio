'use strict';

/**
 * Tests de branches para auth.controller.js.
 * Cubre las ramas no alcanzadas: líneas 98, 125, 143, 178, 190, 196-208, 214-231, 237-254, 267, 272, 287-288, 301, 321.
 *
 * Ramas clave:
 * - register: birthdate undefined, birthdate con edad válida, health_consent_given_at definido
 * - verifyEmail: user null, code null, attempts >= 3, expirado
 * - setPassword: user null, email no verificado
 * - login: user null, user sin password_hash, status != active, redis error
 * - resendCode: user null (retorna success de todas formas)
 * - forgotPassword: user null (no crea token), user existe (crea token)
 * - resetPassword: token no encontrado, ya usado, expirado
 * - logout: sessionId undefined
 * - refresh: token no encontrado, expirado, cuenta inactiva
 * - me: user null
 */

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/redis.service', () => ({
  set: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  get: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  del: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
  ping: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
}));

const prisma = require('../../backend/src/prisma/client');
const {
  register,
  verifyEmail,
  setPassword,
  login,
  resendCode,
  forgotPassword,
  resetPassword,
  logout,
  refresh,
  me,
} = require('../../backend/src/controllers/auth.controller');

function makeReq(overrides = {}) {
  return {
    headers: { 'user-agent': 'test-agent' },
    ip: '127.0.0.1',
    user: { userId: 'user-auth-test', sessionId: 'session-test' },
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

// ─── register ─────────────────────────────────────────────────────────────────

describe('register — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza si el usuario tiene menos de 16 años', async () => {
    const req = makeReq({ body: { email: 'young@test.com', birthdate: '2020-01-01' } });
    const res = makeMockRes();

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'AGE_RESTRICTION' })
    );
  });

  test('permite registro sin birthdate (branch birthdate undefined)', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.user.create = jest.fn().mockResolvedValue({ id: 'new-user', email: 'test@test.com' });
    prisma.verificationCode.create = jest.fn().mockResolvedValue({});

    const req = makeReq({ body: { email: 'nobirth@test.com' } });
    const res = makeMockRes();

    await register(req, res, jest.fn());

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ health_consent_given_at: expect.anything() }),
      })
    );
  });

  test('incluye consentimiento cuando health_consent_given_at está definido', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.user.create = jest.fn().mockResolvedValue({ id: 'user-with-consent', email: 'consent@test.com' });
    prisma.verificationCode.create = jest.fn().mockResolvedValue({});

    const req = makeReq({
      body: { email: 'consent@test.com', health_consent_given_at: new Date().toISOString() },
    });
    const res = makeMockRes();

    await register(req, res, jest.fn());

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ health_consent_given_at: expect.any(Date) }),
      })
    );
  });

  test('devuelve 409 si el email ya existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'existing', email: 'dup@test.com' });
    const req = makeReq({ body: { email: 'dup@test.com' } });
    const res = makeMockRes();

    await register(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_ALREADY_EXISTS' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB crash'));
    const req = makeReq({ body: { email: 'error@test.com' } });
    const res = makeMockRes();
    const next = jest.fn();

    await register(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── verifyEmail ──────────────────────────────────────────────────────────────

describe('verifyEmail — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando el usuario no existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { email: 'nouser@test.com', code: '123456' } });
    const res = makeMockRes();

    await verifyEmail(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'NOT_FOUND' }));
  });

  test('devuelve 400 cuando el código no existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    prisma.verificationCode.findFirst = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { email: 'u@test.com', code: 'wrong' } });
    const res = makeMockRes();

    await verifyEmail(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CODE' }));
  });

  test('devuelve 400 cuando los intentos superan 3', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    prisma.verificationCode.findFirst = jest.fn().mockResolvedValue({
      id: 'v1',
      attempts: 3,
      expires_at: new Date(Date.now() + 100000),
    });
    const req = makeReq({ body: { email: 'u@test.com', code: '111111' } });
    const res = makeMockRes();

    await verifyEmail(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CODE_MAX_ATTEMPTS' }));
  });

  test('devuelve 400 cuando el código está expirado', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1' });
    prisma.verificationCode.findFirst = jest.fn().mockResolvedValue({
      id: 'v1',
      attempts: 0,
      expires_at: new Date(Date.now() - 100000), // en el pasado
    });
    const req = makeReq({ body: { email: 'u@test.com', code: '999999' } });
    const res = makeMockRes();

    await verifyEmail(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CODE_EXPIRED' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { email: 'u@test.com', code: '111' } });
    const res = makeMockRes();
    const next = jest.fn();

    await verifyEmail(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── setPassword ──────────────────────────────────────────────────────────────

describe('setPassword — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando el usuario no existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { email: 'nouser@test.com', password: 'Test1234!' } });
    const res = makeMockRes();

    await setPassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'NOT_FOUND' }));
  });

  test('devuelve 400 cuando el email no está verificado', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1', email_verified: false });
    const req = makeReq({ body: { email: 'unverified@test.com', password: 'Test1234!' } });
    const res = makeMockRes();

    await setPassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'EMAIL_NOT_VERIFIED' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { email: 'u@test.com', password: 'pass' } });
    const res = makeMockRes();
    const next = jest.fn();

    await setPassword(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 401 cuando el usuario no existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { email: 'nouser@test.com', password: 'pass' } });
    const res = makeMockRes();

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_CREDENTIALS' }));
  });

  test('devuelve 401 cuando el usuario no tiene password_hash', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1', password_hash: null, status: 'active' });
    const req = makeReq({ body: { email: 'u@test.com', password: 'pass' } });
    const res = makeMockRes();

    await login(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('devuelve 403 cuando la cuenta no está activa', async () => {
    const { comparePassword } = require('../../backend/src/utils/crypto.util');
    prisma.user.findUnique = jest.fn().mockResolvedValue({
      id: 'u1',
      password_hash: '$2b$10$hash',
      status: 'pending_verification',
      email: 'u@test.com',
    });
    // Mockear comparePassword para devolver true
    jest.doMock('../../backend/src/utils/crypto.util', () => ({
      ...jest.requireActual('../../backend/src/utils/crypto.util'),
      comparePassword: jest.fn().mockResolvedValue(true),
    }));

    const req = makeReq({ body: { email: 'u@test.com', password: 'Test1234!' } });
    const res = makeMockRes();

    await login(req, res, jest.fn());

    // Si status != 'active', devuelve 403
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_INACTIVE' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB crash'));
    const req = makeReq({ body: { email: 'u@test.com', password: 'pass' } });
    const res = makeMockRes();
    const next = jest.fn();

    await login(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── resendCode ───────────────────────────────────────────────────────────────

describe('resendCode — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 200 aunque el usuario no exista (branch user null)', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { email: 'nouser@test.com' } });
    const res = makeMockRes();

    await resendCode(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test('crea nuevo código cuando el usuario existe', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com' });
    prisma.verificationCode.create = jest.fn().mockResolvedValue({});
    const req = makeReq({ body: { email: 'u@test.com' } });
    const res = makeMockRes();

    await resendCode(req, res, jest.fn());

    expect(prisma.verificationCode.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { email: 'u@test.com' } });
    const res = makeMockRes();
    const next = jest.fn();

    await resendCode(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── forgotPassword ───────────────────────────────────────────────────────────

describe('forgotPassword — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 200 aunque el usuario no exista (branch !user → no crea token)', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    prisma.passwordResetToken.create = jest.fn();
    const req = makeReq({ body: { email: 'nouser@test.com' } });
    const res = makeMockRes();

    await forgotPassword(req, res, jest.fn());

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('crea token de reset cuando el usuario existe (branch user existe)', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com' });
    prisma.passwordResetToken.create = jest.fn().mockResolvedValue({ token: 'reset-token-123' });
    const { sendPasswordResetEmail } = require('../../backend/src/services/email.service');
    const req = makeReq({ body: { email: 'u@test.com' } });
    const res = makeMockRes();

    await forgotPassword(req, res, jest.fn());

    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { email: 'u@test.com' } });
    const res = makeMockRes();
    const next = jest.fn();

    await forgotPassword(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── resetPassword ─────────────────────────────────────────────────────────────

describe('resetPassword — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 400 cuando el token no existe', async () => {
    prisma.passwordResetToken.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { token: 'bad-token', password: 'NewPass1!' } });
    const res = makeMockRes();

    await resetPassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }));
  });

  test('devuelve 400 cuando el token ya fue usado', async () => {
    prisma.passwordResetToken.findUnique = jest.fn().mockResolvedValue({
      id: 'r1',
      used_at: new Date(),
      expires_at: new Date(Date.now() + 100000),
      user_id: 'u1',
    });
    const req = makeReq({ body: { token: 'used-token', password: 'NewPass1!' } });
    const res = makeMockRes();

    await resetPassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_USED' }));
  });

  test('devuelve 400 cuando el token está expirado', async () => {
    prisma.passwordResetToken.findUnique = jest.fn().mockResolvedValue({
      id: 'r1',
      used_at: null,
      expires_at: new Date(Date.now() - 100000), // expirado
      user_id: 'u1',
    });
    const req = makeReq({ body: { token: 'expired-token', password: 'NewPass1!' } });
    const res = makeMockRes();

    await resetPassword(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_EXPIRED' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.passwordResetToken.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { token: 'x', password: 'pass' } });
    const res = makeMockRes();
    const next = jest.fn();

    await resetPassword(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('funciona sin sessionId (branch sessionId undefined)', async () => {
    const req = makeReq({ user: { userId: 'u1' } }); // sin sessionId
    const res = makeMockRes();

    await logout(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('elimina sesión cuando sessionId está definido', async () => {
    prisma.authSession.deleteMany = jest.fn().mockResolvedValue({});
    const req = makeReq({ user: { userId: 'u1', sessionId: 'session-xyz' } });
    const res = makeMockRes();

    await logout(req, res, jest.fn());

    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-xyz' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('llama a next en caso de error', async () => {
    prisma.authSession.deleteMany = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ user: { userId: 'u1', sessionId: 'session-abc' } });
    const res = makeMockRes();
    const next = jest.fn();

    await logout(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── refresh ──────────────────────────────────────────────────────────────────

describe('refresh — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 401 cuando el refresh token no existe', async () => {
    prisma.authSession.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq({ body: { refresh_token: 'bad-token' } });
    const res = makeMockRes();

    await refresh(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }));
  });

  test('devuelve 401 cuando la sesión está expirada', async () => {
    prisma.authSession.findUnique = jest.fn().mockResolvedValue({
      id: 'session-1',
      expires_at: new Date(Date.now() - 100000), // expirada
      user: { id: 'u1', email: 'u@test.com', status: 'active' },
    });
    prisma.authSession.delete = jest.fn().mockResolvedValue({});
    const req = makeReq({ body: { refresh_token: 'expired-refresh' } });
    const res = makeMockRes();

    await refresh(req, res, jest.fn());

    expect(prisma.authSession.delete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_EXPIRED' }));
  });

  test('devuelve 403 cuando la cuenta está inactiva', async () => {
    prisma.authSession.findUnique = jest.fn().mockResolvedValue({
      id: 'session-1',
      expires_at: new Date(Date.now() + 100000),
      user: { id: 'u1', email: 'u@test.com', status: 'pending_verification' },
    });
    const req = makeReq({ body: { refresh_token: 'valid-refresh' } });
    const res = makeMockRes();

    await refresh(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'ACCOUNT_INACTIVE' }));
  });

  test('llama a next en caso de error', async () => {
    prisma.authSession.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq({ body: { refresh_token: 'x' } });
    const res = makeMockRes();
    const next = jest.fn();

    await refresh(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── me ───────────────────────────────────────────────────────────────────────

describe('me — branches', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve 404 cuando el usuario no existe (branch !user)', async () => {
    prisma.user.findUnique = jest.fn().mockResolvedValue(null);
    const req = makeReq();
    const res = makeMockRes();

    await me(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'NOT_FOUND' }));
  });

  test('devuelve los datos del usuario cuando existe', async () => {
    const fakeUser = {
      id: 'u1',
      email: 'u@test.com',
      phone_number: null,
      email_verified: true,
      phone_verified: false,
      status: 'active',
      created_at: new Date(),
      profile: { name: 'Test', birthdate: null, gender: 'male', weight_kg: 75, height_cm: 175, goal: 'lose_weight', activity_level: 'moderate' },
    };
    prisma.user.findUnique = jest.fn().mockResolvedValue(fakeUser);
    const req = makeReq();
    const res = makeMockRes();

    await me(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ user: fakeUser }) })
    );
  });

  test('llama a next en caso de error', async () => {
    prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('DB error'));
    const req = makeReq();
    const res = makeMockRes();
    const next = jest.fn();

    await me(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
