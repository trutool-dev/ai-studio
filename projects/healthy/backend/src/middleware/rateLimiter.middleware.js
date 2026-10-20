/**
 * Limitadores de peticiones (express-rate-limit 7.x).
 *
 * SEC-32 (SA-06/JB-07) y SEC-43 (SA-12):
 * - Store compartido en Redis (RedisRateLimitStore, sobre el cliente ioredis de
 *   redis.service) para que los contadores sobrevivan a reinicios y se compartan
 *   entre réplicas. Si Redis no está disponible se usa un MemoryStore local y se
 *   avisa en el log (fail-soft: el límite sigue aplicándose por instancia).
 * - keyGenerator por usuario cuando hay `req.user` (limitadores montados después de
 *   `authenticate`) y por IP si no. Las IPv6 se agrupan por prefijo /64 (la versión
 *   7.x de express-rate-limit no trae `ipKeyGenerator`).
 * - Limitadores específicos para verify, set-password, forgot/reset-password, refresh,
 *   rutas dev y límites por email (hash del email, nunca el email en claro en Redis).
 * - `req.ip` solo es la IP real del cliente si `trust proxy` está bien configurado en app.js.
 *
 * En NODE_ENV=test los limitadores exportados son no-op (como antes); las factorías
 * (`createLimiter`, `RedisRateLimitStore`, generadores de clave) se exportan siempre
 * para poder probarlas.
 */

const crypto = require('crypto');
const net = require('net');
const rateLimit = require('express-rate-limit');
const { MemoryStore } = require('express-rate-limit');
const { sendError } = require('../utils/response.util');
const logger = require('../utils/logger.util');

// SEC-22: JWT TTL verificado en auth.controller.js (generateAccessToken usa expiresIn: '15m') — no aplica aquí

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// ─── Generadores de clave ────────────────────────────────────

