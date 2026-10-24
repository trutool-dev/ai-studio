/**
 * Job de retención de datos de autenticación (SEC-50 / SA-21, RGPD Art. 5.1.e).
 *
 * Purga:
 *   - sesiones (auth_sessions) caducadas o revocadas hace más de SESSION_DAYS;
 *   - códigos OTP (verification_codes) caducados o usados hace más de OTP_DAYS;
 *   - tokens de reset (password_reset_tokens) caducados o usados hace más de RESET_DAYS;
 *   - IPs: anonimiza `ip_address` de sesiones creadas hace más de IP_DAYS.
 *
 * Plazos por defecto (conservadores, sobreescribibles por variable de entorno):
 *   RETENTION_SESSION_DAYS = 30  → conserva 30 días tras caducar/revocar (investigación
 *                                   de incidentes y detección de reutilización de refresh tokens)
 *   RETENTION_OTP_DAYS     = 30
 *   RETENTION_RESET_DAYS   = 30
 *   RETENTION_IP_DAYS      = 90  → las sesiones duran como máx. 30 días; las IPs de sesiones
 *                                   más antiguas que 90 días se anonimizan si siguieran vivas
 *
 * Programación: `src/jobs/scheduler.js` lo ejecuta a diario dentro del backend si
 * RETENTION_SCHEDULER_ENABLED=true (hora en RETENTION_SCHEDULER_HOUR_UTC, por defecto 3).
 * Ejecución manual o desde un cron externo: `npm run retention` (= `node src/jobs/retention.js`;
 * conecta a la BD de DATABASE_URL; no ejecutar contra producción sin aprobación).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RETENTION_DAYS = Object.freeze({
  sessionDays: 30,
  otpDays: 30,
  resetDays: 30,
  ipDays: 90,
});

function positiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Lee los plazos de las variables de entorno (valores inválidos → por defecto). */
function getRetentionConfig(env = process.env) {
  return {
    sessionDays: positiveInt(env.RETENTION_SESSION_DAYS, DEFAULT_RETENTION_DAYS.sessionDays),
    otpDays: positiveInt(env.RETENTION_OTP_DAYS, DEFAULT_RETENTION_DAYS.otpDays),
    resetDays: positiveInt(env.RETENTION_RESET_DAYS, DEFAULT_RETENTION_DAYS.resetDays),
    ipDays: positiveInt(env.RETENTION_IP_DAYS, DEFAULT_RETENTION_DAYS.ipDays),
  };
}

const daysBefore = (now, days) => new Date(now.getTime() - days * DAY_MS);

/**
 * Ejecuta la purga.
 * @param {object} opts
 * @param {object} opts.prisma cliente Prisma (inyectado para poder probarlo)
 * @param {Date}   [opts.now]
 * @param {object} [opts.config] plazos en días (ver getRetentionConfig)
 * @param {object} [opts.logger]
 * @returns {Promise<{sessions:number, otpCodes:number, resetTokens:number, ipsAnonymized:number}>}
 */
async function runRetention({ prisma, now = new Date(), config = getRetentionConfig(), logger } = {}) {
  if (!prisma) throw new Error('runRetention: prisma es obligatorio');

  const sessionCutoff = daysBefore(now, config.sessionDays);
  const otpCutoff = daysBefore(now, config.otpDays);
  const resetCutoff = daysBefore(now, config.resetDays);
  const ipCutoff = daysBefore(now, config.ipDays);

  const sessions = await prisma.authSession.deleteMany({
    where: { OR: [{ expires_at: { lt: sessionCutoff } }, { revoked_at: { lt: sessionCutoff } }] },
  });
  const otpCodes = await prisma.verificationCode.deleteMany({
    where: { OR: [{ expires_at: { lt: otpCutoff } }, { used_at: { lt: otpCutoff } }] },
  });
  const resetTokens = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expires_at: { lt: resetCutoff } }, { used_at: { lt: resetCutoff } }] },
  });
  const ips = await prisma.authSession.updateMany({
    where: { created_at: { lt: ipCutoff }, ip_address: { not: null } },
    data: { ip_address: null },
  });

  const result = {
    sessions: sessions.count,
    otpCodes: otpCodes.count,
    resetTokens: resetTokens.count,
    ipsAnonymized: ips.count,
  };
  if (logger) logger.info(`[retention] Purga completada: ${JSON.stringify(result)}`);
  return result;
}

module.exports = { runRetention, getRetentionConfig, DEFAULT_RETENTION_DAYS };

/* istanbul ignore next -- punto de entrada CLI, no se ejecuta en tests */
if (require.main === module) {
  require('dotenv').config();
  const prisma = require('../prisma/client');
  const logger = require('../utils/logger.util');
  runRetention({ prisma, logger })
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
      logger.error(`[retention] Error: ${err.code || err.name}`);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}
