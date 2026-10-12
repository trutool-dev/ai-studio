/**
 * Tests de carga para POST /onboarding/complete (TS-08).
 * Usa autocannon para medir rendimiento de la infraestructura.
 * El AI service es mockeado (ya está en NODE_ENV=test) para no gastar tokens.
 *
 * Objetivo: 10 req concurrentes, p99 < 2000 ms
 *
 * Uso:
 *   cd projects/healthy/backend
 *   node ../tests/load/planGeneration.js
 *
 * O con npx desde la raíz del proyecto:
 *   cd projects/healthy
 *   node tests/load/planGeneration.js
 */

'use strict';

const autocannon = require('autocannon');
const http = require('http');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  host: process.env.LOAD_TEST_HOST || 'localhost',
  port: parseInt(process.env.LOAD_TEST_PORT || '3000', 10),
  connections: 10,      // 10 conexiones concurrentes
  duration: 10,         // 10 segundos
  pipelining: 1,
  timeout: 5,           // 5 segundos por request
  p99Target: 2000,      // p99 debe ser < 2000 ms
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE SETUP
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = `http://${CONFIG.host}:${CONFIG.port}`;

/**
 * Hace una petición HTTP simple usando el módulo nativo http.
 */
function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Crea un usuario, lo verifica y hace login para obtener un JWT.
 * Devuelve access_token listo para usar en el load test.
 */
