const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response.util');
const redis = require('../services/redis.service');
const logger = require('../utils/logger.util');

/**
 * Autenticación por JWT y revocación de sesiones (SEC-44 / SA-13).
 *
 * Algoritmo: HS256 fijado al firmar (auth.controller) y al verificar
 * (`algorithms: ['HS256']`), lo que impide `alg: none` y la confusión de algoritmos.
 * Mejora futura documentada (auditoría del rol de seguridad): migrar a RS256/EdDSA
 * con par de claves e `iss`/`aud`; no se hace ahora para no invalidar los tokens
 * emitidos ni cambiar la gestión de secretos.
 *
 * Revocación (diseño barato, sin consulta a BD por petición):
 * - Lista de denegación en Redis con TTL (`auth:revoked:sid:<sessionId>`) cuando se
 *   cierra una sesión (logout) o se rota/revoca su familia de refresh tokens.
 * - Marca por usuario (`auth:revoked:user:<userId>` = epoch en segundos): invalida
 *   todos los access tokens emitidos antes (reset de contraseña, reutilización de
 *   refresh token detectada, borrado de cuenta).
 * - Copia en memoria del proceso (mismas claves, mismo TTL) para que la revocación
 *   funcione aunque Redis no esté disponible en una instancia única.
 * - Si Redis falla, se decide con la copia en memoria y se avisa en el log
 *   (fail-soft): el riesgo queda acotado por la vida del access token (15 min) y el
 *   refresh token se comprueba siempre contra la BD.
 * El TTL de las marcas (REVOCATION_TTL_SECONDS) cubre con margen la vida del access token.
 */

const JWT_ALGORITHM = 'HS256';
// 24 h: cubre cualquier JWT_EXPIRES_IN razonable (por defecto 15 min)
const REVOCATION_TTL_SECONDS = 24 * 60 * 60;

const sidKey = (sid) => `auth:revoked:sid:${sid}`;
const userKey = (userId) => `auth:revoked:user:${userId}`;

// ─── Copia local de la lista de denegación ───────────────────

const localRevocations = new Map(); // key → { value, expiresAt }

function setLocal(key, value) {
  localRevocations.set(key, { value, expiresAt: Date.now() + REVOCATION_TTL_SECONDS * 1000 });
}

function getLocal(key) {
  const entry = localRevocations.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localRevocations.delete(key);
    return null;
  }
  return entry.value;
}

let lastWarnAt = 0;
function warnRedis(err) {
  if (Date.now() - lastWarnAt < 60 * 1000) return;
  lastWarnAt = Date.now();
  logger.warn(`[auth] Redis no disponible para revocación de sesiones: ${err && err.message}`);
}

async function setRevocation(key, value) {
  setLocal(key, value);
  try {
    await redis.set(key, String(value), 'EX', REVOCATION_TTL_SECONDS);
  } catch (err) {
    warnRedis(err);
  }
}

async function getRevocation(key) {
  const local = getLocal(key);
  if (local !== null) return local;
  try {
    const value = await redis.get(key);
    return value === undefined ? null : value;
  } catch (err) {
    warnRedis(err);
    return null;
  }
}

/** Revoca los access tokens de una sesión (familia de refresh tokens). */
async function revokeSession(sessionId) {
  if (!sessionId) return;
  await setRevocation(sidKey(sessionId), '1');
}

/**
 * Revoca todos los access tokens del usuario emitidos hasta ahora.
 * Pensado también para otros controladores (p. ej. borrado de cuenta).
 */
async function revokeAllUserSessions(userId) {
  if (!userId) return;
  await setRevocation(userKey(userId), Math.floor(Date.now() / 1000));
}

/** true si el payload del JWT corresponde a una sesión o usuario revocados. */
async function isTokenRevoked(payload) {
  const [sidRevoked, userRevokedAt] = await Promise.all([
    payload.sessionId ? getRevocation(sidKey(payload.sessionId)) : null,
    payload.userId ? getRevocation(userKey(payload.userId)) : null,
  ]);
  if (sidRevoked) return true;
  if (userRevokedAt !== null && userRevokedAt !== undefined) {
    const cutoff = Number(userRevokedAt);
    // Tokens emitidos antes de la revocación (el mismo segundo se acepta para no
    // invalidar el login inmediatamente posterior a un reset)
    if (Number.isFinite(cutoff) && typeof payload.iat === 'number' && payload.iat < cutoff) return true;
  }
  return false;
}

/** Firma un access token con el algoritmo fijado. */
function signAccessToken(payload, expiresIn) {
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: JWT_ALGORITHM, expiresIn });
}

/**
 * Middleware que verifica el JWT en el header Authorization.
 * Adjunta el payload decodificado en req.user. Devuelve una promesa
 * (las ramas de error responden de forma síncrona).
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'UNAUTHORIZED', 'Token de autenticación requerido', 401);
  }

  const token = authHeader.split(' ')[1];

  // app.js y los routers montan `authenticate` dos veces: no repetir el trabajo
  if (req.user && req.authToken === token) return next();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'TOKEN_EXPIRED', 'El token ha expirado', 401);
    }
    return sendError(res, 'INVALID_TOKEN', 'Token inválido', 401);
  }

  return isTokenRevoked(payload).then((revoked) => {
    if (revoked) return sendError(res, 'TOKEN_REVOKED', 'La sesión ha sido cerrada', 401);
    req.user = payload;
    req.authToken = token;
    return next();
  }, next);
};

module.exports = {
  authenticate,
  revokeSession,
  revokeAllUserSessions,
  isTokenRevoked,
  signAccessToken,
  JWT_ALGORITHM,
  REVOCATION_TTL_SECONDS,
  // Solo para tests
  _resetLocalRevocations: () => localRevocations.clear(),
};
