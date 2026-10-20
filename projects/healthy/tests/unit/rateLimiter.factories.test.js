'use strict';

/**
 * SEC-32 (SA-06/JB-07) + SEC-43 (SA-12): factorías del rate limiter.
 * - generadores de clave (usuario / IP con agrupación IPv6 /64 / email con hash)
 * - store Redis con fallback a memoria
 * - limitadores reales (no-op solo para los exportados en NODE_ENV=test)
 */

jest.mock('../../backend/src/services/redis.service', () => ({
  status: 'end',
  get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn(),
}));

const express = require('../../backend/node_modules/express');
const request = require('supertest');
const logger = require('../../backend/src/utils/logger.util');
const rl = require('../../backend/src/middleware/rateLimiter.middleware');

/** Cliente Redis falso con la API mínima de ioredis que usa el store. */
function fakeRedis(status = 'ready') {
  const data = new Map();
  const ttl = new Map();
  return {
    status,
    data,
    incr: jest.fn(async (k) => { const v = (data.get(k) || 0) + 1; data.set(k, v); return v; }),
    decr: jest.fn(async (k) => { const v = (data.get(k) || 0) - 1; data.set(k, v); return v; }),
    pttl: jest.fn(async (k) => (ttl.has(k) ? ttl.get(k) : -1)),
    pexpire: jest.fn(async (k, ms) => { ttl.set(k, ms); return 1; }),
    del: jest.fn(async (k) => { data.delete(k); ttl.delete(k); return 1; }),
    connect: jest.fn(async () => {}),
  };
}

