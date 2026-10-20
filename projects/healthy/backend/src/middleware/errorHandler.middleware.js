const logger = require('../utils/logger.util');
const { sendError } = require('../utils/response.util');

/**
 * Construye la entrada de log de un error.
 * SEC-51 (SA-22 + JB-19): en producción NO se registra `err.message` (ni la primera
 * línea del stack, que lo repite): los errores de Prisma incluyen los argumentos de
 * la consulta (datos de salud del body) y los de SDKs externos pueden incluir datos
 * de la petición. Se registra solo tipo, código y, para Prisma, los campos afectados.
 */
function buildErrorLog(err, req) {
  const base = { path: req.path, method: req.method };
  if (process.env.NODE_ENV !== 'production') {
    return { ...base, message: err && err.message, stack: err && err.stack };
  }
  const entry = {
    ...base,
    name: (err && err.name) || 'Error',
    code: err && err.code,
    status: err && (err.status || err.statusCode),
  };
  if (err && err.meta && err.meta.target) entry.target = err.meta.target;
  if (err && typeof err.stack === 'string') {
    entry.stack = err.stack.split('\n').slice(1, 8).join('\n');
  }
  return entry;
}

/**
 * Manejador global de errores de Express.
 * Captura cualquier error no controlado y devuelve una respuesta estándar.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error(buildErrorLog(err || {}, req));

  // Errores de Prisma — registro no encontrado
  if (err && err.code === 'P2025') {
    return sendError(res, 'NOT_FOUND', 'Recurso no encontrado', 404);
  }

  // Errores de Prisma — violación de restricción única
  if (err && err.code === 'P2002') {
    return sendError(res, 'CONFLICT', 'El recurso ya existe', 409);
  }

  return sendError(res, 'INTERNAL_ERROR', 'Error interno del servidor', 500);
};

module.exports = errorHandler;
module.exports.buildErrorLog = buildErrorLog;
