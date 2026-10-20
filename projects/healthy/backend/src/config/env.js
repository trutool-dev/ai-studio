/**
 * Validación de la configuración de entorno al arrancar (SEC-46 / SA-16 + JB-14).
 *
 * Política:
 * - NODE_ENV debe estar en la lista blanca (development, test, staging, production).
 *   Un valor ausente o desconocido es un error SIEMPRE (fail-closed): de NODE_ENV
 *   dependen los endpoints de depuración y no se puede saber si es producción.
 * - En production y staging cualquier error aborta el arranque.
 * - En development y test los errores se registran como avisos y el servidor arranca.
 *
 * No se registran nunca los valores de las variables, solo sus nombres.
 */

const ALLOWED_NODE_ENVS = ['development', 'test', 'staging', 'production'];
const STRICT_NODE_ENVS = ['staging', 'production'];

const MIN_SECRET_LENGTH = 32;           // caracteres mínimos de JWT_SECRET, JWT_REFRESH_SECRET, etc.
const RECOMMENDED_SECRET_LENGTH = 64;   // recomendado (openssl rand -base64 64)
const MAX_ACCESS_TOKEN_SECONDS = 3600;  // JWT_EXPIRES_IN máximo: 1 hora
const DEFAULT_TRUST_PROXY = 1;          // Railway: un único proxy (edge) delante del contenedor
const MAX_TRUST_PROXY = 10;

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Convierte un valor de expiración de jsonwebtoken a segundos.
 * Acepta "900", "900s", "15m", "1h", "1d". Un número sin unidad en una cadena
 * se interpreta como segundos solo aquí; jsonwebtoken lo trataría como ms, así
 * que se rechaza (devuelve null) para evitar ambigüedades.
 * @param {string} value
 * @returns {number|null} segundos o null si no es válido
 */
function parseDurationToSeconds(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const seconds = amount * UNIT_SECONDS[match[2].toLowerCase()];
  return seconds > 0 ? seconds : null;
}

/**
 * Interpreta TRUST_PROXY como número de saltos de proxy de confianza.
 * Nunca se acepta `true` (haría X-Forwarded-For falsificable y eludiría los rate limits).
 * @param {string|undefined} value
 * @returns {number}
 */
function parseTrustProxy(value) {
  if (value === undefined || value === null || String(value).trim() === '') return DEFAULT_TRUST_PROXY;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return DEFAULT_TRUST_PROXY;
  const hops = parseInt(raw, 10);
  return hops <= MAX_TRUST_PROXY ? hops : DEFAULT_TRUST_PROXY;
}

function isStrictEnv(nodeEnv) {
  return STRICT_NODE_ENVS.includes(nodeEnv);
}

/**
 * Valida las variables de entorno.
 * @param {object} [env=process.env]
 * @returns {{ errors: string[], warnings: string[], nodeEnv: string|undefined, strict: boolean }}
 */
