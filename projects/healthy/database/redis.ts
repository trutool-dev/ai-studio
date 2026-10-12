/**
 * Cliente Redis para la aplicación Healthy.
 * Gestiona caché de planes IA, sesiones, perfiles de usuario y tokens.
 *
 * Usar con ioredis: npm install ioredis
 * Variables de entorno: REDIS_URL (fallback: redis://localhost:6379)
 */

import Redis from 'ioredis';

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE CONEXIÓN
// ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// TTLs en segundos
export const TTL = {
  /** Plan IA generado para el usuario: 24 horas */
  AI_PLAN: 86400,
  /** Refresh token de sesión activa: 30 días */
  SESSION_REFRESH_TOKEN: 2592000,
  /** Perfil de usuario cacheado: 1 hora */
  USER_PROFILE: 3600,
  /** Preferencias nutricionales: 6 horas */
  NUTRITION_PREFS: 21600,
  /** Preferencias de entrenamiento: 6 horas */
  TRAINING_PREFS: 21600,
  /** Rate limiting (ventana de tiempo): 15 minutos */
  RATE_LIMIT: 900,
  /** Código de verificación OTP: 15 minutos */
  OTP_CODE: 900,
} as const;

// ─────────────────────────────────────────────────────────────
// PATRONES DE CLAVES REDIS
// ─────────────────────────────────────────────────────────────

export const CACHE_KEYS = {
  /**
   * Plan IA generado para un usuario en una fecha concreta.
   * Ejemplo: plan:abc-123:2026-06-07
   */
  aiPlan: (userId: string, date: string) => `plan:${userId}:${date}`,

  /**
   * Sesión activa por sessionId (almacena refresh token y metadata).
   * Ejemplo: session:xyz-789
   */
  session: (sessionId: string) => `session:${sessionId}`,

  /**
   * Perfil completo del usuario cacheado.
   * Ejemplo: user:abc-123:profile
   */
  userProfile: (userId: string) => `user:${userId}:profile`,

  /**
   * Preferencias nutricionales del usuario.
   * Ejemplo: user:abc-123:nutrition_prefs
   */
  nutritionPrefs: (userId: string) => `user:${userId}:nutrition_prefs`,

  /**
   * Preferencias de entrenamiento del usuario.
   * Ejemplo: user:abc-123:training_prefs
   */
  trainingPrefs: (userId: string) => `user:${userId}:training_prefs`,

  /**
   * Contador de intentos de login para rate limiting.
   * Ejemplo: rate_limit:login:user@email.com
   */
  rateLimitLogin: (email: string) => `rate_limit:login:${email}`,

  /**
   * Wildcard para invalidar todo lo relacionado con un usuario.
   * Ejemplo: user:abc-123:*
   */
  userWildcard: (userId: string) => `user:${userId}:*`,
} as const;

// ─────────────────────────────────────────────────────────────
// INSTANCIA DEL CLIENTE
// ─────────────────────────────────────────────────────────────

let redisClient: Redis | null = null;

/**
 * Devuelve la instancia singleton del cliente Redis.
 * Crea la conexión si no existe todavía.
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Reconexión automática con backoff exponencial
      retryStrategy(times) {
        if (times > 5) {
          console.error('[Redis] Demasiados intentos de reconexión. Abandonando.');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some(e => err.message.includes(e));
      },
    });

    redisClient.on('connect', () => {
      console.info('[Redis] Conexión establecida con éxito.');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Error de conexión:', err.message);
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Conexión cerrada.');
    });
  }

  return redisClient;
}

// ─────────────────────────────────────────────────────────────
// FUNCIONES DE CACHÉ EXPORTADAS
// ─────────────────────────────────────────────────────────────

/**
 * Obtiene un valor cacheado por su clave.
 * Devuelve null si la clave no existe o ha expirado.
 *
 * @param key - Clave Redis (usar CACHE_KEYS.* para consistencia)
 * @returns El objeto deserializado o null
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (err) {
    console.error(`[Redis] Error al obtener clave "${key}":`, err);
    return null;
  }
}

/**
 * Guarda un valor en caché con TTL.
 *
 * @param key - Clave Redis
 * @param value - Objeto a serializar y cachear
 * @param ttl - Tiempo de vida en segundos (usar TTL.* para consistencia)
 * @returns true si se guardó correctamente, false si hubo error
 */
export async function setCache<T>(key: string, value: T, ttl: number): Promise<boolean> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    await client.set(key, serialized, 'EX', ttl);
    return true;
  } catch (err) {
    console.error(`[Redis] Error al guardar clave "${key}":`, err);
    return false;
  }
}

