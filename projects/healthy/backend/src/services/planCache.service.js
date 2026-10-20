/**
 * Caché Redis de planes generados por IA.
 *
 * SEC-57 (JB-13): la clave incluye un hash de la entrada relevante (si el
 *   usuario cambia perfil/salud, la clave cambia); el plan de respaldo NO se
 *   cachea; invalidación explícita por usuario (índice `plan:idx:{userId}`).
 * SEC-46 (JB-14), parte aiService: fail-closed. Si falta la clave de cifrado o
 *   la de HMAC, o el cifrado falla, NO se cachea (nunca en claro). Al leer se
 *   rechazan valores sin HMAC válido (comparación en tiempo constante) o sin
 *   cifrar. Los errores de `crypto.util` (que pasa a lanzar si falta la clave)
 *   se capturan aquí.
 */

'use strict';

const crypto = require('crypto');
const redis = require('../services/redis.service');
const logger = require('../utils/logger.util');
const { encryptAES256, decryptAES256, hmacSHA256 } = require('../utils/crypto.util');

const AI_PLAN_TTL = 86400; // 24 h (solo planes generados por IA y validados)
const KEY_PREFIX = 'plan';

let warnedDisabled = false;

function getKeys() {
  return {
    encKey: process.env.REDIS_ENCRYPTION_KEY || '',
    hmacKey: process.env.REDIS_HMAC_SECRET || '',
  };
}

/** La caché solo se usa si hay clave de cifrado (64 hex) y secreto HMAC. */
function isCacheEnabled() {
  const { encKey, hmacKey } = getKeys();
  const ok = /^[0-9a-fA-F]{64}$/.test(encKey) && hmacKey.length >= 32;
  if (!ok && !warnedDisabled) {
    warnedDisabled = true;
    logger.warn('[AI-cache] Caché de planes desactivada: REDIS_ENCRYPTION_KEY (64 hex) y REDIS_HMAC_SECRET (≥32) son obligatorias');
  }
  return ok;
}

/** JSON con claves ordenadas (hash estable). */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/**
 * Clave de caché aislada por usuario y ligada a la entrada.
 * @param {string} userId
 * @param {object} input - datos que determinan el plan (onboarding, catálogo, tipo...)
 */
function cacheKeyFor(userId, input) {
  const hash = crypto.createHash('sha256').update(stableStringify(input)).digest('hex').slice(0, 32);
  return `${KEY_PREFIX}:${userId}:${hash}`;
}

const indexKey = (userId) => `${KEY_PREFIX}:idx:${userId}`;

/** Comparación en tiempo constante de dos hex. */
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Guarda un plan cifrado + HMAC. No hace nada si la caché no está configurada.
 * @returns {Promise<boolean>} true si se ha guardado
 */
async function storePlan(userId, key, data) {
  if (!isCacheEnabled()) return false;
  try {
    const { encKey, hmacKey } = getKeys();
    const plaintext = JSON.stringify(data);
    const enc = encryptAES256(plaintext, encKey);
    if (typeof enc !== 'string' || enc === plaintext || enc.split(':').length !== 3) {
      throw new Error('cifrado no disponible');
    }
    const mac = hmacSHA256(enc, hmacKey);
    if (typeof mac !== 'string' || !/^[0-9a-f]{64}$/.test(mac)) throw new Error('HMAC no disponible');
    await redis.set(key, `${mac}:${enc}`, 'EX', AI_PLAN_TTL);
    await redis.set(indexKey(userId), key, 'EX', AI_PLAN_TTL);
    return true;
  } catch (err) {
    logger.warn(`[AI-cache] No se cachea el plan (${err.message})`);
    return false;
  }
}

async function discard(key) {
  try { await redis.del(key); } catch { /* sin acción */ }
}

/**
 * Lee un plan cacheado. Devuelve null si no hay, si la caché está desactivada
 * o si la entrada no tiene un HMAC válido / no está cifrada (se descarta).
 */
async function readPlan(key) {
  if (!isCacheEnabled()) return null;
  try {
    const raw = await redis.get(key);
    if (!raw || typeof raw !== 'string') return null;
    const { encKey, hmacKey } = getKeys();
    const sep = raw.indexOf(':');
    const mac = sep > 0 ? raw.slice(0, sep) : '';
    const payload = sep > 0 ? raw.slice(sep + 1) : '';
    if (!safeEqualHex(mac, hmacSHA256(payload, hmacKey))) {
      logger.warn('[AI-cache] HMAC inválido o ausente — entrada descartada');
      await discard(key);
      return null;
    }
    const decrypted = decryptAES256(payload, encKey);
    if (typeof decrypted !== 'string' || decrypted === payload) {
      logger.warn('[AI-cache] Entrada sin cifrar o no descifrable — descartada');
      await discard(key);
      return null;
    }
    return JSON.parse(decrypted);
  } catch (err) {
    logger.warn(`[AI-cache] Error al leer caché (${err.message})`);
    return null;
  }
}

/** Invalida el último plan cacheado del usuario (al editar perfil/salud o retirar el consentimiento). */
async function invalidateUserPlanCache(userId) {
  try {
    const last = await redis.get(indexKey(userId));
    const keys = [indexKey(userId)];
    if (typeof last === 'string' && last.startsWith(`${KEY_PREFIX}:${userId}:`)) keys.push(last);
    await redis.del(...keys);
    return true;
  } catch (err) {
    logger.warn(`[AI-cache] No se pudo invalidar la caché (${err.message})`);
    return false;
  }
}

module.exports = {
  AI_PLAN_TTL,
  isCacheEnabled,
  stableStringify,
  cacheKeyFor,
  safeEqualHex,
  storePlan,
  readPlan,
  invalidateUserPlanCache,
  _resetWarning() { warnedDisabled = false; },
};