function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];
  const nodeEnv = env.NODE_ENV;
  const strict = isStrictEnv(nodeEnv);
  const isProd = nodeEnv === 'production';

  // Errores que en dev/test se degradan a aviso
  const problem = (msg) => (strict ? errors : warnings).push(msg);

  if (!ALLOWED_NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV debe ser uno de: ${ALLOWED_NODE_ENVS.join(', ')}`);
  }

  // ── Secretos JWT ──────────────────────────────────────────────
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = env[name];
    if (!v) problem(`${name} es obligatorio`);
    else if (v.length < MIN_SECRET_LENGTH) problem(`${name} debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    else if (v.length < RECOMMENDED_SECRET_LENGTH) warnings.push(`${name}: se recomiendan al menos ${RECOMMENDED_SECRET_LENGTH} caracteres`);
  }
  if (env.JWT_SECRET && env.JWT_REFRESH_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problem('JWT_REFRESH_SECRET debe ser distinto de JWT_SECRET');
  }

  // ── Expiración del access token (≤ 1 h) ───────────────────────
  if (env.JWT_EXPIRES_IN !== undefined && env.JWT_EXPIRES_IN !== '') {
    const seconds = parseDurationToSeconds(env.JWT_EXPIRES_IN);
    if (seconds === null) problem('JWT_EXPIRES_IN no es válido (usa p. ej. 15m, 900s o 1h)');
    else if (seconds > MAX_ACCESS_TOKEN_SECONDS) problem('JWT_EXPIRES_IN no puede superar 1h');
  }

  // ── Base de datos ─────────────────────────────────────────────
  if (!env.DATABASE_URL) problem('DATABASE_URL es obligatorio');
  else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) problem('DATABASE_URL debe ser una URL postgresql://');

  // ── Cifrado e integridad de la caché Redis (SEC-10/SEC-16) ────
  if (!env.REDIS_ENCRYPTION_KEY) problem('REDIS_ENCRYPTION_KEY es obligatorio');
  else if (!/^[0-9a-fA-F]{64}$/.test(env.REDIS_ENCRYPTION_KEY)) problem('REDIS_ENCRYPTION_KEY debe tener 64 caracteres hex (openssl rand -hex 32)');

  if (!env.REDIS_HMAC_SECRET) problem('REDIS_HMAC_SECRET es obligatorio');
  else if (env.REDIS_HMAC_SECRET.length < MIN_SECRET_LENGTH) problem(`REDIS_HMAC_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);

  // ── Secretos opcionales: si se definen, deben ser robustos ────
  for (const name of ['ADMIN_TOKEN', 'DEV_ENDPOINTS_TOKEN', 'OTP_HASH_SECRET']) {
    if (env[name] && env[name].length < MIN_SECRET_LENGTH) {
      problem(`${name} debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
    }
  }

  // ── Proxy de confianza ────────────────────────────────────────
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') {
    const raw = String(env.TRUST_PROXY).trim();
    if (!/^\d+$/.test(raw) || parseInt(raw, 10) > MAX_TRUST_PROXY) {
      problem(`TRUST_PROXY debe ser un número entero de saltos entre 0 y ${MAX_TRUST_PROXY} (nunca "true"); se usará ${DEFAULT_TRUST_PROXY}`);
    }
  }

  // ── Endpoints de depuración: nunca en producción ──────────────
  if (isProd && env.ENABLE_DEV_ENDPOINTS === 'true') {
    errors.push('ENABLE_DEV_ENDPOINTS no puede estar activo en producción');
  }

  // ── Dependencias externas ─────────────────────────────────────
  if (!env.FRONTEND_URL) warnings.push('FRONTEND_URL no definido: CORS rechazará todos los orígenes de navegador');
  if (!env.ANTHROPIC_API_KEY) warnings.push('ANTHROPIC_API_KEY no definido: se usará el plan de respaldo');
  const missingSmtp = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((n) => !env[n]);
  if (missingSmtp.length > 0) {
    // Sin SMTP los códigos de verificación no se envían por correo
    const msg = `Faltan variables SMTP: ${missingSmtp.join(', ')}`;
    if (isProd) errors.push(msg); else warnings.push(msg);
  }

  return { errors, warnings, nodeEnv, strict };
}

/**
 * Valida el entorno y aborta (lanza) si hay errores en un entorno estricto
 * o si NODE_ENV no es válido. En dev/test registra los avisos y continúa.
 * @param {object} [options]
 * @param {object} [options.env=process.env]
 * @param {{warn: Function, error: Function}} [options.logger=console]
 * @returns {{ errors: string[], warnings: string[] }}
 * @throws {Error} si la configuración no es válida para arrancar
 */
function assertValidEnv({ env = process.env, logger = console } = {}) {
  const result = validateEnv(env);
  for (const w of result.warnings) logger.warn(`[config] ${w}`);
  if (result.errors.length > 0) {
    for (const e of result.errors) logger.error(`[config] ${e}`);
    const err = new Error(`Configuración de entorno inválida (${result.errors.length} errores); el servidor no arranca`);
    err.code = 'INVALID_ENV';
    err.details = result.errors;
    throw err;
  }
  return result;
}

module.exports = {
  ALLOWED_NODE_ENVS,
  STRICT_NODE_ENVS,
  MIN_SECRET_LENGTH,
  MAX_ACCESS_TOKEN_SECONDS,
  DEFAULT_TRUST_PROXY,
  parseDurationToSeconds,
  parseTrustProxy,
  isStrictEnv,
  validateEnv,
  assertValidEnv,
};
