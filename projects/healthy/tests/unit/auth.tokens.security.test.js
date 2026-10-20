'use strict';

/**
 * SEC-45 (SA-14): refresh tokens y tokens de reset con hash, rotación con
 * detección de reutilización y reset válido 1 h.
 * SEC-72 (VUL-2026-015): la nueva contraseña no puede ser igual a la actual.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));
jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountExistsEmail: jest.fn().mockResolvedValue(true),
}));

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../backend/src/prisma/client');
const redis = require('../../backend/src/services/redis.service');
const emailService = require('../../backend/src/services/email.service');
const { hashPassword } = require('../../backend/src/utils/crypto.util');
const mw = require('../../backend/src/middleware/auth.middleware');
const ctrl = require('../../backend/src/controllers/auth.controller');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
async function call(fn, body, extra = {}) {
  const res = makeRes();
  const next = jest.fn();
  await fn({ headers: { 'user-agent': 'jest' }, ip: '10.0.0.1', body, ...extra }, res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

let password;
async function seedActiveUser(email = 'tok@test.com', pwd = 'OldPass123!') {
  password = pwd;
  return prisma.user.create({
    data: { email, password_hash: await hashPassword(pwd), status: 'active', email_verified: true },
  });
}
async function login(email = 'tok@test.com') {
  const r = await call(ctrl.login, { email, password });
  expect(r.status).toBe(200);
  return r.body.data;
}

beforeEach(() => {
  prisma._reset();
  redis._reset();
  mw._resetLocalRevocations();
  jest.clearAllMocks();
});

describe('SEC-45 — refresh tokens', () => {
  test('el refresh token es aleatorio de 32 bytes y en BD solo está su SHA-256', async () => {
    await seedActiveUser();
    const tokens = await login();
    expect(Buffer.from(tokens.refresh_token, 'base64url')).toHaveLength(32);
    const row = prisma._db.authSession[0];
    expect(row.refresh_token).toBe(sha256(tokens.refresh_token));
    expect(row.refresh_token).not.toBe(tokens.refresh_token);
    expect(row.family_id).toBe(row.id);
    expect(jwt.decode(tokens.access_token).sessionId).toBe(row.family_id);
  });

  test('rotación: el token nuevo funciona y el sessionId (familia) se mantiene', async () => {
    await seedActiveUser();
    const t0 = await login();
    const r1 = await call(ctrl.refresh, { refresh_token: t0.refresh_token });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refresh_token).not.toBe(t0.refresh_token);
    expect(jwt.decode(r1.body.data.access_token).sessionId).toBe(jwt.decode(t0.access_token).sessionId);
    const r2 = await call(ctrl.refresh, { refresh_token: r1.body.data.refresh_token });
    expect(r2.status).toBe(200);
    const rows = prisma._db.authSession;
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.family_id)).size).toBe(1);
    expect(rows.filter((r) => !r.revoked_at)).toHaveLength(1);
  });

  test('ATAQUE: reutilizar un refresh token ya rotado revoca TODAS las sesiones del usuario', async () => {
    await seedActiveUser();
    const deviceA = await login();
    const deviceB = await login();
    const rotated = await call(ctrl.refresh, { refresh_token: deviceA.refresh_token });
    expect(rotated.status).toBe(200);

    // El atacante reutiliza el token robado (ya rotado)
    const replay = await call(ctrl.refresh, { refresh_token: deviceA.refresh_token });
    expect(replay.status).toBe(401);
    expect(replay.body.error).toBe('INVALID_TOKEN');

    // Todas las sesiones quedan revocadas: ni el token rotado ni el otro dispositivo sirven
    expect(prisma._db.authSession.every((s) => s.revoked_at)).toBe(true);
    expect((await call(ctrl.refresh, { refresh_token: rotated.body.data.refresh_token })).status).toBe(401);
    expect((await call(ctrl.refresh, { refresh_token: deviceB.refresh_token })).status).toBe(401);

    // Y los access tokens emitidos antes también dejan de valer
    expect(await mw.isTokenRevoked({ ...jwt.decode(deviceB.access_token), iat: Math.floor(Date.now() / 1000) - 5 })).toBe(true);
  });

  test('carrera: si otra petición rotó el token a la vez → 401 sin revocación masiva', async () => {
    await seedActiveUser();
    const t = await login();
    const original = prisma.authSession.updateMany;
    prisma.authSession.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    try {
      const r = await call(ctrl.refresh, { refresh_token: t.refresh_token });
      expect(r.status).toBe(401);
    } finally {
      prisma.authSession.updateMany = original;
    }
    expect(prisma._db.authSession.some((s) => !s.revoked_at)).toBe(true);
  });

  test('un token legacy (en claro en BD) ya no es aceptado', async () => {
    const user = await seedActiveUser();
    prisma._db.authSession.push({
      id: 'legacy', family_id: 'legacy', user_id: user.id, refresh_token: 'uuid-legacy.123',
      expires_at: new Date(Date.now() + 1e6), revoked_at: null,
    });
    const r = await call(ctrl.refresh, { refresh_token: 'uuid-legacy.123' });
    expect(r.status).toBe(401);
  });

  test('fila sin family_id (previa a la migración) rota usando su id como familia', async () => {
    const user = await seedActiveUser();
    prisma._db.authSession.push({
      id: 'old-row', user_id: user.id, refresh_token: sha256('opaque'),
      expires_at: new Date(Date.now() + 1e6), revoked_at: null,
    });
    const r = await call(ctrl.refresh, { refresh_token: 'opaque' });
    expect(r.status).toBe(200);
    expect(jwt.decode(r.body.data.access_token).sessionId).toBe('old-row');
  });

  test('logout borra toda la familia (también las filas rotadas)', async () => {
    await seedActiveUser();
    const t = await login();
    const r1 = await call(ctrl.refresh, { refresh_token: t.refresh_token });
    const sid = jwt.decode(r1.body.data.access_token).sessionId;
    await call(ctrl.logout, {}, { user: { userId: 'x', sessionId: sid } });
    expect(prisma._db.authSession).toHaveLength(0);
  });
});

describe('SEC-45 — tokens de reset', () => {
  test('forgot: token aleatorio, en BD solo el hash, caduca en 1 h e invalida los anteriores', async () => {
    await seedActiveUser();
    await call(ctrl.forgotPassword, { email: 'tok@test.com' });
    await call(ctrl.forgotPassword, { email: 'tok@test.com' });
    const sent = emailService.sendPasswordResetEmail.mock.calls.map((c) => c[1]);
    expect(sent).toHaveLength(2);
    const rows = prisma._db.passwordResetToken;
    expect(rows[1].token).toBe(sha256(sent[1]));
    expect(rows[0].used_at).toBeInstanceOf(Date); // el primero quedó invalidado
    const ttl = new Date(rows[1].expires_at).getTime() - Date.now();
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(ttl).toBeGreaterThan(59 * 60 * 1000);

    // El primer enlace ya no sirve; el segundo sí
    expect((await call(ctrl.resetPassword, { token: sent[0], password: 'NewPass123!' })).body.error).toBe('TOKEN_USED');
    expect((await call(ctrl.resetPassword, { token: sent[1], password: 'NewPass123!' })).status).toBe(200);
  });

  test('reset: usar el valor guardado en BD (hash) como token no funciona', async () => {
    await seedActiveUser();
    await call(ctrl.forgotPassword, { email: 'tok@test.com' });
    const stored = prisma._db.passwordResetToken[0].token;
    expect((await call(ctrl.resetPassword, { token: stored, password: 'NewPass123!' })).body.error).toBe('INVALID_TOKEN');
  });

  test('reset: un solo uso, borra sesiones y revoca access tokens', async () => {
    await seedActiveUser();
    const t = await login();
    await call(ctrl.forgotPassword, { email: 'tok@test.com' });
    const token = emailService.sendPasswordResetEmail.mock.calls[0][1];
    // El access token se emitió en un segundo anterior a la revocación
    const decoded = jwt.decode(t.access_token);
    expect((await call(ctrl.resetPassword, { token, password: 'NewPass123!' })).status).toBe(200);
    expect(prisma._db.authSession).toHaveLength(0);
    expect(await mw.isTokenRevoked({ ...decoded, iat: decoded.iat - 1 })).toBe(true);
    expect((await call(ctrl.resetPassword, { token, password: 'Other123!' })).body.error).toBe('TOKEN_USED');
  });

  test('reset: consumo condicional ante peticiones en paralelo', async () => {
    await seedActiveUser();
    await call(ctrl.forgotPassword, { email: 'tok@test.com' });
    const token = emailService.sendPasswordResetEmail.mock.calls[0][1];
    const original = prisma.passwordResetToken.updateMany;
    prisma.passwordResetToken.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    try {
      expect((await call(ctrl.resetPassword, { token, password: 'NewPass123!' })).body.error).toBe('TOKEN_USED');
    } finally {
      prisma.passwordResetToken.updateMany = original;
    }
  });
});