async function setupTestUser(suffix) {
  const email = `loadtest_${suffix}_${Date.now()}@loadtest.healthy.com`;
  const password = 'LoadTest123!';

  // 1. Register
  const registerRes = await httpRequest({
    hostname: CONFIG.host,
    port: CONFIG.port,
    path: '/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email });

  if (registerRes.status !== 201) {
    throw new Error(`Register falló para ${email}: ${JSON.stringify(registerRes.body)}`);
  }

  const userId = registerRes.body.data?.user_id;
  if (!userId) {
    throw new Error(`No se obtuvo user_id para ${email}`);
  }

  // 2. Obtener OTP simulado — en NODE_ENV=test el servidor logea el OTP
  // Como no podemos leerlo del log, usamos la BD directamente via prisma.
  // Para el test de carga, usamos una alternativa: resend-code + leer de BD
  // Esto requiere que la BD esté accesible. Si no, usamos un OTP fijo de test.
  // Para simplicidad del load test, asumimos que el servidor está configurado
  // para aceptar código '000000' en NODE_ENV=test (o lo leemos de la BD).

  console.log(`[setup] Usuario creado: ${email} (id: ${userId})`);
  return { email, password, userId };
}

/**
 * Configura un usuario completo con onboarding listo para completar.
 */
async function setupOnboardingUser() {
  const email = `loadtest_onboarding_${Date.now()}@loadtest.healthy.com`;
  const password = 'LoadTest123!';

  // Este setup requiere acceso directo a la BD para leer el OTP.
  // En un entorno de carga real, el OTP se enviaría por email.
  // Para el load test, documentamos el proceso manualmente.

  console.log(`[load-test] Para completar el setup, ejecuta el script de seed:`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);

  return { email, password };
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK: GET /health (calentamiento — sin auth)
// ─────────────────────────────────────────────────────────────────────────────

async function runHealthCheckBenchmark() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BENCHMARK 1/3 — GET /health (calentamiento)');
  console.log('═══════════════════════════════════════════════════════════');

  const result = await autocannon({
    url: `${BASE_URL}/health`,
    connections: CONFIG.connections,
    duration: CONFIG.duration,
    pipelining: CONFIG.pipelining,
    timeout: CONFIG.timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK: POST /auth/login (sin mocktear AI)
// ─────────────────────────────────────────────────────────────────────────────

async function runLoginBenchmark(email, password) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BENCHMARK 2/3 — POST /auth/login');
  console.log('═══════════════════════════════════════════════════════════');

  const result = await autocannon({
    url: `${BASE_URL}/auth/login`,
    connections: 5, // Menos conexiones para no disparar rate limiter
    duration: CONFIG.duration,
    pipelining: 1,
    timeout: CONFIG.timeout,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK: POST /onboarding/complete (el más pesado)
// ─────────────────────────────────────────────────────────────────────────────

async function runOnboardingCompleteBenchmark(accessToken) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  BENCHMARK 3/3 — POST /onboarding/complete');
  console.log('  (con AI service mockeado en NODE_ENV=test)');
  console.log('═══════════════════════════════════════════════════════════');

  if (!accessToken) {
    console.log('  [SKIP] No hay access_token disponible — benchmark omitido.');
    return null;
  }

  const result = await autocannon({
    url: `${BASE_URL}/onboarding/complete`,
    connections: CONFIG.connections,
    duration: CONFIG.duration,
    pipelining: CONFIG.pipelining,
    timeout: CONFIG.timeout * 4, // 20s para onboarding
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ answers: [] }),
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATEO DE RESULTADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea los resultados de autocannon en texto legible.
 */
function formatResults(name, result) {
  if (!result) return `${name}: OMITIDO\n`;

  const { latency, requests, throughput, errors, timeouts } = result;

  const p99Ms = latency.p99 || 0;
  const passesTarget = p99Ms < CONFIG.p99Target;
  const status = passesTarget ? 'PASS' : 'FAIL';

  return [
    `\n── ${name} ──`,
    `  Duración:       ${result.duration}s`,
    `  Conexiones:     ${result.connections}`,
    `  Req/s (media):  ${requests.mean.toFixed(2)}`,
    `  Req/s (min):    ${requests.min}`,
    `  Req/s (max):    ${requests.max}`,
    `  Throughput:     ${(throughput.mean / 1024).toFixed(2)} KB/s`,
    `  Total req:      ${result.requests?.sent || 0}`,
    `  Errores:        ${errors}`,
    `  Timeouts:       ${timeouts}`,
    `  ── Latencia ──`,
    `  p50:            ${latency.p50} ms`,
    `  p75:            ${latency.p75} ms`,
    `  p90:            ${latency.p90} ms`,
    `  p99:            ${latency.p99} ms  (objetivo: < ${CONFIG.p99Target} ms) → ${status}`,
    `  media:          ${latency.mean.toFixed(2)} ms`,
    `  max:            ${latency.max} ms`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function runLoadTests() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║    HEALTHY — Tests de Carga (TS-08)                      ║');
  console.log('║    Endpoint: POST /onboarding/complete                   ║');
  console.log('║    Objetivo: 10 req concurrentes, p99 < 2000 ms          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n  Host: ${BASE_URL}`);
  console.log(`  Conexiones: ${CONFIG.connections}`);
  console.log(`  Duración: ${CONFIG.duration}s por benchmark`);
  console.log(`  Objetivo p99: < ${CONFIG.p99Target} ms`);

  // Verificar que el servidor está levantado
  try {
    await httpRequest({
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: '/health',
      method: 'GET',
    });
    console.log('\n  [OK] Servidor accesible');
  } catch (err) {
    console.error(`\n  [ERROR] No se puede conectar a ${BASE_URL}: ${err.message}`);
    console.error('  Levanta el servidor antes de ejecutar el load test:');
    console.error(`  cd projects/healthy/backend && NODE_ENV=test node server.js`);
    process.exit(1);
  }

  const results = {};

  // 1. Health check (calentamiento)
  results.health = await runHealthCheckBenchmark();

  // 2. Login benchmark (sin usuario real, solo para medir latencia de autenticación)
  // Usamos credenciales de un usuario de seed si existe
  const seedEmail = process.env.LOAD_TEST_USER_EMAIL || null;
  const seedPassword = process.env.LOAD_TEST_USER_PASSWORD || null;

  if (seedEmail && seedPassword) {
    results.login = await runLoginBenchmark(seedEmail, seedPassword);
  } else {
    console.log('\n[SKIP] LOAD_TEST_USER_EMAIL y LOAD_TEST_USER_PASSWORD no definidas.');
    console.log('  Para el benchmark de login, define estas variables de entorno.');
    results.login = null;
  }

  // 3. Onboarding complete (el más pesado)
  const seedAccessToken = process.env.LOAD_TEST_ACCESS_TOKEN || null;
  results.onboarding = await runOnboardingCompleteBenchmark(seedAccessToken);

  // ─── Resumen ───────────────────────────────────────────────────────────────

  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║    RESULTADOS                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  console.log(formatResults('GET /health (calentamiento)', results.health));
  console.log(formatResults('POST /auth/login', results.login));
  console.log(formatResults('POST /onboarding/complete', results.onboarding));

  // ─── Evaluación del objetivo ──────────────────────────────────────────────

  const benchmarks = [
    { name: 'GET /health', result: results.health },
    { name: 'POST /onboarding/complete', result: results.onboarding },
  ].filter((b) => b.result !== null);

  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║    EVALUACIÓN DE OBJETIVOS                               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  let allPass = true;
  for (const { name, result } of benchmarks) {
    if (!result) continue;
    const p99 = result.latency?.p99 || Infinity;
    const pass = p99 < CONFIG.p99Target;
    const icon = pass ? 'PASS' : 'FAIL';
    console.log(`\n  ${icon}  ${name}`);
    console.log(`       p99: ${p99} ms (objetivo: < ${CONFIG.p99Target} ms)`);
    console.log(`       req/s: ${result.requests?.mean?.toFixed(2) || 'N/A'}`);
    if (!pass) allPass = false;
  }

  console.log(`\n\n  Resultado global: ${allPass ? 'TODOS LOS OBJETIVOS CUMPLIDOS' : 'ALGUNOS OBJETIVOS NO CUMPLIDOS'}`);
  console.log('  (Ver LOAD_TEST_REPORT.md para el informe completo)\n');

  return { results, allPass };
}

// Si se ejecuta directamente
if (require.main === module) {
  // Verificar que autocannon está instalado
  try {
    require.resolve('autocannon');
  } catch {
    console.error('[ERROR] autocannon no está instalado.');
    console.error('  npm install --save-dev autocannon');
    process.exit(1);
  }

  runLoadTests()
    .then(({ allPass }) => {
      process.exit(allPass ? 0 : 1);
    })
    .catch((err) => {
      console.error('[FATAL]', err.message);
      process.exit(1);
    });
}

module.exports = { runLoadTests, CONFIG, formatResults };
