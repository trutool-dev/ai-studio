/**
 * Utilidades de validación de parámetros de entrada (SEC-52 / SA-23).
 *
 * Con el parser de query de Express los parámetros pueden llegar como arrays u
 * objetos (`?q[]=a`, `?status[not]=x`); estas funciones solo aceptan cadenas y
 * nunca devuelven objetos que puedan acabar como operadores de Prisma.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Fecha ISO 8601: YYYY-MM-DD con hora opcional
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** @returns {boolean} si el valor es un UUID (string) */
const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

/**
 * Entero acotado para paginación: valores ausentes o no numéricos → `def`;
 * fuera de rango → se recorta a [min, max]. Nunca devuelve NaN.
 */
function parseIntInRange(value, { def, min, max }) {
  if (typeof value !== 'string' && typeof value !== 'number') return def;
  const n = typeof value === 'number' ? Math.trunc(value) : parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

/**
 * Fecha de un query param.
 * @returns {{ ok: true, date: Date|null } | { ok: false }}
 *   date = null si no se envió; ok=false si el valor no es una fecha ISO válida
 */
function parseDateParam(value) {
  if (value === undefined || value === '') return { ok: true, date: null };
  if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return { ok: false };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false };
  return { ok: true, date };
}

/**
 * Cadena opcional de un query param.
 * @returns {{ ok: true, value: string|undefined } | { ok: false }}
 */
function parseOptionalString(value, maxLength = 100) {
  if (value === undefined || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string' || value.length > maxLength) return { ok: false };
  return { ok: true, value };
}

/**
 * Middleware: responde 404 si alguno de los parámetros de ruta no es un UUID.
 * Evita consultas innecesarias y mantiene la semántica "no encontrado".
 */
const requireUuidParams = (...names) => (req, res, next) => {
  for (const name of names) {
    if (!isUuid(req.params[name])) {
      return res.status(404).json({ success: false, data: null, error: 'NOT_FOUND', message: 'Recurso no encontrado' });
    }
  }
  return next();
};

module.exports = {
  UUID_REGEX,
  isUuid,
  parseIntInRange,
  parseDateParam,
  parseOptionalString,
  requireUuidParams,
};
