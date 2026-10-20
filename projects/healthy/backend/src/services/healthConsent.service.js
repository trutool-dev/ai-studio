/**
 * Consentimiento explícito para datos de salud (RGPD art. 9.2.a).
 *
 * SEC-33 (SA-07 + JB-09): el servidor solo registra el consentimiento con
 *   `healthConsent === true` y lo exige antes de guardar datos de salud y de
 *   enviar datos a la IA (complete / regenerate).
 * SEC-47 (SA-17): versión de la política desde configuración
 *   (`HEALTH_CONSENT_VERSION`, por defecto '1.0'); si cambia, hay que volver a
 *   consentir. Retirada del consentimiento: borra los datos art. 9 y deja traza.
 *
 * Traza de la retirada: no existe tabla de historial de consentimientos en el
 * esquema. Se deja (1) una línea de log de auditoría (solo userId seudónimo,
 * versión y fecha del servidor) y (2) una marca en `users.health_consent_version`
 * con el formato `withdrawn:<versión>:<ISO>`, que se sobrescribe si el usuario
 * vuelve a consentir. Una tabla de historial requiere migración (pendiente).
 */

'use strict';

const logger = require('../utils/logger.util');

const DEFAULT_CONSENT_VERSION = '1.0';
const WITHDRAWN_PREFIX = 'withdrawn:';

/** Versión vigente de la política de datos de salud. */
function getConsentVersion() {
  const v = (process.env.HEALTH_CONSENT_VERSION || '').trim();
  return v && v.length <= 20 ? v : DEFAULT_CONSENT_VERSION;
}

/**
 * ¿El usuario tiene un consentimiento vigente (dado y de la versión actual)?
 * @param {{ health_consent_given_at?: Date|null, health_consent_version?: string|null }|null} user
 */
function hasValidConsent(user) {
  if (!user || !user.health_consent_given_at) return false;
  const version = user.health_consent_version || DEFAULT_CONSENT_VERSION;
  return version === getConsentVersion();
}

/**
 * Carga el estado de consentimiento del usuario.
 * @param {object} db - cliente Prisma (o transacción)
 * @param {string} userId
 */
async function getConsentState(db, userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { health_consent_given_at: true, health_consent_version: true },
  });
  return { user, valid: hasValidConsent(user) };
}

/**
 * Registra el consentimiento (marca de tiempo del servidor + versión vigente)
 * si no hay uno vigente. Idempotente.
 * @returns {Promise<boolean>} true si se ha registrado ahora
 */
async function recordConsent(db, userId) {
  const { valid } = await getConsentState(db, userId);
  if (valid) return false;
  await db.user.update({
    where: { id: userId },
    data: { health_consent_given_at: new Date(), health_consent_version: getConsentVersion() },
  });
  logger.info(`[consent] Consentimiento art. 9 registrado userId=${userId} version=${getConsentVersion()}`);
  return true;
}

/**
 * Retira el consentimiento y borra los datos de salud art. 9:
 * condiciones médicas, restricciones/alergias y lesiones declaradas.
 * Se ejecuta en una transacción.
 *
 * @param {object} prisma - cliente Prisma con $transaction
 * @param {string} userId
 * @returns {Promise<{ conditions: number, food_restrictions: number, injuries_cleared: number, withdrawn_at: string, previous_version: string|null }>}
 */
async function withdrawConsent(prisma, userId) {
  const withdrawnAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { health_consent_given_at: true, health_consent_version: true },
    });
    const conditions = await tx.healthCondition.deleteMany({ where: { user_id: userId } });
    const restrictions = await tx.foodRestriction.deleteMany({ where: { user_id: userId } });
    const injuries = await tx.trainingPreferences.updateMany({
      where: { user_id: userId },
      data: { injuries_or_limitations: null },
    });
    const previousVersion = user && user.health_consent_version && !user.health_consent_version.startsWith(WITHDRAWN_PREFIX)
      ? user.health_consent_version : null;
    await tx.user.update({
      where: { id: userId },
      data: {
        health_consent_given_at: null,
        health_consent_version: `${WITHDRAWN_PREFIX}${previousVersion || getConsentVersion()}:${withdrawnAt.toISOString()}`,
      },
    });
    return {
      conditions: (conditions && conditions.count) || 0,
      food_restrictions: (restrictions && restrictions.count) || 0,
      injuries_cleared: (injuries && injuries.count) || 0,
      previous_version: previousVersion,
    };
  });
  logger.info(`[consent] Consentimiento art. 9 RETIRADO userId=${userId} at=${withdrawnAt.toISOString()} `
    + `borrados: condiciones=${result.conditions} restricciones=${result.food_restrictions} lesiones=${result.injuries_cleared}`);
  return { ...result, withdrawn_at: withdrawnAt.toISOString() };
}

module.exports = {
  DEFAULT_CONSENT_VERSION,
  getConsentVersion,
  hasValidConsent,
  getConsentState,
  recordConsent,
  withdrawConsent,
};
