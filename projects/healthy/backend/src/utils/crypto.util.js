const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SALT_ROUNDS = 12;

/**
 * Hashea una contraseña con bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

/**
 * Compara una contraseña en texto plano con su hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const comparePassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * Genera un código numérico de 6 dígitos para verificación (criptográficamente seguro)
 * Usa crypto.randomInt() en lugar de Math.random() para cumplir con estándares de seguridad
 * @returns {string}
 */
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Genera un token UUID seguro
 * @returns {string}
 */
const generateSecureToken = () => crypto.randomUUID();

const ALGORITHM = 'aes-256-gcm';

// SEC-46 (SA-16/JB-14): la clave debe ser exactamente 32 bytes en hex (64 caracteres)
const AES_KEY_REGEX = /^[0-9a-fA-F]{64}$/;
// Formato de salida de encryptAES256: iv(12 bytes hex):authTag(16 bytes hex):ciphertext(base64)
const CIPHERTEXT_REGEX = /^[0-9a-f]{24}:[0-9a-f]{32}:[A-Za-z0-9+/]*={0,2}$/;
// Longitud mínima del secreto HMAC (caracteres)
const MIN_HMAC_SECRET_LENGTH = 32;

/**
 * Error de configuración criptográfica (clave ausente o inválida).
 * Los llamantes (p. ej. la caché de planes) deben capturarlo y NO guardar ni
 * devolver datos en claro.
 */
class CryptoConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoConfigError';
  }
}

/**
 * Comprueba que la clave AES sea 64 caracteres hex.
 * @param {string} keyHex
 * @returns {boolean}
 */
function isValidAesKey(keyHex) {
  return typeof keyHex === 'string' && AES_KEY_REGEX.test(keyHex);
}

function getAesKey(keyHex) {
  if (!isValidAesKey(keyHex)) {
    // Fail-closed: nunca se devuelve el texto plano si falta la clave o es inválida
    throw new CryptoConfigError('REDIS_ENCRYPTION_KEY ausente o inválida (se requieren 64 caracteres hex)');
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Cifra texto con AES-256-GCM. Devuelve `iv:authTag:ciphertext` (hex:hex:base64).
 * @param {string} plaintext
 * @param {string} keyHex — clave hex de 64 chars (32 bytes).
 * @throws {CryptoConfigError} si la clave falta o es inválida (fail-closed, SEC-46)
 */
function encryptAES256(plaintext, keyHex) {
  const key = getAesKey(keyHex);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('base64')].join(':');
}

/**
 * Descifra un valor generado por encryptAES256.
 * Devuelve null si el valor no tiene el formato cifrado esperado o si la
 * autenticación GCM falla (manipulado / otra clave): nunca devuelve el valor
 * de entrada tal cual.
 * @throws {CryptoConfigError} si la clave falta o es inválida (fail-closed, SEC-46)
 */
function decryptAES256(ciphertext, keyHex) {
  const key = getAesKey(keyHex);
  if (typeof ciphertext !== 'string' || !CIPHERTEXT_REGEX.test(ciphertext)) return null;
  try {
    const [ivHex, authTagHex, encryptedB64] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return null; }
}

/**
 * Genera HMAC-SHA256 (hex) para verificar integridad.
 * @param {string} data
 * @param {string} secret — mínimo 32 caracteres
 * @throws {CryptoConfigError} si el secreto falta o es demasiado corto (fail-closed, SEC-46)
 */
function hmacSHA256(data, secret) {
  if (typeof secret !== 'string' || secret.length < MIN_HMAC_SECRET_LENGTH) {
    throw new CryptoConfigError(`REDIS_HMAC_SECRET ausente o demasiado corto (mínimo ${MIN_HMAC_SECRET_LENGTH} caracteres)`);
  }
  return crypto.createHmac('sha256', secret).update(String(data)).digest('hex');
}

/**
 * Comparación de cadenas en tiempo constante.
 * Se comparan los SHA-256 de ambos valores para que la longitud no filtre
 * información ni haga lanzar a crypto.timingSafeEqual.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * Verifica un HMAC-SHA256 (hex) en tiempo constante.
 * @param {string} data
 * @param {string} mac — HMAC recibido (hex)
 * @param {string} secret
 * @returns {boolean}
 * @throws {CryptoConfigError} si el secreto falta o es demasiado corto
 */
function verifyHmacSHA256(data, mac, secret) {
  const expected = hmacSHA256(data, secret);
  if (typeof mac !== 'string' || mac.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(mac, 'utf8'));
}

module.exports = {
  hashPassword,
  comparePassword,
  generateVerificationCode,
  generateSecureToken,
  encryptAES256,
  decryptAES256,
  hmacSHA256,
  verifyHmacSHA256,
  safeEqual,
  isValidAesKey,
  CryptoConfigError,
  MIN_HMAC_SECRET_LENGTH,
};
