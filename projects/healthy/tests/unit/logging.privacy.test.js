'use strict';

/**
 * SEC-51 (SA-22 + JB-19): sin PII, OTP ni enlaces de reset en los logs; el
 * errorHandler no registra err.message de Prisma/SDK en producción.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

const mockSendMail = jest.fn();
jest.mock('../../backend/node_modules/nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));
jest.mock('../../backend/src/prisma/client', () => jest.requireActual('../../backend/src/__mocks__/prisma'));
jest.mock('../../backend/src/services/redis.service', () => jest.requireActual('../../backend/src/__mocks__/redis.service'));

const logger = require('../../backend/src/utils/logger.util');
const email = require('../../backend/src/services/email.service');
const errorHandler = require('../../backend/src/middleware/errorHandler.middleware');

const EMAIL = 'private.person@example.com';
const OTP = '482913';
const RESET = 'r3s3t-T0ken-value-xyz';
const ENV_KEYS = ['NODE_ENV', 'SMTP_USER'];
const saved = {};
let spies;

function allLogged() {
  return spies.flatMap((s) => s.mock.calls).map((args) => JSON.stringify(args)).join('\n');
}

beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
beforeEach(() => {
  spies = ['info', 'warn', 'error'].map((lvl) => jest.spyOn(logger, lvl).mockImplementation(() => {}));
  mockSendMail.mockReset();
});
afterEach(() => {
  spies.forEach((s) => s.mockRestore());
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('email.service — sin SMTP', () => {
  test('dev/test: no registra email, OTP ni enlace y devuelve true', async () => {
    process.env.NODE_ENV = 'test';
    expect(await email.sendVerificationEmail(EMAIL, OTP)).toBe(true);
    expect(await email.sendPasswordResetEmail(EMAIL, RESET)).toBe(true);
    expect(await email.sendAccountExistsEmail(EMAIL)).toBe(true);
    const out = allLogged();
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(OTP);
    expect(out).not.toContain(RESET);
  });

  test('producción sin SMTP: falla de forma visible (false + error) sin datos', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_USER;
    expect(await email.sendVerificationEmail(EMAIL, OTP)).toBe(false);
    expect(await email.sendPasswordResetEmail(EMAIL, RESET)).toBe(false);
    expect(logger.error).toHaveBeenCalled();
    const out = allLogged();
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(OTP);
    expect(out).not.toContain(RESET);
  });
});

describe('email.service — con SMTP', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.SMTP_USER = 'smtp-user';
  });

  test('envío correcto: el log no incluye destinatario ni secretos', async () => {
    mockSendMail.mockResolvedValue({});
    expect(await email.sendVerificationEmail(EMAIL, OTP)).toBe(true);
    expect(await email.sendPasswordResetEmail(EMAIL, RESET)).toBe(true);
    expect(await email.sendAccountExistsEmail(EMAIL)).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(3);
    // El enlace de reset sí va en el email, con 1 h de validez
    const resetMail = mockSendMail.mock.calls[1][0];
    expect(resetMail.text).toContain(encodeURIComponent(RESET));
    expect(resetMail.text).toContain('1 hora');
    const out = allLogged();
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(OTP);
    expect(out).not.toContain(RESET);
  });

  test('error de envío: registra solo el código de error, no el mensaje (que puede llevar el email)', async () => {
    const err = Object.assign(new Error(`Recipient ${EMAIL} rejected`), { code: 'EENVELOPE' });
    mockSendMail.mockRejectedValue(err);
    expect(await email.sendVerificationEmail(EMAIL, OTP)).toBe(false);
    expect(await email.sendPasswordResetEmail(EMAIL, RESET)).toBe(false);
    expect(await email.sendAccountExistsEmail(EMAIL)).toBe(false);
    const out = allLogged();
    expect(out).toContain('EENVELOPE');
    expect(out).not.toContain(EMAIL);
  });

  test('error sin código usa el nombre del error', async () => {
    mockSendMail.mockRejectedValue(new TypeError(`bad ${EMAIL}`));
    await email.sendVerificationEmail(EMAIL, OTP);
    expect(allLogged()).toContain('TypeError');
    expect(allLogged()).not.toContain(EMAIL);
  });
});

describe('errorHandler', () => {
  function makeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
  const req = { path: '/onboarding/health', method: 'PUT' };
  const prismaErr = () => Object.assign(
    new Error('Invalid `prisma.healthCondition.create()` invocation: { condition_name: "diabetes tipo 1" }'),
    { name: 'PrismaClientValidationError', code: 'P2002', meta: { target: ['user_id'] } },
  );

  test('producción: registra tipo/código/target, nunca err.message', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(prismaErr(), req, res, jest.fn());
    const logged = logger.error.mock.calls[0][0];
    expect(logged).toEqual(expect.objectContaining({
      name: 'PrismaClientValidationError', code: 'P2002', target: ['user_id'], path: '/onboarding/health',
    }));
    expect(JSON.stringify(logged)).not.toContain('diabetes');
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('producción: error sin stack ni meta', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler({ status: 502 }, req, res, jest.fn());
    expect(logger.error.mock.calls[0][0]).toEqual(expect.objectContaining({ name: 'Error', status: 502 }));
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('desarrollo: mantiene mensaje y stack para depurar', () => {
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    errorHandler(Object.assign(new Error('not found'), { code: 'P2025' }), req, res, jest.fn());
    expect(logger.error.mock.calls[0][0]).toEqual(expect.objectContaining({ message: 'not found' }));
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('auth.controller — logs sin email', () => {
  test('login fallido con email inexistente no registra el email', async () => {
    process.env.NODE_ENV = 'test';
    const ctrl = require('../../backend/src/controllers/auth.controller');
    const res = makeResLocal();
    await ctrl.login({ body: { email: EMAIL, password: 'whatever' }, headers: {}, ip: '1.1.1.1' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(allLogged()).not.toContain(EMAIL);
  });

  function makeResLocal() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }
});