function appWith(limiter, setUser) {
  const app = express();
  app.use(express.json());
  if (setUser) app.use((req, _res, next) => { req.user = setUser; next(); });
  app.post('/x', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('generadores de clave', () => {
  test('ipKey: IPv4, IPv4 mapeada y valores vacíos', () => {
    expect(rl.ipKey('203.0.113.7')).toBe('203.0.113.7');
    expect(rl.ipKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rl.ipKey(undefined)).toBe('unknown');
  });

  test('ipKey: IPv6 agrupada por /64 (rotar la parte de host no elude el límite)', () => {
    const a = rl.ipKey('2001:db8:abcd:12::1');
    const b = rl.ipKey('2001:0db8:abcd:0012:ffff:ffff:ffff:ffff');
    const c = rl.ipKey('2001:db8:abcd:13::1');
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    expect(rl.ipKey('::1')).toBe('0:0:0:0::/64');
    expect(rl.ipKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(rl.ipKey('64:ff9b::192.0.2.33')).toBe('64:ff9b:0:0::/64');
  });

  test('userOrIpKeyGenerator: usuario si hay req.user, IP si no', () => {
    expect(rl.userOrIpKeyGenerator({ user: { userId: 'u1' }, ip: '1.2.3.4' })).toBe('user:u1');
    expect(rl.userOrIpKeyGenerator({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
    expect(rl.ipKeyGenerator({ user: { userId: 'u1' }, ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  test('emailKeyGenerator: hash del email normalizado (sin PII) y fallback a IP', () => {
    const k1 = rl.emailKeyGenerator({ body: { email: ' Victim@Example.com ' }, ip: '1.1.1.1' });
    const k2 = rl.emailKeyGenerator({ body: { email: 'victim@example.com' }, ip: '2.2.2.2' });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^email:[a-f0-9]{64}$/);
    expect(k1).not.toContain('victim');
    expect(rl.emailKeyGenerator({ body: { email: ['x'] }, ip: '1.1.1.1' })).toBe('ip:1.1.1.1');
    expect(rl.emailKeyGenerator({ ip: '1.1.1.1' })).toBe('ip:1.1.1.1');
  });
});

describe('RedisRateLimitStore', () => {
  let warnSpy;
  beforeEach(() => { warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {}); });
  afterEach(() => warnSpy.mockRestore());

  test('incrementa en Redis y fija la expiración de la ventana', async () => {
    const client = fakeRedis();
    const store = new rl.RedisRateLimitStore({ client, prefix: 'rl:t:' });
    store.init({ windowMs: 60000 });
    const r1 = await store.increment('ip:1.2.3.4');
    const r2 = await store.increment('ip:1.2.3.4');
    expect(r1.totalHits).toBe(1);
    expect(r2.totalHits).toBe(2);
    expect(r2.resetTime).toBeInstanceOf(Date);
    expect(client.pexpire).toHaveBeenCalledWith('rl:t:ip:1.2.3.4', 60000);
    expect(client.data.get('rl:t:ip:1.2.3.4')).toBe(2);
    await store.decrement('ip:1.2.3.4');
    expect(client.data.get('rl:t:ip:1.2.3.4')).toBe(1);
    await store.resetKey('ip:1.2.3.4');
    expect(client.data.has('rl:t:ip:1.2.3.4')).toBe(false);
  });

  test('si Redis no está ready usa memoria y avisa en el log', async () => {
    const client = fakeRedis('end');
    const store = new rl.RedisRateLimitStore({ client, prefix: 'rl:t:' });
    store.init({ windowMs: 60000 });
    const r = await store.increment('k');
    expect(r.totalHits).toBe(1);
    expect(client.incr).not.toHaveBeenCalled();
    await store.decrement('k');
    await store.resetKey('k');
    expect(client.del).not.toHaveBeenCalled();
  });

  test('en estado wait (lazyConnect) inicia la conexión y mientras tanto usa memoria', async () => {
    const client = fakeRedis('wait');
    const store = new rl.RedisRateLimitStore({ client });
    store.init({ windowMs: 1000 });
    await store.increment('k');
    await new Promise((r) => setImmediate(r));
    expect(client.connect).toHaveBeenCalled();
    expect(client.incr).not.toHaveBeenCalled();
  });

  test('si una operación de Redis falla, cae a memoria sin romper la petición', async () => {
    const client = fakeRedis();
    client.incr.mockRejectedValue(new Error('READONLY'));
    client.decr.mockRejectedValue(new Error('READONLY'));
    client.del.mockRejectedValue(new Error('READONLY'));
    const store = new rl.RedisRateLimitStore({ client });
    store.init({ windowMs: 1000 });
    expect((await store.increment('k')).totalHits).toBe(1);
    await expect(store.decrement('k')).resolves.toBeUndefined();
    await expect(store.resetKey('k')).resolves.toBeUndefined();
  });

  test('sin cliente explícito carga redis.service de forma perezosa', async () => {
    const store = new rl.RedisRateLimitStore({});
    store.init({ windowMs: 1000 });
    // El mock de redis.service está en estado 'end' → memoria
    expect((await store.increment('k')).totalHits).toBe(1);
    expect(store.client).toBeDefined();
  });

  test('con client null no usa Redis', async () => {
    const store = new rl.RedisRateLimitStore({ client: null });
    store.init({ windowMs: 1000 });
    expect((await store.increment('k')).totalHits).toBe(1);
  });
});

describe('createLimiter', () => {
  test('aplica el límite y responde 429 con el formato estándar', async () => {
    const limiter = rl.createLimiter({
      name: 't1', windowMs: 60000, max: 2, store: null, keyGenerator: rl.ipKeyGenerator,
      code: 'TOO_MANY_REQUESTS', message: 'Demasiados',
    });
    const app = appWith(limiter);
    expect((await request(app).post('/x')).status).toBe(200);
    expect((await request(app).post('/x')).status).toBe(200);
    const blocked = await request(app).post('/x');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual(expect.objectContaining({ success: false, error: 'TOO_MANY_REQUESTS' }));
  });

  test('por usuario: usuarios distintos tras la misma IP no comparten contador', async () => {
    const mk = () => rl.createLimiter({ name: 't2', windowMs: 60000, max: 1, store: null, code: 'X', message: 'x' });
    const limiter = mk();
    const appA = appWith(limiter, { userId: 'a' });
    const appB = appWith(limiter, { userId: 'b' });
    expect((await request(appA).post('/x')).status).toBe(200);
    expect((await request(appB).post('/x')).status).toBe(200);
    expect((await request(appA).post('/x')).status).toBe(429);
  });

  test('con store Redis el contador se comparte entre instancias (réplicas)', async () => {
    const client = fakeRedis();
    const mk = () => rl.createLimiter({
      name: 't3', windowMs: 60000, max: 2, keyGenerator: rl.ipKeyGenerator, code: 'X', message: 'x',
      store: new rl.RedisRateLimitStore({ client, prefix: 'rl:t3:' }),
    });
    const replica1 = appWith(mk());
    const replica2 = appWith(mk());
    expect((await request(replica1).post('/x')).status).toBe(200);
    expect((await request(replica2).post('/x')).status).toBe(200);
    expect((await request(replica1).post('/x')).status).toBe(429);
  });

  test('por defecto crea un store Redis (fallback a memoria si Redis no está)', async () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const limiter = rl.createLimiter({ name: 't4', windowMs: 60000, max: 1, code: 'X', message: 'x' });
      const app = appWith(limiter);
      expect((await request(app).post('/x')).status).toBe(200);
      expect((await request(app).post('/x')).status).toBe(429);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('exportaciones', () => {
  const NAMES = [
    'authRateLimiter', 'apiLimiter', 'planRegenerateLimiter', 'registrationLimiter', 'planGenerationLimiter',
    'verifyLimiter', 'setPasswordLimiter', 'forgotPasswordLimiter', 'resetPasswordLimiter', 'refreshLimiter',
    'devEndpointsLimiter', 'loginEmailLimiter', 'emailActionLimiter',
  ];

  test('en NODE_ENV=test los limitadores exportados son no-op', () => {
    for (const n of NAMES) {
      const next = jest.fn();
      rl[n]({}, {}, next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('fuera de test se exportan limitadores reales con los mismos nombres', () => {
    const saved = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      jest.isolateModules(() => {
        // eslint-disable-next-line global-require
        const prod = require('../../backend/src/middleware/rateLimiter.middleware');
        for (const n of NAMES) expect(typeof prod[n]).toBe('function');
        expect(typeof prod.createLimiter).toBe('function');
      });
    } finally {
      process.env.NODE_ENV = saved;
    }
  });
});
