/**
 * Medición de uso de tokens y cuota diaria por usuario (SEC-56 / JB-12).
 *
 * - Cada respuesta de Anthropic se registra en `TokenUsageLog` (modelo ya
 *   existente; no se cambia el esquema) con coste estimado.
 * - Contador diario por usuario en Redis (`ai:tokens:{userId}:{AAAA-MM-DD}`);
 *   si se supera `AI_DAILY_TOKEN_LIMIT` no se llama a la IA (plan de respaldo).
 * - Si Redis falla, la cuota falla en abierto (se registra un aviso): los
 *   limitadores de peticiones por usuario siguen aplicándose. Decisión
 *   documentada: disponibilidad frente a coste acotado.
 */

'use strict';

const prisma = require('../prisma/client');
const redis = require('../services/redis.service');
const logger = require('../utils/logger.util');

const DEFAULT_DAILY_TOKEN_LIMIT = 60000;
const QUOTA_TTL_SECONDS = 2 * 24 * 3600;

// Precio estimado en USD por millón de tokens (revisar con la tarifa vigente).
const PRICING_PER_MTOK = Object.freeze({
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
});

/** Límite diario configurado (0 = sin cuota). */
function getDailyTokenLimit() {
  const raw = process.env.AI_DAILY_TOKEN_LIMIT;
  if (raw === undefined || raw === '') return DEFAULT_DAILY_TOKEN_LIMIT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_TOKEN_LIMIT;
}

const today = () => new Date().toISOString().slice(0, 10);
const quotaKey = (userId, day = today()) => `ai:tokens:${userId}:${day}`;

/**
 * ¿Puede el usuario hacer otra llamada a la IA hoy?
 * @returns {Promise<{ allowed: boolean, used: number, limit: number }>}
 */
async function checkTokenQuota(userId) {
  const limit = getDailyTokenLimit();
  if (limit === 0) return { allowed: true, used: 0, limit };
  try {
    const used = parseInt(await redis.get(quotaKey(userId)), 10) || 0;
    return { allowed: used < limit, used, limit };
  } catch (err) {
    logger.warn(`[AI-usage] No se pudo comprobar la cuota (${err.message}); se permite la llamada`);
    return { allowed: true, used: 0, limit };
  }
}

/** Coste estimado en USD de un `usage` de Anthropic. */
function estimateCostUsd(model, usage) {
  const p = PRICING_PER_MTOK[model] || PRICING_PER_MTOK['claude-sonnet-4-6'];
  const cost = ((usage.input_tokens || 0) * p.input
    + (usage.output_tokens || 0) * p.output
    + (usage.cache_creation_input_tokens || 0) * p.cacheWrite
    + (usage.cache_read_input_tokens || 0) * p.cacheRead) / 1e6;
  return Math.round(cost * 1e6) / 1e6;
}

/**
 * Registra el uso de una respuesta (BD + contador diario). Nunca lanza.
 * @param {{ userId: string, requestType: string, model: string, usage: object|undefined }} params
 */
async function recordTokenUsage({ userId, requestType, model, usage }) {
  if (!usage || typeof usage !== 'object') return;
  const input = Number(usage.input_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;
  const cacheRead = Number(usage.cache_read_input_tokens) || 0;
  const cacheWrite = Number(usage.cache_creation_input_tokens) || 0;
  const total = input + output + cacheRead + cacheWrite;

  try {
    await prisma.tokenUsageLog.create({
      data: {
        user_id: userId,
        request_type: String(requestType).slice(0, 50),
        input_tokens: input,
        output_tokens: output,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
        model_version: model,
        cost_usd: estimateCostUsd(model, usage),
      },
    });
  } catch (err) {
    logger.warn(`[AI-usage] No se pudo registrar TokenUsageLog (${err.message})`);
  }

  try {
    const key = quotaKey(userId);
    if (typeof redis.incrby === 'function') {
      await redis.incrby(key, total);
    } else {
      const current = parseInt(await redis.get(key), 10) || 0;
      await redis.set(key, String(current + total));
    }
    await redis.expire(key, QUOTA_TTL_SECONDS);
  } catch (err) {
    logger.warn(`[AI-usage] No se pudo actualizar la cuota diaria (${err.message})`);
  }

  logger.info(`[AI-usage] userId=${userId} tipo=${requestType} in=${input} out=${output} cacheRead=${cacheRead} cacheWrite=${cacheWrite} limiteDiario=${getDailyTokenLimit()}`);
}

module.exports = {
  DEFAULT_DAILY_TOKEN_LIMIT,
  PRICING_PER_MTOK,
  getDailyTokenLimit,
  quotaKey,
  checkTokenQuota,
  estimateCostUsd,
  recordTokenUsage,
};
