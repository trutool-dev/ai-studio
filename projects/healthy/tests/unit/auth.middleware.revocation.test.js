'use strict';

/**
 * SEC-44 (SA-13): algoritmo JWT fijado (HS256) y revocación por sesión / usuario.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));
jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountExistsEmail: jest.fn().mockResolvedValue(true),
}));

const jwt = require('jsonwebtoken');
const redis = require('../../backend/src/services/redis.service');
const logger = require('../../backend/src/utils/logger.util');
const mw = require('../../backend/src/middleware/auth.middleware');
const ctrl = require('../../backend/src/controllers/auth.controller');

const SECRET = process.env.JWT_SECRET;

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

async function run(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = makeRes();
  const next = jest.fn();
  await mw.authenticate(req, res, next);
  return { req, res, next };
}

beforeEach(() => {
  redis._reset();
  mw._resetLocalRevocations();
  jest.clearAllMocks();
});

describe('SEC-44 — algoritmo fijado', () => {
  test('signAccessToken firma con HS256', () => {
    const token = mw.signAccessToken({ userId: 'u1', sessionId: 's1' }, '15m');
    expect(jwt.decode(token, { complete: true }).header.alg).toBe('HS256');
  });

  test('rechaza tokens con alg: none', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ userId: 'u1', iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const { res, next } = await run(`${header}.${body}.`);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('rechaza tokens HS512 firmados con el mismo secreto (algoritmo distinto)', async () => {
    const token = jwt.sign({ userId: 'u1' }, SECRET, { algorithm: 'HS512', expiresIn: '5m' });
    const { res, next } = await run(token);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INVALID_TOKEN' }));
  });

  test('access tokens del controlador usan HS256', () => {
    // generateAccessToken no se exporta: se comprueba vía login en otros tests; aquí el helper
    const token = mw.signAccessToken({ userId: 'u1' }, '1m');
    expect(() => jwt.verify(token, SECRET, { algorithms: ['HS256'] })).not.toThrow();
  });
});

describe('SEC-44 — revocación', () => {
  test('token válido no revocado → next y req.user', async () => {
    const token = mw.signAccessToken({ userId: 'u1', sessionId: 's1' }, '15m');
    const { req, next } = await run(token);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ userId: 'u1', sessionId: 's1' }));
  });

  test('sesión revocada (logout) → 401 TOKEN_REVOKED', async () => {
    const token = mw.signAccessToken({ userId: 'u1', sessionId: 's-logout' }, '15m');
    await mw.revokeSession('s-logout');
    expect(redis.set).toHaveBeenCalledWith('auth:revoked:sid:s-logout', '1', 'EX', mw.REVOCATION_TTL_SECONDS);
    const { res, next } = await run(token);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'TOKEN_REVOKED' }));
  });

  test('revocación en Redis por otra instancia (sin copia local) también se respeta', async () => {
    const token = mw.signAccessToken({ userId: 'u1', sessionId: 's-remote' }, '15m');
    await redis.set('auth:revoked:sid:s-remote', '1');
    const { next } = await run(token);
    expect(next).not.toHaveBeenCalled();
  });

  test('revocación de todas las sesiones del usuario invalida tokens anteriores, no los nuevos', async () => {
    const now = Math.floor(Date.now() / 1000);
    const old = jwt.sign({ userId: 'u2', sessionId: 'a', iat: now - 60 }, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    await mw.revokeAllUserSessions('u2');
    expect((await run(old)).next).not.toHaveBeenCalled();
    const fresh = jwt.sign({ userId: 'u2', sessionId: 'b', iat: now + 1 }, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    expect((await run(fresh)).next).toHaveBeenCalled();
  });

  test('Redis caído: la revocación local sigue funcionando y se avisa en el log', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    redis.set.mockRejectedValueOnce(new Error('down'));
    await mw.revokeSession('s-down');
    redis.get.mockRejectedValue(new Error('down'));
    try {
      const revoked = mw.signAccessToken({ userId: 'u3', sessionId: 's-down' }, '15m');
      expect((await run(revoked)).next).not.toHaveBeenCalled();
      // Sin marca local ni Redis → fail-soft (se acepta) con aviso
      const other = mw.signAccessToken({ userId: 'u3', sessionId: 's-other' }, '15m');
      expect((await run(other)).next).toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
    } finally {
      redis.get.mockImplementation(async (k) => redis._store.get(k) ?? null);
      warn.mockRestore();
    }
  });

  test('las marcas locales caducan con el TTL', async () => {
    jest.useFakeTimers({ now: Date.now() });
    try {
      await mw.revokeSession('s-ttl');
      redis._reset();
      jest.setSystemTime(Date.now() + (mw.REVOCATION_TTL_SECONDS + 1) * 1000);
      expect(await mw.isTokenRevoked({ sessionId: 's-ttl' })).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('sin sessionId/userId no hay nada que revocar; ids vacíos se ignoran', async () => {
    await mw.revokeSession(undefined);
    await mw.revokeAllUserSessions(undefined);
    expect(redis.set).not.toHaveBeenCalled();
    expect(await mw.isTokenRevoked({})).toBe(false);
  });

  test('si req.user ya viene del mismo token (doble montaje) no repite la verificación', async () => {
    const token = mw.signAccessToken({ userId: 'u1', sessionId: 's1' }, '15m');
    const req = { headers: { authorization: `Bearer ${token}` }, user: { userId: 'u1' }, authToken: token };
    const next = jest.fn();
    await mw.authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
    expect(redis.get).not.toHaveBeenCalled();
  });
});

describe('SEC-44 — integración con el controlador', () => {
  test('logout revoca el access token de la sesión', async () => {
    const token = mw.signAccessToken({ userId: 'u9', sessionId: 'sess-9' }, '15m');
    expect((await run(token)).next).toHaveBeenCalled();
    const res = makeRes();
    await ctrl.logout({ user: { userId: 'u9', sessionId: 'sess-9' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect((await run(token)).next).not.toHaveBeenCalled();
  });
});
