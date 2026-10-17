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

/**
 * Cifra texto con AES-256-GCM. Devuelve string base64: iv:authTag:ciphertext
 * @param {string} plaintext
 * @param {string} keyHex — clave hex de 64 chars (32 bytes). Si vacía, devuelve plaintext sin cifrar.
 */
function encryptAES256(plaintext, keyHex) {
  if (!keyHex || keyHex.length < 32) return plaintext;
  const key = Buffer.from(keyHex.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('base64')].join(':');
}

/**
 * Descifra texto cifrado con encryptAES256. Si falla, devuelve null.
 */
function decryptAES256(ciphertext, keyHex) {
  if (!keyHex || keyHex.length < 32 || !ciphertext.includes(':')) return ciphertext;
  try {
    const key = Buffer.from(keyHex.slice(0, 64), 'hex');
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
 * Genera HMAC-SHA256 para verificar integridad.
 * @param {string} data
 * @param {string} secret
 */
function hmacSHA256(data, secret) {
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

module.exports = {
  hashPassword,
  comparePassword,
  generateVerificationCode,
  generateSecureToken,
  encryptAES256,
  decryptAES256,
  hmacSHA256,
};
