const Redis = require('ioredis');

// TTL del plan en caché: 24 horas (en segundos)
const PLAN_CACHE_TTL = 60 * 60 * 24;

// Prefijo de clave para evitar colisiones con otros servicios
const CACHE_PREFIX = 'healthy:plan:';

let redisClient = null;

/**
 * Inicializa la conexión con Redis.
 * Falla silenciosamente si Redis no está disponible (el servicio sigue funcionando).
 */
function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      // Reconexión automática con backoff exponencial
      retryStrategy: (times) => Math.min(times * 100, 3000),
      // No bloquear el proceso si Redis no está disponible
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      // Logging no bloqueante: el servicio funciona sin caché
      console.warn('[CacheService] Redis no disponible:', err.message);
    });
  } catch (err) {
    console.warn('[CacheService] No se pudo inicializar Redis:', err.message);
    return null;
  }

  return redisClient;
}

/**
 * Guarda un plan en caché.
 *
 * @param {string} userId - ID del usuario
 * @param {Object} planData - Datos del plan a cachear
 * @returns {Promise<void>}
 */
async function cachePlan(userId, planData) {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = `${CACHE_PREFIX}${userId}`;
    await client.setex(key, PLAN_CACHE_TTL, JSON.stringify(planData));
  } catch (err) {
    console.warn('[CacheService] Error al guardar en caché:', err.message);
  }
}

/**
 * Obtiene un plan del caché.
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Plan cacheado o null si no existe
 */
async function getCachedPlan(userId) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const key = `${CACHE_PREFIX}${userId}`;
    const cached = await client.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.warn('[CacheService] Error al leer caché:', err.message);
    return null;
  }
}

/**
 * Invalida el caché de un usuario (forzar regeneración).
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<void>}
 */
async function invalidatePlanCache(userId) {
  const client = getRedisClient();
  if (!client) return;

  try {
    const key = `${CACHE_PREFIX}${userId}`;
    await client.del(key);
  } catch (err) {
    console.warn('[CacheService] Error al invalidar caché:', err.message);
  }
}

module.exports = { cachePlan, getCachedPlan, invalidatePlanCache };
