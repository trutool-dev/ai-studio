const logger = require('../utils/logger.util');
const { sendError } = require('../utils/response.util');

/**
 * Manejador global de errores de Express.
 * Captura cualquier error no controlado y devuelve una respuesta estándar.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error({ message: err.message, stack: err.stack, path: req.path, method: req.method });

  // Errores de Prisma — registro no encontrado
  if (err.code === 'P2025') {
    return sendError(res, 'NOT_FOUND', 'Recurso no encontrado', 404);
  }

  // Errores de Prisma — violación de restricción única
  if (err.code === 'P2002') {
    return sendError(res, 'CONFLICT', 'El recurso ya existe', 409);
  }

  return sendError(res, 'INTERNAL_ERROR', 'Error interno del servidor', 500);
};

module.exports = errorHandler;
