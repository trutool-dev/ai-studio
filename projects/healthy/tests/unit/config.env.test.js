'use strict';

/**
 * SEC-46 (SA-16 + JB-14) — validación de entorno al arrancar (backend/src/config/env.js).
 * Todos los valores son ficticios y generados en el propio test.
 */

const crypto = require('crypto');
const {
  validateEnv,
  assertValidEnv,
  parseDurationToSeconds,
  isStrictEnv,
} = require('../../backend/src/config/env');

const secret = (n = 64) => crypto.randomBytes(n).toString('hex').slice(0, n);

function validProdEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    JWT_SECRET: secret(64),
    JWT_REFRESH_SECRET: secret(64),
    JWT_EXPIRES_IN: '15m',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    REDIS_HMAC_SECRET: secret(64),
    FRONTEND_URL: 'https://app.example.test',
    ANTHROPIC_API_KEY: 'placeholder',
    SMTP_HOST: 'smtp.example.test',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    ...overrides,
  };
}

const silentLogger = () => ({ warn: jest.fn(), error: jest.fn() });

describe('parseDurationToSeconds', () => {
  test.each([
    ['15m', 900],
    ['900s', 900],
    ['1h', 3600],
    ['2H', 7200],
    ['1d', 86400],
    [' 30m ', 1800],
    ['900', null],      // jsonwebtoken lo interpretaría como ms → ambiguo, se rechaza
    ['abc', null],
    ['0m', null],
    ['', null],
    [undefined, null],
  ])('%p → %p', (v, expected) => expect(parseDurationToSeconds(v)).toBe(expected));
});

describe('isStrictEnv', () => {
  test('production y staging son estrictos', () => {
    expect(isStrictEnv('production')).toBe(true);
    expect(isStrictEnv('staging')).toBe(true);
    expect(isStrictEnv('development')).toBe(false);
    expect(isStrictEnv('test')).toBe(false);
  });
});

describe('validateEnv — producción', () => {
  test('configuración completa → sin errores ni avisos', () => {
    const r = validateEnv(validProdEnv());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.strict).toBe(true);
  });

  test.each([
    'JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'REDIS_ENCRYPTION_KEY', 'REDIS_HMAC_SECRET',
  ])('falta %s → error', (name) => {
    const env = validProdEnv();
    delete env[name];
    const r = validateEnv(env);
    expect(r.errors.join('\n')).toContain(name);
  });

  test('JWT_SECRET de menos de 32 caracteres → error', () => {
    const r = validateEnv(validProdEnv({ JWT_SECRET: 'x'.repeat(31) }));
    expect(r.errors.join('\n')).toMatch(/JWT_SECRET debe tener al menos 32/);
  });

  test('JWT_SECRET entre 32 y 63 caracteres → solo aviso', () => {
    const r = validateEnv(validProdEnv({ JWT_SECRET: 'x'.repeat(40) }));
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/JWT_SECRET: se recomiendan/);
  });

  test('JWT_REFRESH_SECRET igual a JWT_SECRET → error', () => {
    const s = secret(64);
    const r = validateEnv(validProdEnv({ JWT_SECRET: s, JWT_REFRESH_SECRET: s }));
    expect(r.errors.join('\n')).toMatch(/distinto de JWT_SECRET/);
  });

  test.each(['2h', '1d', '86400s'])('JWT_EXPIRES_IN=%s (> 1h) → error', (v) => {
    const r = validateEnv(validProdEnv({ JWT_EXPIRES_IN: v }));
    expect(r.errors.join('\n')).toMatch(/JWT_EXPIRES_IN no puede superar 1h/);
  });

  test('JWT_EXPIRES_IN=1h está permitido; ausente usa el defecto (15m)', () => {
    expect(validateEnv(validProdEnv({ JWT_EXPIRES_IN: '1h' })).errors).toEqual([]);
    const env = validProdEnv();
    delete env.JWT_EXPIRES_IN;
    expect(validateEnv(env).errors).toEqual([]);
  });

  test('JWT_EXPIRES_IN con formato inválido → error', () => {
    const r = validateEnv(validProdEnv({ JWT_EXPIRES_IN: '3600' }));
    expect(r.errors.join('\n')).toMatch(/JWT_EXPIRES_IN no es válido/);
  });

  test('DATABASE_URL que no es postgres → error', () => {
    const r = validateEnv(validProdEnv({ DATABASE_URL: 'mysql://x' }));
    expect(r.errors.join('\n')).toMatch(/postgresql/);
  });

  test.each(['abc', 'z'.repeat(64), 'a'.repeat(63)])('REDIS_ENCRYPTION_KEY=%p inválida → error', (k) => {
    const r = validateEnv(validProdEnv({ REDIS_ENCRYPTION_KEY: k }));
    expect(r.errors.join('\n')).toMatch(/REDIS_ENCRYPTION_KEY debe tener 64/);
  });

  test('REDIS_HMAC_SECRET corto → error', () => {
    const r = validateEnv(validProdEnv({ REDIS_HMAC_SECRET: 'short' }));
    expect(r.errors.join('\n')).toMatch(/REDIS_HMAC_SECRET debe tener/);
  });

  test.each(['ADMIN_TOKEN', 'DEV_ENDPOINTS_TOKEN', 'OTP_HASH_SECRET'])('%s definido pero corto → error', (name) => {
    const r = validateEnv(validProdEnv({ [name]: 'short' }));
    expect(r.errors.join('\n')).toContain(name);
  });

  test.each(['true', 'abc', '11', '-1'])('TRUST_PROXY=%p → error', (v) => {
    const r = validateEnv(validProdEnv({ TRUST_PROXY: v }));
    expect(r.errors.join('\n')).toMatch(/TRUST_PROXY/);
  });

  test('TRUST_PROXY=1 válido', () => {
    expect(validateEnv(validProdEnv({ TRUST_PROXY: '1' })).errors).toEqual([]);
  });

  test('ENABLE_DEV_ENDPOINTS=true en producción → error', () => {
    const r = validateEnv(validProdEnv({ ENABLE_DEV_ENDPOINTS: 'true' }));
    expect(r.errors.join('\n')).toMatch(/ENABLE_DEV_ENDPOINTS/);
  });

  test('sin SMTP en producción → error', () => {
    const env = validProdEnv();
    delete env.SMTP_PASS;
    expect(validateEnv(env).errors.join('\n')).toMatch(/SMTP_PASS/);
  });

  test('sin FRONTEND_URL ni ANTHROPIC_API_KEY → avisos', () => {
    const env = validProdEnv();
    delete env.FRONTEND_URL;
    delete env.ANTHROPIC_API_KEY;
    const r = validateEnv(env);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/FRONTEND_URL/);
    expect(r.warnings.join('\n')).toMatch(/ANTHROPIC_API_KEY/);
  });
});

