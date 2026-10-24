/**
 * Programador en proceso del job de retención (SEC-50 / SA-21).
 *
 * Ejecuta `runRetention` una vez al día a la hora UTC indicada, dentro del propio
 * backend, sin dependencias nuevas (setTimeout + setInterval con `unref`, así nunca
 * mantiene vivo el proceso). El job es idempotente: si hubiera varias réplicas, una
 * ejecución duplicada no hace daño (solo borra lo que ya ha caducado).
 *
 * Variables de entorno:
 *   RETENTION_SCHEDULER_ENABLED = true  → activa la ejecución diaria (por defecto DESACTIVADO;
 *                                         se activa de forma explícita en cada entorno)
 *   RETENTION_SCHEDULER_HOUR_UTC = 3    → hora UTC (0-23) de la ejecución diaria
 *   RETENTION_*_DAYS                    → plazos de retención (ver retention.js)
 *
 * Alternativa sin scheduler: `npm run retention` (cron externo de Railway o ejecución manual).
 */

const { runRetention, getRetentionConfig } = require('./retention');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HOUR_UTC = 3;

/** Lee la configuración del programador (valores inválidos → por defecto). */
function getSchedulerConfig(env = process.env) {
  const enabled = String(env.RETENTION_SCHEDULER_ENABLED || '').trim().toLowerCase() === 'true';
  const hour = Number.parseInt(env.RETENTION_SCHEDULER_HOUR_UTC, 10);
  const hourUtc = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_HOUR_UTC;
  return { enabled, hourUtc };
}

/** Milisegundos desde `now` hasta la próxima hh:00:00 UTC (siempre > 0). */
function msUntilNextRun(now, hourUtc) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setTime(next.getTime() + DAY_MS);
  return next.getTime() - now.getTime();
}

/**
 * Arranca el programador si está activado.
 * @param {object} opts
 * @param {object} opts.prisma cliente Prisma
 * @param {object} opts.logger logger (winston)
 * @param {object} [opts.env] variables de entorno (inyectables en tests)
 * @param {Function} [opts.now] reloj
 * @param {Function} [opts.run] función de purga (por defecto runRetention)
 * @returns {{ enabled: boolean, stop: Function, runNow: Function, nextRunInMs?: number }}
 */
function startRetentionScheduler({
  prisma, logger, env = process.env, now = () => new Date(), run = runRetention,
} = {}) {
  const { enabled, hourUtc } = getSchedulerConfig(env);
  if (!enabled) {
    if (logger) logger.info('[retention] Programador desactivado (RETENTION_SCHEDULER_ENABLED != true)');
    return { enabled: false, stop: () => {}, runNow: async () => null };
  }
  if (!prisma) throw new Error('startRetentionScheduler: prisma es obligatorio');

  let running = false;
  let timeout = null;
  let interval = null;

  // Nunca lanza: un fallo de la purga no debe tumbar el servidor
  const runNow = async () => {
    if (running) {
      if (logger) logger.warn('[retention] Ejecución anterior aún en curso; se omite esta');
      return null;
    }
    running = true;
    try {
      return await run({ prisma, logger, config: getRetentionConfig(env), now: now() });
    } catch (err) {
      if (logger) logger.error(`[retention] Error en la ejecución programada: ${(err && (err.code || err.name)) || 'desconocido'}`);
      return null;
    } finally {
      running = false;
    }
  };

  const nextRunInMs = msUntilNextRun(now(), hourUtc);
  timeout = setTimeout(() => {
    runNow();
    interval = setInterval(runNow, DAY_MS);
    if (interval.unref) interval.unref();
  }, nextRunInMs);
  if (timeout.unref) timeout.unref();

  if (logger) {
    logger.info(`[retention] Programador activo: diario a las ${String(hourUtc).padStart(2, '0')}:00 UTC (próxima en ${Math.round(nextRunInMs / 60000)} min)`);
  }

  const stop = () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
  return { enabled: true, stop, runNow, nextRunInMs };
}

module.exports = { startRetentionScheduler, getSchedulerConfig, msUntilNextRun, DEFAULT_HOUR_UTC };
