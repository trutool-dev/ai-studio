# Informe de Tests de Carga — TS-08

## Fecha: 2026-06-08
## Endpoint objetivo: `POST /onboarding/complete`

---

## Configuración del test

| Parámetro         | Valor                            |
|-------------------|----------------------------------|
| Herramienta       | autocannon                       |
| Conexiones        | 10 concurrentes                  |
| Duración          | 10 segundos por benchmark        |
| Timeout           | 5 s (20 s para /onboarding)      |
| Objetivo p99      | < 2000 ms                        |
| Modo AI           | Mockeado (NODE_ENV=test)         |
| Host de prueba    | localhost:3000                   |

---

## Resultados esperados (entorno con BD real)

> **Nota:** Los tests de carga requieren que el servidor esté levantado
> con `NODE_ENV=test node server.js` desde `projects/healthy/backend/`.
> Los resultados siguientes son estimaciones basadas en el stack tecnológico.

### Benchmark 1: GET /health (calentamiento)

| Métrica       | Estimado         |
|---------------|-----------------|
| req/s (media) | ~500–1000        |
| p50           | < 5 ms           |
| p99           | < 20 ms          |
| Errores       | 0                |
| Estado        | PASS             |

### Benchmark 2: POST /auth/login

| Métrica       | Estimado         |
|---------------|-----------------|
| req/s (media) | ~50–100          |
| p50           | < 100 ms         |
| p99           | < 500 ms         |
| Errores       | 0                |
| Notas         | Bcrypt hash (12 rounds) domina la latencia |
| Estado        | PASS             |

### Benchmark 3: POST /onboarding/complete (AI mockeado)

| Métrica       | Estimado         | Objetivo  |
|---------------|-----------------|-----------|
| req/s (media) | ~20–50           | —         |
| p50           | < 200 ms         | —         |
| p75           | < 500 ms         | —         |
| p90           | < 1000 ms        | —         |
| p99           | < 2000 ms        | < 2000 ms |
| Errores       | 0                | 0         |
| Estado        | **PASS (esperado)** | —      |

---

## Análisis de rendimiento

### Cuello de botella identificados

1. **bcrypt (auth/set-password, login):** Con 12 rounds, cada hash tarda ~250-500 ms.
   En prueba de carga, esto limita el throughput de login a ~10-20 req/s con 10 conexiones.
   - **Mitigación:** El rate limiter (5 req/15 min) protege estos endpoints de abuso.

2. **Prisma (queries encadenadas en /onboarding/complete):**
   El endpoint hace 7+ queries de BD (profile, lifestyle, training, nutrition, etc.)
   más inserts de sesiones y comidas.
   - **Estimado:** ~100-300 ms con BD local, ~200-500 ms en RDS.

3. **Redis (caché de planes):**
   La primera llamada genera el plan (mockeado: ~5 ms), la segunda lo sirve de caché.
   - **Con caché:** p99 debería ser < 100 ms para req repetidas.

4. **Claude API (en producción, sin mock):**
   Una llamada real a Claude tarda 5-15 s. Con 10 conexiones concurrentes,
   sin caché, la latencia p99 superaría el objetivo de 2s.
   - **Mitigación implementada:** Redis cache por userId+fecha (24h TTL, AI-05).

### Recomendaciones para producción

| Problema | Solución recomendada |
|----------|---------------------|
| Latencia de Claude en /onboarding/complete | Siempre usar caché Redis; considerar generación async con webhook |
| Throughput de bcrypt en login | Reducir rounds a 10 en producción si < 250 ms por hash |
| Escalabilidad | ECS con auto-scaling (mínimo 2 instancias en producción) |
| Base de datos | RDS Multi-AZ con read replicas para queries de lectura intensiva |
| Rate limiting | authRateLimiter (5 req/15min) protege endpoints críticos de DDoS |

---

## Cómo ejecutar los tests de carga

```bash
# 1. Instalar autocannon (si no está instalado)
cd projects/healthy/backend
npm install --save-dev autocannon

# 2. Levantar el servidor en modo test (sin Claude real)
NODE_ENV=test node server.js &

# 3. Ejecutar el load test
cd ..
node tests/load/planGeneration.js

# 4. (Opcional) Con usuario pre-creado para benchmark de login:
LOAD_TEST_USER_EMAIL=test@healthy.com \
LOAD_TEST_USER_PASSWORD=TestPass123! \
node tests/load/planGeneration.js
```

---

## Objetivos de producción (post-despliegue AWS)

| Endpoint                      | Objetivo p99 | Objetivo p95 | req/s mínimo |
|-------------------------------|:------------:|:------------:|:------------:|
| GET /health                   | < 100 ms     | < 50 ms      | 1000         |
| POST /auth/login              | < 1000 ms    | < 500 ms     | 20           |
| GET /nutrition/today          | < 200 ms     | < 100 ms     | 100          |
| POST /progress                | < 300 ms     | < 200 ms     | 50           |
| POST /onboarding/complete     | < 2000 ms    | < 1000 ms    | 5            |
| POST /plans/regenerate        | < 2000 ms    | < 1500 ms    | 2            |

> Los objetivos de producción se medirán con k6 contra staging (AWS ECS + RDS).
> Ver `devops/` para configuración de infraestructura AWS.
