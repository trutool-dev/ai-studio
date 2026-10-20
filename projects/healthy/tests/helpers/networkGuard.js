/**
 * Guardia de red global para Jest (setupFilesAfterEnv de la suite del backend y de la raíz).
 *
 * Motivo: durante la corrección de la auditoría 2026-10-19 un test llegó a llamar a la API
 * real de Anthropic porque `jest.mock('@anthropic-ai/sdk')` resolvió otra copia del paquete
 * (la de projects/healthy/node_modules en vez de la de backend/node_modules). Además, la
 * DATABASE_URL de los .env locales apunta a Railway.
 *
 * Qué hace:
 *  1. Sustituye TODAS las copias instaladas de `@anthropic-ai/sdk` por un cliente simulado.
 *     Si el código llega a `messages.create` sin que el test haya puesto su propio mock,
 *     se registra el intento y el test falla en `afterEach` (aunque el código capture el error
 *     y use el plan de respaldo).
 *  2. Bloquea cualquier conexión de red saliente que no sea a loopback (supertest usa
 *     127.0.0.1) o a un host listado en TEST_NETWORK_ALLOWED_HOSTS. Un intento bloqueado
 *     también hace fallar el test en `afterEach`.
 *
 * Los tests que necesiten controlar el SDK siguen usando su propio `jest.mock(...)` con la
 * ruta explícita `../../backend/node_modules/@anthropic-ai/sdk`, que tiene prioridad.
 */

'use strict';

const path = require('path');
const net = require('net');

const blockedAttempts = [];

// ─── 1. SDK de Anthropic simulado (todas las copias) ────────────────────────
function createGuardedAnthropicModule() {
  function GuardedAnthropic() {
    return {
      messages: {
        create: async () => {
          blockedAttempts.push('Llamada a Anthropic messages.create sin mock explícito en el test');
          throw new Error('[networkGuard] Llamada real a la API de Anthropic bloqueada en tests');
        },
      },
    };
  }
  GuardedAnthropic.default = GuardedAnthropic;
  GuardedAnthropic.Anthropic = GuardedAnthropic;
  return GuardedAnthropic;
}

const healthyRoot = path.resolve(__dirname, '..', '..');
const sdkSearchDirs = [
  path.join(healthyRoot, 'backend'),
  healthyRoot,
  path.resolve(healthyRoot, '..', '..'),
];
const sdkEntries = new Set();
for (const dir of sdkSearchDirs) {
  try {
    sdkEntries.add(require.resolve('@anthropic-ai/sdk', { paths: [dir] }));
  } catch (_) {
    // copia no instalada en ese directorio
  }
}
for (const entry of sdkEntries) {
  // doMock (no hoisted) para poder usar rutas calculadas
  jest.doMock(entry, createGuardedAnthropicModule);
}
jest.doMock('@anthropic-ai/sdk', createGuardedAnthropicModule);

// ─── 2. Bloqueo de conexiones de red no locales ────────────────────────────
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1', '0.0.0.0', '']);
// Excepción explícita para una BD/Redis de test dedicada (TEST_DATABASE_URL), p. ej.
// TEST_NETWORK_ALLOWED_HOSTS=testdb.internal,10.0.0.5 — nunca hosts de staging/producción.
for (const h of (process.env.TEST_NETWORK_ALLOWED_HOSTS || '').split(',')) {
  if (h.trim()) LOOPBACK.add(h.trim());
}

function extractHost(args) {
  const first = args[0];
  if (Array.isArray(first)) return extractHost(first); // normalizeArgs interno de net
  if (first && typeof first === 'object') {
    if (first.path) return null; // socket unix / named pipe: local
    return first.host === undefined ? 'localhost' : String(first.host);
  }
  if (typeof first === 'string' && Number.isNaN(Number(first))) return null; // ruta de pipe
  return args[1] === undefined || typeof args[1] === 'function' ? 'localhost' : String(args[1]);
}

const originalConnect = net.Socket.prototype.connect;
if (!originalConnect.__networkGuard) {
  const guardedConnect = function guardedConnect(...args) {
    const host = extractHost(args);
    if (host !== null && !LOOPBACK.has(host)) {
      const msg = `[networkGuard] Conexión de red real bloqueada en tests: ${host}`;
      blockedAttempts.push(msg);
      const err = new Error(msg);
      err.code = 'ENETUNREACH';
      process.nextTick(() => this.destroy(err));
      return this;
    }
    return originalConnect.apply(this, args);
  };
  guardedConnect.__networkGuard = true;
  net.Socket.prototype.connect = guardedConnect;
}

afterEach(() => {
  if (blockedAttempts.length > 0) {
    const attempts = blockedAttempts.splice(0, blockedAttempts.length);
    throw new Error(
      `El test intentó usar la red o la API de Anthropic sin mock:\n - ${attempts.join('\n - ')}`
    );
  }
});

module.exports = { blockedAttempts };
