/**
 * Wrapper JavaScript del módulo Redis TypeScript (database/redis.ts).
 * Re-implementa las funciones necesarias usando ioredis directamente
 * para evitar dependencias de TypeScript en runtime (BE-09).
 *
 * TTLs y claves de cache se mantienen consistentes con database/redis.ts.
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// TTLs (en segundos) — sincronizados con database/redis.ts
// ─────────────────────────────────────────────────────────────

const TTL = {
  AI_PLAN: 86400,              // 24 horas
  SESSION_REFRESH_TOKEN: 2592000, // 30 días
  USER_PROFILE: 3600,          // 1 hora
  NUTRITION_PREFS: 21600,      // 6 horas
  TRAINING_PREFS: 21600,       // 6 horas
  RATE_LIMIT: 900,             // 15 minutos
  OTP_CODE: 900,               // 15 minutos
  FOOD_SEARCH: 21600,          // 6 horas (búsquedas de alimentos)
};

// ─────────────────────────────────────────────────────────────
// CLAVES DE CACHÉ
// ─────────────────────────────────────────────────────────────

const CACHE_KEYS = {
  aiPlan: (userId, date) => `plan:${userId}:${date}`,
  session: (sessionId) => `session:${sessionId}`,
  userProfile: (userId) => `user:${userId}:profile`,
  nutritionPrefs: (userId) => `user:${userId}:nutrition_prefs`,
  trainingPrefs: (userId) => `user:${userId}:training_prefs`,
  rateLimitLogin: (email) => `rate_limit:login:${email}`,
  foodSearch: (query) => `foods:search:${query.toLowerCase().trim()}`,
};

// ─────────────────────────────────────────────────────────────
// CLIENTE SINGLETON
// ─────────────────────────────────────────────────────────────

let redisClient = null;

/**
 * Devuelve la instancia singleton del cliente Redis.
 * Crea la conexión si no existe todavía.
 */
function getRedisClient() {
  if (!redisClient) {
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) {
          logger.error('[Redis] Demasiados intentos de reconexión. Abandonando.');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some(e => err.message.includes(e));
      },
    });

    redisClient.on('connect', () => logger.info('[Redis] Conexión establecida.'));
    redisClient.on('error', (err) => logger.error('[Redis] Error:', err.message));
    redisClient.on('close', () => logger.warn('[Redis] Conexión cerrada.'));
  }

  return redisClient;
}

// ─────────────────────────────────────────────────────────────
// OPERACIONES GENÉRICAS
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene un valor cacheado por clave. Devuelve null si no existe.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function getCache(key) {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value);
  } catch (err) {
    logger.error(`[Redis] Error al obtener "${key}":`, err.message);
    return null;
  }
}

/**
 * Guarda un valor en caché con TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - segundos
 * @returns {Promise<boolean>}
 */
async function setCache(key, value, ttl) {
  try {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), 'EX', ttl);
    return true;
  } catch (err) {
    logger.error(`[Redis] Error al guardar "${key}":`, err.message);
    return false;
  }
}

/**
 * Elimina una clave del caché.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function deleteCache(key) {
  try {
    const client = getRedisClient();
    const result = await client.del(key);
    return result > 0;
  } catch (err) {
    logger.error(`[Redis] Error al eliminar "${key}":`, err.message);
    return false;
  }
}

/**
 * Verifica si Redis está conectado.
 * @returns {Promise<boolean>}
 */
async function isRedisConnected() {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE DOMINIO — PLANES IA
// ─────────────────────────────────────────────────────────────

async function getCachedAiPlan(userId, date) {
  return getCache(CACHE_KEYS.aiPlan(userId, date));
}

async function cacheAiPlan(userId, date, plan) {
  return setCache(CACHE_KEYS.aiPlan(userId, date), plan, TTL.AI_PLAN);
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE DOMINIO — SESIONES
// ─────────────────────────────────────────────────────────────

async function cacheSession(sessionId, sessionData) {
  return setCache(CACHE_KEYS.session(sessionId), sessionData, TTL.SESSION_REFRESH_TOKEN);
}

async function getCachedSession(sessionId) {
  return getCache(CACHE_KEYS.session(sessionId));
}

async function invalidateSession(sessionId) {
  return deleteCache(CACHE_KEYS.session(sessionId));
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE DOMINIO — BÚSQUEDA DE ALIMENTOS
// ─────────────────────────────────────────────────────────────

async function getCachedFoodSearch(query) {
  return getCache(CACHE_KEYS.foodSearch(query));
}

async function cacheFoodSearch(query, results) {
  return setCache(CACHE_KEYS.foodSearch(query), results, TTL.FOOD_SEARCH);
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE DOMINIO — PERFIL DE USUARIO
// ─────────────────────────────────────────────────────────────

async function getCachedUserProfile(userId) {
  return getCache(CACHE_KEYS.userProfile(userId));
}

async function cacheUserProfile(userId, profile) {
  return setCache(CACHE_KEYS.userProfile(userId), profile, TTL.USER_PROFILE);
}

/**
 * Invalida todas las claves de un usuario (cuando actualiza perfil/preferencias).
 */
async function invalidateUserCache(userId) {
  try {
    const client = getRedisClient();
    const directKeys = [
      CACHE_KEYS.userProfile(userId),
      CACHE_KEYS.nutritionPrefs(userId),
      CACHE_KEYS.trainingPrefs(userId),
    ];
    const planKeys = await client.keys(`plan:${userId}:*`);
    const allKeys = [...directKeys, ...planKeys];
    if (allKeys.length > 0) {
      await client.del(...allKeys);
      logger.info(`[Redis] Invalidadas ${allKeys.length} claves para usuario ${userId}`);
    }
  } catch (err) {
    logger.error(`[Redis] Error al invalidar caché del usuario "${userId}":`, err.message);
  }
}

/**
 * Cierra la conexión Redis limpiamente.
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis] Conexión cerrada limpiamente.');
  }
}

module.exports = {
  TTL,
  CACHE_KEYS,
  getRedisClient,
  getCache,
  setCache,
  deleteCache,
  isRedisConnected,
  getCachedAiPlan,
  cacheAiPlan,
  cacheSession,
  getCachedSession,
  invalidateSession,
  getCachedFoodSearch,
  cacheFoodSearch,
  getCachedUserProfile,
  cacheUserProfile,
  invalidateUserCache,
  closeRedis,
};
