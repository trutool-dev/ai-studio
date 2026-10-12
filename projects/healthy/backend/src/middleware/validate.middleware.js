const { validationResult } = require('express-validator');

/**
 * Middleware que comprueba los errores de validación de express-validator.
 * Debe colocarse después de las reglas de validación en cada ruta.
 * Devuelve 400 con formato: { success: false, error: 'VALIDATION_ERROR', details: [...] }
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Los datos enviados no son válidos',
      details,
    });
  }

  next();
};

module.exports = { validate };
