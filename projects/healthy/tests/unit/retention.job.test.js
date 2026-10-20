'use strict';

/**
 * SEC-50 (SA-21): job de retención de sesiones, OTP, tokens de reset e IPs.
 * Se inyecta un Prisma falso en memoria con la semántica de Prisma para `lt`
 * (los NULL no cumplen la comparación); nunca se conecta a una BD real.
 */

const { runRetention, getRetentionConfig, DEFAULT_RETENTION_DAYS } = require('../../backend/src/jobs/retention');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-20T03:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const ahead = (days) => new Date(NOW.getTime() + days * DAY);

function matches(row, where) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((c) => matches(row, c));
    const v = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('lt' in cond) return v instanceof Date && v < cond.lt;
      if ('not' in cond) return v !== cond.not && v !== undefined;
    }
    return v === cond;
  });
}

function fakePrisma(tables) {
  const model = (name) => ({
    deleteMany: jest.fn(async ({ where }) => {
      const before = tables[name].length;
      tables[name] = tables[name].filter((r) => !matches(r, where));
      return { count: before - tables[name].length };
    }),
    updateMany: jest.fn(async ({ where, data }) => {
      let count = 0;
      tables[name] = tables[name].map((r) => (matches(r, where) ? (count++, { ...r, ...data }) : r));
      return { count };
    }),
  });
  return {
    tables,
    authSession: model('authSession'),
    verificationCode: model('verificationCode'),
    passwordResetToken: model('passwordResetToken'),
  };
}

function seed() {
  return fakePrisma({
    authSession: [
      { id: 'active', expires_at: ahead(10), revoked_at: null, created_at: ago(5), ip_address: '1.1.1.1' },
      { id: 'expired-recent', expires_at: ago(10), revoked_at: null, created_at: ago(40), ip_address: '2.2.2.2' },
      { id: 'expired-old', expires_at: ago(31), revoked_at: null, created_at: ago(61), ip_address: '3.3.3.3' },
      { id: 'revoked-old', expires_at: ahead(5), revoked_at: ago(45), created_at: ago(50), ip_address: '4.4.4.4' },
      { id: 'revoked-recent', expires_at: ahead(5), revoked_at: ago(2), created_at: ago(20), ip_address: null },
      { id: 'alive-old-ip', expires_at: ahead(1), revoked_at: null, created_at: ago(100), ip_address: '5.5.5.5' },
    ],
    verificationCode: [
      { id: 'pending', expires_at: ahead(0.01), used_at: null },
      { id: 'expired-recent', expires_at: ago(1), used_at: null },
      { id: 'expired-old', expires_at: ago(40), used_at: null },
      { id: 'used-old', expires_at: ago(29), used_at: ago(35) },
    ],
    passwordResetToken: [
      { id: 'pending', expires_at: ahead(0.02), used_at: null },
      { id: 'used-recent', expires_at: ago(1), used_at: ago(1) },
      { id: 'expired-old', expires_at: ago(31), used_at: null },
    ],
  });
}

describe('runRetention', () => {
  test('purga solo lo caducado/usado/revocado hace más del plazo y anonimiza IPs antiguas', async () => {
    const prisma = seed();
    const logger = { info: jest.fn() };
    const result = await runRetention({ prisma, now: NOW, config: { ...DEFAULT_RETENTION_DAYS }, logger });

    expect(result).toEqual({ sessions: 2, otpCodes: 2, resetTokens: 1, ipsAnonymized: 1 });
    expect(prisma.tables.authSession.map((s) => s.id).sort())
      .toEqual(['active', 'alive-old-ip', 'expired-recent', 'revoked-recent']);
    expect(prisma.tables.verificationCode.map((c) => c.id).sort()).toEqual(['expired-recent', 'pending']);
    expect(prisma.tables.passwordResetToken.map((t) => t.id).sort()).toEqual(['pending', 'used-recent']);
    expect(prisma.tables.authSession.find((s) => s.id === 'alive-old-ip').ip_address).toBeNull();
    expect(prisma.tables.authSession.find((s) => s.id === 'active').ip_address).toBe('1.1.1.1');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('[retention]'));
  });

  test('es idempotente', async () => {
    const prisma = seed();
    await runRetention({ prisma, now: NOW });
    const second = await runRetention({ prisma, now: NOW });
    expect(second).toEqual({ sessions: 0, otpCodes: 0, resetTokens: 0, ipsAnonymized: 0 });
  });

  test('plazos configurables', async () => {
    const prisma = seed();
    const r = await runRetention({ prisma, now: NOW, config: { sessionDays: 1, otpDays: 1, resetDays: 1, ipDays: 365 } });
    expect(r.sessions).toBe(4);
    expect(r.ipsAnonymized).toBe(0);
  });

  test('exige cliente prisma', async () => {
    await expect(runRetention({})).rejects.toThrow(/prisma/);
    await expect(runRetention()).rejects.toThrow(/prisma/);
  });
});

describe('getRetentionConfig', () => {
  test('valores por defecto conservadores', () => {
    expect(getRetentionConfig({})).toEqual({ sessionDays: 30, otpDays: 30, resetDays: 30, ipDays: 90 });
  });

  test('lee variables de entorno e ignora valores inválidos', () => {
    expect(getRetentionConfig({
      RETENTION_SESSION_DAYS: '60', RETENTION_OTP_DAYS: '0', RETENTION_RESET_DAYS: 'abc', RETENTION_IP_DAYS: '180',
    })).toEqual({ sessionDays: 60, otpDays: 30, resetDays: 30, ipDays: 180 });
  });

  test('sin argumentos usa process.env', () => {
    expect(getRetentionConfig()).toEqual(expect.objectContaining({ ipDays: expect.any(Number) }));
  });
});
