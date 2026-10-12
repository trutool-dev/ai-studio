/**
 * Servicio de autenticación.
 * Lógica de negocio para: hash de passwords, generación de JWT,
 * códigos OTP y gestión de sesiones.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 15;

// ─────────────────────────────────────────────────────────────
// PASSWORD HASHING
// ─────────────────────────────────────────────────────────────

/**
 * Hashea una contraseña usando bcrypt con 12 rounds.
 * @param {string} password
 * @returns {Promise<string>} Hash
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano con su hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────────────────────
// JWT
// ─────────────────────────────────────────────────────────────

/**
 * Genera un access token JWT con expiración corta.
 * Payload: { userId, email, sessionId }
 * @param {string} userId
 * @param {string} email
 * @param {string} sessionId
 * @returns {string} Access token
 */
function generateAccessToken(userId, email, sessionId) {
  return jwt.sign(
    { userId, email, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  );
}

/**
 * Genera un refresh token opaco (UUID v4 de 36 chars + timestamp).
 * Se guarda en DB (auth_sessions) y opcionalmente en Redis.
 * @returns {string} Refresh token
 */
function generateRefreshToken() {
  return `${crypto.randomUUID()}.${Date.now()}`;
}

/**
 * Calcula la fecha de expiración del refresh token.
 * Por defecto: 30 días.
 * @returns {Date}
 */
function getRefreshTokenExpiry() {
  const expiry = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const days = parseInt(expiry.replace('d', ''), 10) || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

// ─────────────────────────────────────────────────────────────
// OTP (ONE-TIME PASSWORD)
// ─────────────────────────────────────────────────────────────

/**
 * Genera un código numérico de 6 dígitos para verificación de email.
 * Usa crypto.randomInt para seguridad criptográfica.
 * @returns {string} Código de 6 dígitos (con padding de ceros)
 */
function generateOtpCode() {
  const code = crypto.randomInt(0, 999999);
  return String(code).padStart(OTP_LENGTH, '0');
}

/**
 * Calcula la fecha de expiración de un código OTP.
 * @returns {Date} Fecha + 15 minutos desde ahora
 */
function getOtpExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + OTP_EXPIRY_MINUTES);
  return expiry;
}

/**
 * Verifica si un código OTP ha expirado.
 * @param {Date} expiresAt
 * @returns {boolean}
 */
function isOtpExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  generateOtpCode,
  getOtpExpiry,
  isOtpExpired,
};
