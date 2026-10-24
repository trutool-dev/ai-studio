'use strict';

/**
 * Tests de seguridad del flujo OTP de auth:
 * - SEC-27 (SA-03): set-password exige prueba de posesión de un solo uso.
 * - SEC-31 (SA-05): contador de intentos OTP efectivo y comparación en tiempo constante.
 * - SEC-45 (SA-14, parte OTP): los OTP se guardan con HMAC, nunca en claro.
 *
 * Usa el mock en memoria de Prisma con mock explícito (válido en la suite del
 * backend y en la raíz, que no tiene moduleNameMapper).
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));
jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountExistsEmail: jest.fn().mockResolvedValue(true),
}));

const prisma = require('../../backend/src/prisma/client');
const emailService = require('../../backend/src/services/email.service');
const ctrl = require('../../backend/src/controllers/auth.controller');

function makeReq(body = {}) {
  return { headers: { 'user-agent': 'jest' }, ip: '127.0.0.1', body, query: {}, params: {} };
}
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function body(res) { return res.json.mock.calls[0][0]; }
function lastOtp(email) {
  const calls = emailService.sendVerificationEmail.mock.calls.filter((c) => c[0] === email);
  return calls.length ? calls[calls.length - 1][1] : null;
}
function wrong(code) { return code === '000000' ? '111111' : '000000'; }

async function call(fn, reqBody) {
  const res = makeRes();
  const next = jest.fn();
  await fn(makeReq(reqBody), res, next);
  if (next.mock.calls.length) throw next.mock.calls[0][0];
  return { status: res.status.mock.calls[0][0], body: body(res) };
}

async function registerAndVerify(email) {
  await call(ctrl.register, { email });
  const code = lastOtp(email);
  const v = await call(ctrl.verifyEmail, { email, code });
  expect(v.status).toBe(200);
  return code;
}

beforeEach(() => {
  prisma._reset();
  jest.clearAllMocks();
});

describe('SEC-45 — OTP guardado con HMAC', () => {
  test('el código en BD no es el OTP en claro', async () => {
    await call(ctrl.register, { email: 'hash@test.com' });
    const otp = lastOtp('hash@test.com');
    const row = prisma._db.verificationCode[0];
    expect(otp).toMatch(/^\d{6}$/);
    expect(row.code).toMatch(/^[a-f0-9]{64}$/);
    expect(row.code).not.toContain(otp);
  });
});

describe('SEC-27 — set-password con prueba de posesión', () => {
  test('flujo legítimo: register → verify → set-password devuelve sesión', async () => {
    const email = 'ok@test.com';
    const code = await registerAndVerify(email);

    const r = await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual(expect.objectContaining({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      token_type: 'Bearer',
      user: expect.objectContaining({ email, status: 'active', has_plan: false }),
    }));
    const user = prisma._db.user.find((u) => u.email === email);
    expect(user.status).toBe('active');
    expect(user.password_hash).not.toBe('');
  });

  test('ATAQUE: cuenta verificada + código incorrecto → 400 y la contraseña no cambia', async () => {
    const email = 'victim@test.com';
    const code = await registerAndVerify(email);

    const r = await call(ctrl.setPassword, { email, code: wrong(code), password: 'Attacker123!' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_CODE');
    expect(prisma._db.user.find((u) => u.email === email).password_hash).toBe('');
  });

  test('ATAQUE: cuenta que ya tiene contraseña → rechazado aunque exista un código válido', async () => {
    const email = 'active@test.com';
    const code = await registerAndVerify(email);
    await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    const hashBefore = prisma._db.user.find((u) => u.email === email).password_hash;

    // Se fuerza un código de setup válido para comprobar la regla "solo cuentas sin contraseña"
    const user = prisma._db.user.find((u) => u.email === email);
    const { createHmac } = require('crypto');
    prisma._db.verificationCode.push({
      id: 'forged', user_id: user.id, email, type: 'password_setup', attempts: 0, used_at: null,
      code: createHmac('sha256', process.env.OTP_HASH_SECRET || process.env.JWT_SECRET).update(`${user.id}:password_setup:123456`).digest('hex'),
      expires_at: new Date(Date.now() + 60000), created_at: new Date(Date.now() + 1000),
    });

    const r = await call(ctrl.setPassword, { email, code: '123456', password: 'Attacker123!' });
    expect(r.status).toBe(400);
    expect(prisma._db.user.find((u) => u.email === email).password_hash).toBe(hashBefore);
  });

  test('ATAQUE: cuenta sin verificar → 400 INVALID_CODE (no hay prueba de posesión)', async () => {
    const email = 'unverified@test.com';
    await call(ctrl.register, { email });
    const r = await call(ctrl.setPassword, { email, code: lastOtp(email), password: 'Attacker123!' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_CODE');
  });

  test('la prueba de posesión es de un solo uso (replay → 400)', async () => {
    const email = 'replay@test.com';
    const code = await registerAndVerify(email);
    expect((await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' })).status).toBe(200);
    const replay = await call(ctrl.setPassword, { email, code, password: 'Attacker123!' });
    expect(replay.status).toBe(400);
  });

  test('la prueba de posesión caduca (15 min)', async () => {
    const email = 'expired@test.com';
    const code = await registerAndVerify(email);
    prisma._db.verificationCode
      .filter((c) => c.type === 'password_setup')
      .forEach((c) => { c.expires_at = new Date(Date.now() - 1000); });
    const r = await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('CODE_EXPIRED');
  });

  test('la prueba de posesión está ligada al usuario (el OTP de otro no sirve)', async () => {
    const codeA = await registerAndVerify('a@test.com');
    await registerAndVerify('b@test.com');
    const r = await call(ctrl.setPassword, { email: 'b@test.com', code: codeA, password: 'Attacker123!' });
    // Solo coincidiría si ambos OTP fueran iguales (1/10^6); el HMAC incluye user_id
    if (codeA !== lastOtp('b@test.com')) expect(r.status).toBe(400);
    else expect(r.status).toBe(200);
  });

  test('la verificación de una cuenta con contraseña no emite prueba de posesión', async () => {
    const email = 'noseed@test.com';
    const code = await registerAndVerify(email);
    await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    const setupRows = prisma._db.verificationCode.filter((c) => c.type === 'password_setup' && !c.used_at);
    expect(setupRows).toHaveLength(0);
  });

  test('carrera: si otra petición fijó la contraseña entretanto → 400', async () => {
    const email = 'race@test.com';
    const code = await registerAndVerify(email);
    const original = prisma.user.updateMany;
    prisma.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    try {
      const r = await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
      expect(r.status).toBe(400);
    } finally {
      prisma.user.updateMany = original;
    }
  });
});

describe('SEC-31 — contador de intentos OTP', () => {
  test('cada fallo incrementa attempts y al 5º el código queda invalidado', async () => {
    const email = 'brute@test.com';
    await call(ctrl.register, { email });
    const code = lastOtp(email);

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push((await call(ctrl.verifyEmail, { email, code: wrong(code) })).body.error);
    }
    expect(results.slice(0, 4)).toEqual(['INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE']);
    expect(results[4]).toBe('CODE_MAX_ATTEMPTS');
    expect(prisma._db.verificationCode[0].attempts).toBe(5);

    // Ni siquiera el código correcto vale ya
    const r = await call(ctrl.verifyEmail, { email, code });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('CODE_MAX_ATTEMPTS');
    expect(prisma._db.user[0].email_verified).toBe(false);
  });

  test('el contador también aplica a set-password', async () => {
    const email = 'brute-setup@test.com';
    const code = await registerAndVerify(email);
    for (let i = 0; i < 5; i++) {
      await call(ctrl.setPassword, { email, code: wrong(code), password: 'Attacker123!' });
    }
    const r = await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('CODE_MAX_ATTEMPTS');
  });

  test('si el incremento atómico devuelve más del máximo (peticiones en paralelo) se rechaza sin comparar', async () => {
    const email = 'parallel@test.com';
    await call(ctrl.register, { email });
    const code = lastOtp(email);
    const original = prisma.verificationCode.update;
    prisma.verificationCode.update = jest.fn().mockResolvedValue({ attempts: 6 });
    try {
      const r = await call(ctrl.verifyEmail, { email, code });
      expect(r.body.error).toBe('CODE_MAX_ATTEMPTS');
    } finally {
      prisma.verificationCode.update = original;
    }
  });

  test('un código ya consumido por otra petición concurrente no vale (consumo condicional)', async () => {
    const email = 'consumed@test.com';
    await call(ctrl.register, { email });
    const code = lastOtp(email);
    const original = prisma.verificationCode.updateMany;
    prisma.verificationCode.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    try {
      const r = await call(ctrl.verifyEmail, { email, code });
      expect(r.body.error).toBe('INVALID_CODE');
    } finally {
      prisma.verificationCode.updateMany = original;
    }
  });

  test('reenviar invalida el código anterior (nunca hay dos OTP válidos)', async () => {
    const email = 'resend@test.com';
    await call(ctrl.register, { email });
    const first = lastOtp(email);
    await call(ctrl.resendCode, { email });
    const second = lastOtp(email);
    const pending = prisma._db.verificationCode.filter((c) => c.type === 'email_verification' && !c.used_at);
    expect(pending).toHaveLength(1);
    if (first !== second) {
      expect((await call(ctrl.verifyEmail, { email, code: first })).body.error).toBe('INVALID_CODE');
    }
    expect((await call(ctrl.verifyEmail, { email, code: second })).status).toBe(200);
  });

  test('resend no envía código a cuentas que ya tienen contraseña (respuesta igual)', async () => {
    const email = 'resend-active@test.com';
    const code = await registerAndVerify(email);
    await call(ctrl.setPassword, { email, code, password: 'SecurePass123!' });
    emailService.sendVerificationEmail.mockClear();
    const r = await call(ctrl.resendCode, { email });
    expect(r.status).toBe(200);
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('sin secreto de hash configurado → error controlado (next)', async () => {
    const saved = { j: process.env.JWT_SECRET, o: process.env.OTP_HASH_SECRET };
    delete process.env.JWT_SECRET;
    delete process.env.OTP_HASH_SECRET;
    try {
      await expect(call(ctrl.register, { email: 'nosecret@test.com' })).rejects.toThrow(/no configurado/);
    } finally {
      process.env.JWT_SECRET = saved.j;
      if (saved.o) process.env.OTP_HASH_SECRET = saved.o;
    }
  });
});
