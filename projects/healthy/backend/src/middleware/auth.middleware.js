const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response.util');

/**
 * Middleware que verifica el JWT en el header Authorization.
 * Adjunta el payload decodificado en req.user.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Token de autenticación requerido', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'El token ha expirado', 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Token inválido', 401);
  }
};

module.exports = { authenticate };