/**
 * Elimina una clave concreta del caché.
 *
 * @param key - Clave Redis a eliminar
 * @returns true si se eliminó, false si no existía o hubo error
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.del(key);
    return result > 0;
  } catch (err) {
    console.error(`[Redis] Error al eliminar clave "${key}":`, err);
    return false;
  }
}

/**
 * Invalida todas las claves de caché relacionadas con un usuario.
 * Útil cuando el perfil, preferencias o plan del usuario cambian.
 *
 * Elimina:
 *   - user:{userId}:profile
 *   - user:{userId}:nutrition_prefs
 *   - user:{userId}:training_prefs
 *   - plan:{userId}:*  (todos los planes IA de ese usuario)
 *
 * @param userId - ID del usuario a invalidar
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  try {
    const client = getRedisClient();

    // Claves directas a eliminar
    const directKeys = [
      CACHE_KEYS.userProfile(userId),
      CACHE_KEYS.nutritionPrefs(userId),
      CACHE_KEYS.trainingPrefs(userId),
    ];

    // Buscar y eliminar todos los planes IA del usuario
    const planPattern = `plan:${userId}:*`;
    const planKeys = await client.keys(planPattern);

    const allKeys = [...directKeys, ...planKeys];
    if (allKeys.length > 0) {
      await client.del(...allKeys);
      console.info(`[Redis] Invalidadas ${allKeys.length} claves para usuario ${userId}`);
    }
  } catch (err) {
    console.error(`[Redis] Error al invalidar caché del usuario "${userId}":`, err);
  }
}

/**
 * Incrementa un contador en Redis (útil para rate limiting).
 * Si la clave no existe, la crea con TTL.
 *
 * @param key - Clave Redis del contador
 * @param ttl - TTL en segundos si es la primera vez
 * @returns El valor actual del contador
 */
export async function incrementCounter(key: string, ttl: number): Promise<number> {
  try {
    const client = getRedisClient();
    const count = await client.incr(key);
    if (count === 1) {
      // Primera vez: establecer TTL
      await client.expire(key, ttl);
    }
    return count;
  } catch (err) {
    console.error(`[Redis] Error al incrementar contador "${key}":`, err);
    return 0;
  }
}

/**
 * Cierra la conexión Redis limpiamente.
 * Llamar al apagar el servidor (process.on('SIGTERM')).
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.info('[Redis] Conexión cerrada limpiamente.');
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS ESPECÍFICOS DE DOMINIO
// ─────────────────────────────────────────────────────────────

/**
 * Cachea el plan IA de un usuario para una fecha concreta.
 *
 * @param userId - ID del usuario
 * @param date - Fecha en formato YYYY-MM-DD
 * @param plan - Objeto del plan generado por IA
 */
export async function cacheAiPlan(userId: string, date: string, plan: object): Promise<void> {
  const key = CACHE_KEYS.aiPlan(userId, date);
  await setCache(key, plan, TTL.AI_PLAN);
}

/**
 * Obtiene el plan IA cacheado para un usuario y fecha.
 */
export async function getCachedAiPlan<T>(userId: string, date: string): Promise<T | null> {
  const key = CACHE_KEYS.aiPlan(userId, date);
  return getCache<T>(key);
}

/**
 * Cachea el perfil completo de un usuario.
 */
export async function cacheUserProfile(userId: string, profile: object): Promise<void> {
  const key = CACHE_KEYS.userProfile(userId);
  await setCache(key, profile, TTL.USER_PROFILE);
}

/**
 * Obtiene el perfil cacheado de un usuario.
 */
export async function getCachedUserProfile<T>(userId: string): Promise<T | null> {
  const key = CACHE_KEYS.userProfile(userId);
  return getCache<T>(key);
}

/**
 * Almacena una sesión activa (refresh token) en Redis.
 *
 * @param sessionId - ID de la sesión (AuthSession.id)
 * @param sessionData - Datos de la sesión a cachear
 */
export async function cacheSession(sessionId: string, sessionData: object): Promise<void> {
  const key = CACHE_KEYS.session(sessionId);
  await setCache(key, sessionData, TTL.SESSION_REFRESH_TOKEN);
}

/**
 * Obtiene los datos de una sesión cacheada.
 */
export async function getCachedSession<T>(sessionId: string): Promise<T | null> {
  const key = CACHE_KEYS.session(sessionId);
  return getCache<T>(key);
}

/**
 * Invalida una sesión concreta (logout).
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  const key = CACHE_KEYS.session(sessionId);
  await deleteCache(key);
}
