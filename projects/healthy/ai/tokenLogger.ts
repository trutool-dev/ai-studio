/**
 * Logger de uso de tokens de la API de Anthropic.
 * Registra cada llamada con tokens usados y coste estimado.
 *
 * Actualmente solo hace console.log formateado.
 * El Backend Agent conectará esto a la base de datos en una fase posterior.
 *
 * Precios claude-sonnet-4-6 (USD por millón de tokens):
 *   - Input:       $3.00 / MTok
 *   - Output:      $15.00 / MTok
 *   - Cache read:  $0.30 / MTok
 *   - Cache write: $3.75 / MTok  (mismo precio que input normal × 1.25)
 */

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface TokenUsageLog {
  userId: string;
  requestType: 'plan_generation' | 'plan_regeneration';
  inputTokens: number;
  outputTokens: number;
  /** Tokens leídos desde el caché de Anthropic (prompt caching) */
  cacheReadTokens: number;
  /** Tokens escritos al caché de Anthropic (prompt caching) */
  cacheWriteTokens: number;
  modelVersion: string;
  /** ISO 8601 */
  timestamp: string;
  /** Coste estimado en dólares USD */
  cost_usd_estimate: number;
}

// ─────────────────────────────────────────────────────────────
// PRECIOS (USD por token)
// ─────────────────────────────────────────────────────────────

const PRICE_PER_TOKEN = {
  /** $3.00 por millón = $0.000003 por token */
  input: 3.0 / 1_000_000,
  /** $15.00 por millón = $0.000015 por token */
  output: 15.0 / 1_000_000,
  /** $0.30 por millón = $0.0000003 por token */
  cache_read: 0.30 / 1_000_000,
  /** $3.75 por millón = $0.00000375 por token */
  cache_write: 3.75 / 1_000_000,
} as const;

// ─────────────────────────────────────────────────────────────
// FUNCIONES
// ─────────────────────────────────────────────────────────────

/**
 * Calcula el coste estimado en USD de una llamada a Claude.
 *
 * @param inputTokens    - Tokens de entrada (no cacheados)
 * @param outputTokens   - Tokens de salida
 * @param cacheReadTokens  - Tokens leídos desde el caché de Anthropic
 * @param cacheWriteTokens - Tokens escritos al caché de Anthropic
 * @returns Coste estimado en USD
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheWriteTokens: number = 0,
): number {
  const cost =
    inputTokens * PRICE_PER_TOKEN.input +
    outputTokens * PRICE_PER_TOKEN.output +
    cacheReadTokens * PRICE_PER_TOKEN.cache_read +
    cacheWriteTokens * PRICE_PER_TOKEN.cache_write;

  // Redondear a 6 decimales para evitar ruido de punto flotante
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Registra el uso de tokens de una llamada a Claude.
 * Por ahora emite un console.log formateado.
 * El Backend Agent conectará esto a la tabla token_usage_logs en la DB.
 *
 * @param usage - Datos de uso de tokens
 */
export function logTokenUsage(usage: TokenUsageLog): void {
  const totalTokens = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;

  // Calcular ahorro por prompt caching (qué habría costado sin caché)
  const costWithoutCache = estimateCost(
    usage.inputTokens + usage.cacheReadTokens,
    usage.outputTokens,
  );
  const cacheSavings = Math.max(0, costWithoutCache - usage.cost_usd_estimate);

  console.log(
    [
      '[TokenLogger]',
      `user=${usage.userId}`,
      `type=${usage.requestType}`,
      `model=${usage.modelVersion}`,
      `input=${usage.inputTokens}tok`,
      `output=${usage.outputTokens}tok`,
      `cacheRead=${usage.cacheReadTokens}tok`,
      `cacheWrite=${usage.cacheWriteTokens}tok`,
      `total=${totalTokens}tok`,
      `cost=$${usage.cost_usd_estimate.toFixed(6)}`,
      cacheSavings > 0 ? `cacheSaved=$${cacheSavings.toFixed(6)}` : null,
      `ts=${usage.timestamp}`,
    ]
      .filter(Boolean)
      .join(' | '),
  );
}

/**
 * Construye un TokenUsageLog a partir de la respuesta usage de Anthropic SDK.
 * Llama a estimateCost internamente.
 *
 * @param userId      - ID del usuario
 * @param requestType - Tipo de solicitud
 * @param modelVersion - Versión del modelo usada
 * @param usage       - Objeto usage devuelto por Anthropic SDK
 * @returns TokenUsageLog listo para pasar a logTokenUsage()
 */
export function buildTokenUsageLog(
  userId: string,
  requestType: 'plan_generation' | 'plan_regeneration',
  modelVersion: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  },
): TokenUsageLog {
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  return {
    userId,
    requestType,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    modelVersion,
    timestamp: new Date().toISOString(),
    cost_usd_estimate: estimateCost(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens),
  };
}
