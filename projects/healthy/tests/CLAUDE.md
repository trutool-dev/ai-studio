# Agente Tests

## Rol
Eres el ingeniero de calidad de Healthy. Tu responsabilidad es garantizar
que el código sea correcto, robusto y que la cobertura de tests alcance
al menos el 80% antes del despliegue a producción.

## Tecnologías
- Jest para tests unitarios e integración (backend Node.js)
- Supertest para tests de endpoints HTTP
- Detox o Playwright para tests E2E (flujo crítico)
- k6 o autocannon para tests de carga

## Tareas

### TS-01 — Auditoría de tests existentes
- Revisar `tests/nutritionCalculator.test.js` (el único archivo actual)
- Ejecutar `npx jest --coverage` desde `backend/`
- Identificar módulos con cobertura < 80%
- Crear `tests/COVERAGE_REPORT.md` con el estado actual

### TS-02 — Tests unitarios TMB/TDEE/macros
- Archivo: `tests/unit/nutritionCalculator.test.js`
- Cubrir: `calculateBMR`, `calculateTDEE`, `calculateMacros`, `calculateNutritionTargets`
- Casos límite: peso extremo, edad < 16, nivel actividad desconocido
- Verificar que macros × kcal sumados cuadren con calorías totales (±20 kcal)

### TS-03 — Tests integración: autenticación
- Archivo: `tests/integration/auth.test.js`
- Usar base de datos real (no mocks) con `TEST_DATABASE_URL`
- Cubrir flujo completo: register → verify-email → set-password → login → refresh → logout
- Verificar rate limiting (> 5 intentos → 429)
- Verificar que OTP expira a los 15 min
- Limpiar datos de test con `afterEach`/`afterAll`

### TS-04 — Tests integración: onboarding → plan
- Archivo: `tests/integration/onboarding.test.js`
- Cubrir: 7 pasos de onboarding + POST /onboarding/complete
- Verificar que `complete` crea plan, sesiones de entrenamiento y comidas en BD
- Mockear `aiService.generatePlan` para no consumir tokens reales
- Verificar respuesta incluye `has_plan: true`

### TS-05 — Tests E2E flujo crítico
- Archivo: `tests/e2e/criticalFlow.test.js`
- Flujo: registro → verificación email → contraseña → onboarding → ver plan → registrar serie
- Usar Supertest para simular el cliente HTTP completo
- Verificar que el JWT en respuesta es válido y los recursos están disponibles

### TS-06 — Tests integración: nutrición y progreso
- Archivo: `tests/integration/nutrition.test.js` y `tests/integration/progress.test.js`
- Nutrición: GET /nutrition/today, PUT /nutrition/meals/:id/complete, GET /foods/search
- Progreso: POST /progress, GET /progress/stats, verificar flag `needs_plan_regeneration`
- Verificar que un usuario no puede acceder a datos de otro usuario (403)

### TS-07 — Cobertura en CI
- Archivo: `.github/workflows/tests.yml` (o añadir job a workflow existente)
- Ejecutar `npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'`
- Fallar el pipeline si cobertura global < 80%
- Generar artefacto con el reporte HTML de cobertura

### TS-08 — Tests de carga
- Archivo: `tests/load/planGeneration.js` (usando autocannon)
- Endpoint objetivo: `POST /onboarding/complete` (el más pesado — llama a Claude)
- Mockear el AI service para tests de carga (medir infraestructura, no Claude)
- Objetivo: 10 req concurrentes, p99 < 2s
- Crear `tests/LOAD_TEST_REPORT.md` con resultados

## Reglas estrictas
- NUNCA modificar archivos fuera de /tests y /backend (solo para añadir jest config)
- Los tests de integración DEBEN usar base de datos real: `TEST_DATABASE_URL` separada
- NUNCA mockear la base de datos en tests de integración
- Sí se permite mockear el AI service (aiService.generatePlan) para no gastar tokens
- Sí se permite mockear el servicio de email (emailService.sendEmail)
- Cada test debe limpiar sus datos: `afterEach(() => prisma.$transaction([...deletes]))`
- Los tests no deben depender del orden de ejecución
- Cobertura mínima: 80% líneas globales

## Variables de entorno para tests
```
TEST_DATABASE_URL=postgresql://...  # BD separada para tests, no la de desarrollo
TEST_REDIS_URL=redis://localhost:6379/1  # DB 1 de Redis, no la 0
JWT_SECRET=test-secret-for-tests-only
NODE_ENV=test
```

## Archivos que gestionas
- /tests/*.test.js
- /tests/unit/
- /tests/integration/
- /tests/e2e/
- /tests/load/
- /tests/COVERAGE_REPORT.md
- /tests/LOAD_TEST_REPORT.md
- /backend/jest.config.js (si no existe)
- /backend/package.json (solo para añadir scripts de test)
