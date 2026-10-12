/**
 * Respuesta de éxito estándar
 * @param {object} res - Objeto response de Express
 * @param {object} data - Datos a devolver
 * @param {string} message - Mensaje descriptivo
 * @param {number} statusCode - Código HTTP (default 200)
 */
const sendSuccess = (res, data = {}, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    error: null,
  });
};

/**
 * Respuesta de error estándar
 * @param {object} res - Objeto response de Express
 * @param {string} error - Código o tipo de error
 * @param {string} message - Mensaje legible para el cliente
 * @param {number} statusCode - Código HTTP (default 400)
 */
const sendError = (res, error = 'BAD_REQUEST', message = 'Ha ocurrido un error', statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    error,
  });
};

/**
 * Respuesta 201 Created para recursos nuevos.
 */
const sendCreated = (res, data = {}, message = 'Recurso creado correctamente') => {
  return sendSuccess(res, data, message, 201);
};

/**
 * Respuesta 404 Not Found.
 */
const sendNotFound = (res, message = 'Recurso no encontrado') => {
  return sendError(res, 'NOT_FOUND', message, 404);
};

/**
 * Respuesta 401 Unauthorized.
 */
const sendUnauthorized = (res, message = 'No autorizado') => {
  return sendError(res, 'UNAUTHORIZED', message, 401);
};

/**
 * Respuesta 403 Forbidden.
 */
const sendForbidden = (res, message = 'Acceso denegado') => {
  return sendError(res, 'FORBIDDEN', message, 403);
};

/**
 * Respuesta 422 Unprocessable Entity (errores de validación).
 * @param {object} res
 * @param {Array} errors - Lista de errores de validación
 * @param {string} message
 */
const sendValidationError = (res, errors, message = 'Error de validación') => {
  return res.status(422).json({
    success: false,
    data: null,
    message,
    error: 'VALIDATION_ERROR',
    errors,
  });
};

/**
 * Respuesta 500 Internal Server Error.
 */
const sendServerError = (res, message = 'Error interno del servidor') => {
  return sendError(res, 'INTERNAL_ERROR', message, 500);
};

module.exports = {
  sendSuccess,
  sendError,
  sendCreated,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendValidationError,
  sendServerError,
};