/** Expande una IPv6 a sus 8 grupos hexadecimales (sin zona). */
function expandIPv6(address) {
  let addr = String(address).split('%')[0];
  // IPv4 embebida al final (p. ej. 64:ff9b::1.2.3.4)
  if (addr.includes('.')) {
    const idx = addr.lastIndexOf(':');
    const octets = addr.slice(idx + 1).split('.').map(Number);
    addr = `${addr.slice(0, idx + 1)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const hasGap = addr.includes('::');
  const [head, tail = ''] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = hasGap && tail ? tail.split(':') : [];
  const fill = hasGap ? Array(Math.max(0, 8 - headParts.length - tailParts.length)).fill('0') : [];
  return [...headParts, ...fill, ...tailParts].map((g) => parseInt(g || '0', 16).toString(16));
}

/**
 * Normaliza una IP para usarla como clave: IPv4 tal cual (también la mapeada
 * ::ffff:a.b.c.d) e IPv6 agrupada por /64 (un cliente IPv6 suele controlar un /64
 * completo; sin agrupar podría rotar direcciones para eludir el límite).
 */
function ipKey(ip) {
  if (!ip) return 'unknown';
  const value = String(ip);
  if (value.toLowerCase().startsWith('::ffff:') && net.isIPv4(value.slice(7))) return value.slice(7);
  if (net.isIPv6(value)) return `${expandIPv6(value).slice(0, 4).join(':')}::/64`;
  return value;
}

/** Clave por IP. */
const ipKeyGenerator = (req) => `ip:${ipKey(req.ip)}`;

/** Clave por usuario autenticado; por IP si no hay `req.user`. */
const userOrIpKeyGenerator = (req) => (req.user && req.user.userId
  ? `user:${req.user.userId}`
  : ipKeyGenerator(req));

/** Clave por email del body (hash SHA-256, sin PII en el store); por IP si no hay email. */
const emailKeyGenerator = (req) => {
  const email = req.body && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) return ipKeyGenerator(req);
  return `email:${crypto.createHash('sha256').update(email).digest('hex')}`;
};

// ─── Store en Redis con fallback a memoria ───────────────────

const WARN_INTERVAL_MS = 60 * 1000;
let lastWarnAt = 0;
function warnFallback(reason) {
  const now = Date.now();
  if (now - lastWarnAt < WARN_INTERVAL_MS) return;
  lastWarnAt = now;
  logger.warn(`[rate-limit] Redis no disponible (${reason}); usando store en memoria local`);
}

/**
 * Store de express-rate-limit sobre un cliente ioredis.
 * Usa INCR + PTTL/PEXPIRE (ventana fija). Si el cliente no está `ready` o una
 * operación falla, delega en un MemoryStore local.
 */
class RedisRateLimitStore {
  /**
   * @param {object} opts
   * @param {object} [opts.client] cliente ioredis (por defecto, redis.service)
   * @param {string} [opts.prefix] prefijo de las claves en Redis
   */
  constructor({ client, prefix = 'rl:' } = {}) {
    this.client = client;
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 15 * MINUTE;
    this.fallback = new MemoryStore();
    this.connecting = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  getClient() {
    if (this.client === undefined) {
      // Carga perezosa: evita abrir conexión al importar el módulo
      // eslint-disable-next-line global-require
      this.client = require('../services/redis.service');
    }
    return this.client;
  }

  /** true si se puede usar Redis ahora mismo; si está en espera (lazyConnect) inicia la conexión. */
  isAvailable() {
    const client = this.getClient();
    if (!client) return false;
    if (client.status === 'ready') return true;
    if (client.status === 'wait' && !this.connecting && typeof client.connect === 'function') {
      this.connecting = true;
      Promise.resolve()
        .then(() => client.connect())
        .catch(() => {})
        .finally(() => { this.connecting = false; });
    }
    warnFallback(`estado ${client.status || 'desconocido'}`);
    return false;
  }

  async increment(key) {
    if (!this.isAvailable()) return this.fallback.increment(key);
    try {
      const redisKey = this.prefix + key;
      const totalHits = Number(await this.client.incr(redisKey));
      let ttl = Number(await this.client.pttl(redisKey));
      if (!(ttl > 0)) {
        await this.client.pexpire(redisKey, this.windowMs);
        ttl = this.windowMs;
      }
      return { totalHits, resetTime: new Date(Date.now() + ttl) };
    } catch (err) {
      warnFallback(err.message);
      return this.fallback.increment(key);
    }
  }

  async decrement(key) {
    if (!this.isAvailable()) return this.fallback.decrement(key);
    try {
      await this.client.decr(this.prefix + key);
    } catch (err) {
      warnFallback(err.message);
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key) {
    await this.fallback.resetKey(key);
    if (!this.isAvailable()) return;
    try {
      await this.client.del(this.prefix + key);
    } catch (err) {
      warnFallback(err.message);
    }
  }
}

// ─── Factoría ────────────────────────────────────────────────

/**
 * Crea un limitador con respuesta en el formato estándar de la API.
 * @param {object} opts
 * @param {string} opts.name       identificador (prefijo de las claves en Redis)
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {string} opts.code       código de error en la respuesta 429
 * @param {string} opts.message    mensaje en la respuesta 429
 * @param {Function} [opts.keyGenerator=userOrIpKeyGenerator]
 * @param {object|null} [opts.store] store explícito; null → MemoryStore; por defecto Redis
 */
function createLimiter({ name, windowMs, max, code, message, keyGenerator = userOrIpKeyGenerator, store }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: store === undefined ? new RedisRateLimitStore({ prefix: `rl:${name}:` }) : (store || undefined),
    handler: (_req, res) => sendError(res, code, message, 429),
  });
}

const factories = {
  createLimiter,
  RedisRateLimitStore,
  ipKey,
  ipKeyGenerator,
  userOrIpKeyGenerator,
  emailKeyGenerator,
};

const TOO_MANY = 'Demasiados intentos. Inténtalo de nuevo más tarde.';

// En modo test, los rate limiters son no-op para evitar 429 en tests
if (process.env.NODE_ENV === 'test') {
  const noOp = (_req, _res, next) => next();
  module.exports = {
    ...factories,
    authRateLimiter: noOp,
    apiLimiter: noOp,
    planRegenerateLimiter: noOp,
    registrationLimiter: noOp,   // SEC-05
    planGenerationLimiter: noOp, // SEC-06
    verifyLimiter: noOp,
    setPasswordLimiter: noOp,
    forgotPasswordLimiter: noOp,
    resetPasswordLimiter: noOp,
    refreshLimiter: noOp,
    devEndpointsLimiter: noOp,
    loginEmailLimiter: noOp,
    emailActionLimiter: noOp,
  };
} else {
  // 5 / 15 min por IP (login, resend, register)
  const authRateLimiter = createLimiter({
    name: 'auth', windowMs: 15 * MINUTE, max: 5, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.',
  });

  // 100 / 15 min por usuario (se monta después de `authenticate` en app.js)
  const apiLimiter = createLimiter({
    name: 'api', windowMs: 15 * MINUTE, max: 100,
    code: 'RATE_LIMIT_EXCEEDED', message: 'Has superado el límite de peticiones. Por favor espera 15 minutos.',
  });

  const planRegenerateLimiter = createLimiter({
    name: 'plan-regen', windowMs: 24 * HOUR, max: 3,
    code: 'PLAN_REGEN_LIMIT', message: 'Máximo 3 regeneraciones de plan por día',
  });

  // SEC-05: máx 3 registros por IP por hora
  const registrationLimiter = createLimiter({
    name: 'register', windowMs: HOUR, max: 3, keyGenerator: ipKeyGenerator,
    code: 'REGISTRATION_LIMIT', message: 'Demasiados registros desde esta IP. Inténtalo más tarde.',
  });

  // SEC-06: máx 1 generación de plan nuevo por usuario/día
  const planGenerationLimiter = createLimiter({
    name: 'plan-gen', windowMs: 24 * HOUR, max: 1,
    code: 'PLAN_GENERATION_LIMIT', message: 'Ya has generado un plan hoy. Usa /plans/regenerate para actualizarlo.',
  });

  // SEC-43: rutas de /auth que no tenían limitador
  const verifyLimiter = createLimiter({
    name: 'verify', windowMs: 15 * MINUTE, max: 10, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  const setPasswordLimiter = createLimiter({
    name: 'set-password', windowMs: 15 * MINUTE, max: 10, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  const forgotPasswordLimiter = createLimiter({
    name: 'forgot', windowMs: HOUR, max: 5, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  // reset-password hace bcrypt de 12 rondas: límite estricto contra DoS de CPU
  const resetPasswordLimiter = createLimiter({
    name: 'reset', windowMs: 15 * MINUTE, max: 10, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  // refresh se usa cada 15 min por la app: margen amplio para varios usuarios tras un NAT
  const refreshLimiter = createLimiter({
    name: 'refresh', windowMs: 15 * MINUTE, max: 60, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  const devEndpointsLimiter = createLimiter({
    name: 'dev', windowMs: 15 * MINUTE, max: 20, keyGenerator: ipKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });
  // SA-06: límites por email (además de por IP). Login: 10 / 15 min por cuenta
  const loginEmailLimiter = createLimiter({
    name: 'login-email', windowMs: 15 * MINUTE, max: 10, keyGenerator: emailKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.',
  });
  // Envío de emails (forgot / resend / register): 5 / hora por destinatario (anti mail-bombing)
  const emailActionLimiter = createLimiter({
    name: 'email-action', windowMs: HOUR, max: 5, keyGenerator: emailKeyGenerator,
    code: 'TOO_MANY_REQUESTS', message: TOO_MANY,
  });

  module.exports = {
    ...factories,
    authRateLimiter,
    apiLimiter,
    planRegenerateLimiter,
    registrationLimiter,
    planGenerationLimiter,
    verifyLimiter,
    setPasswordLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    refreshLimiter,
    devEndpointsLimiter,
    loginEmailLimiter,
    emailActionLimiter,
  };
}