describe('validateEnv — staging', () => {
  test('staging es estricto con los secretos pero SMTP solo avisa', () => {
    const env = validProdEnv({ NODE_ENV: 'staging', ENABLE_DEV_ENDPOINTS: 'true' });
    delete env.SMTP_HOST;
    delete env.JWT_SECRET;
    const r = validateEnv(env);
    expect(r.errors.join('\n')).toMatch(/JWT_SECRET es obligatorio/);
    expect(r.errors.join('\n')).not.toMatch(/SMTP/);
    expect(r.errors.join('\n')).not.toMatch(/ENABLE_DEV_ENDPOINTS/);
    expect(r.warnings.join('\n')).toMatch(/SMTP_HOST/);
  });
});

describe('validateEnv — NODE_ENV fuera de la lista blanca (fail-closed)', () => {
  test.each([undefined, '', 'prod', 'Production', 'staging '])('NODE_ENV=%p → error', (v) => {
    const r = validateEnv(validProdEnv({ NODE_ENV: v }));
    expect(r.errors.join('\n')).toMatch(/NODE_ENV debe ser uno de/);
  });
});

describe('validateEnv — development/test (solo avisos)', () => {
  test('entorno vacío en development → sin errores, con avisos', () => {
    const r = validateEnv({ NODE_ENV: 'development' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.strict).toBe(false);
  });

  test('test con JWT_EXPIRES_IN excesivo → aviso, no error', () => {
    const r = validateEnv({ NODE_ENV: 'test', JWT_EXPIRES_IN: '7d' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toMatch(/JWT_EXPIRES_IN/);
  });
});

describe('assertValidEnv', () => {
  test('producción inválida → lanza INVALID_ENV y registra los errores sin valores', () => {
    const logger = silentLogger();
    const env = validProdEnv({ JWT_SECRET: 'x' });
    let thrown;
    try { assertValidEnv({ env, logger }); } catch (e) { thrown = e; }
    expect(thrown).toBeDefined();
    expect(thrown.code).toBe('INVALID_ENV');
    expect(thrown.details.length).toBeGreaterThan(0);
    expect(logger.error).toHaveBeenCalled();
    // Nunca se registran los valores de los secretos
    const logged = logger.error.mock.calls.flat().join('\n');
    expect(logged).not.toContain(env.REDIS_HMAC_SECRET);
    expect(logged).not.toContain(env.DATABASE_URL);
  });

  test('producción válida → no lanza', () => {
    const logger = silentLogger();
    expect(() => assertValidEnv({ env: validProdEnv(), logger })).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('development incompleto → no lanza y avisa', () => {
    const logger = silentLogger();
    expect(() => assertValidEnv({ env: { NODE_ENV: 'development' }, logger })).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });

  test('usa process.env y console por defecto', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    expect(() => assertValidEnv()).not.toThrow();
    process.env.NODE_ENV = original;
    warn.mockRestore();
  });
});
