# Informe de fallos — Test Suite Healthy Backend
> Fecha: 2026-07-08

## Resumen
- Total suites: 10
- Suites pasadas: 3
- Suites fallidas: 7
- Tests pasados: 100
- Tests fallidos: 124
- Cobertura global statements: 41.91%
- Cobertura global lines: 43.93% (**NO alcanza el umbral mínimo de 80%**)

## Causa raíz unificada

**Todos los 124 tests fallidos comparten una causa raíz única: la base de datos PostgreSQL no está disponible en `localhost:5432`.**

El cliente Prisma usa `@prisma/adapter-pg` con `new Pool({ connectionString: DATABASE_URL })`. Al ejecutar los tests, PostgreSQL responde con `ECONNRESET` (servidor cierra la conexión activamente). Esto significa que el proceso de base de datos local **no está corriendo** o que la instancia Railway a la que apunta `DATABASE_URL` no admite conexiones directas sin SSL/TLS configurado correctamente.

Consecuencias en cascada:
1. `POST /auth/register` falla con 500 → el helper `createVerifiedUser` en `testSetup.js:53` no puede leer el OTP → **todas las suites de integración y E2E fallan en setup**
2. Sin autenticación exitosa, todos los endpoints protegidos devuelven 401 en lugar de 200/201/404
3. Sin BD, los endpoints de datos devuelven 500 (Prisma lanza `PrismaClientKnownRequestError`)

---

## Fallos por suite

### tests/integration/auth.test.js (30 fallos)
**Error tipo:** setup-failure (29 tests) + assertion-failure (1 test)

**Patrón dominante — todos los tests excepto el de rate-limiting:**
- `PrismaClientKnownRequestError` en `testSetup.js:53` (`prisma.user.findUnique`)
- `Causa probable:` `createVerifiedUser` llama a `POST /auth/register`, que internamente llama a `prisma.user.findUnique` en `auth.controller.js:62`. La conexión PostgreSQL lanza `Server has closed the connection` → el endpoint devuelve 500 → el helper intenta `findUnique` directamente y también falla.

#### Test: "POST /auth/register › registra un usuario nuevo correctamente"
- **Esperado:** status 201
- **Recibido:** status 500
- **Causa probable:** Prisma no puede conectar a PostgreSQL — `ECONNRESET` en `pg.Pool`

#### Test: "POST /auth/register › crea un registro en la BD con status pending_verification"
- **Esperado:** status 201, registro en BD
- **Recibido:** status 500, `PrismaClientKnownRequestError` (Server has closed the connection)
- **Causa probable:** misma que anterior

#### Test: "POST /auth/register › crea un código de verificación de 6 dígitos en la BD"
- **Esperado:** status 201, `verificationCode` en BD
- **Recibido:** status 500
- **Causa probable:** misma que anterior

#### Test: "POST /auth/register › devuelve 409 si el email ya existe"
- **Esperado:** status 409
- **Recibido:** status 500
- **Causa probable:** misma que anterior (la conexión BD falla antes de detectar duplicado)

#### Tests: "POST /auth/verify-email" (6 tests)
- **Esperado:** status 200/400/404 según escenario
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53` (setup falla antes de ejecutar el test)
- **Causa probable:** `createVerifiedUser` no puede completar porque registro falla con 500

#### Tests: "POST /auth/set-password" (4 tests)
- **Esperado:** status 200/400
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Tests: "POST /auth/login" (5 tests)
- **Esperado:** status 200/400/401
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Tests: "POST /auth/refresh" (3 tests)
- **Esperado:** status 200/400/401
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Tests: "GET /auth/me" (3 tests)
- **Esperado:** status 200/401
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Tests: "POST /auth/logout" (3 tests)
- **Esperado:** status 200/401
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Test: "Flujo completo: register → verify → set-password → login → me → logout"
- **Esperado:** flujo completo exitoso
- **Recibido:** `PrismaClientKnownRequestError` en `testSetup.js:53`
- **Causa probable:** misma que anterior

#### Test: "Rate limiting en /auth/* › más de 5 peticiones de login desde la misma IP → 429"
- **Error tipo:** assertion-failure (diferente al resto)
- **Esperado:** `[401, 429].toContain(lastStatus)` — es decir, el último status debe ser 401 o 429
- **Recibido:** `lastStatus = 500` — los 6 intentos de login devuelven 500 porque BD no conecta
- **Causa probable:** La BD no disponible hace que todos los intentos de login devuelvan 500 en vez de 401/429. El test no contempla el caso 500.

---

### tests/integration/onboarding.test.js (20 fallos)
**Error tipo:** setup-failure

**Patrón:** Todos los tests fallan en `beforeEach`/`createAndLoginUser` → `createVerifiedUser` → `prisma.user.findUnique` en `testSetup.js:53`.

#### Tests afectados (todos):
- "POST /onboarding/start › devuelve user_id del usuario autenticado"
- "POST /onboarding/start › requiere autenticación"
- "PUT /onboarding/profile › guarda el perfil físico correctamente"
- "PUT /onboarding/profile › persiste el perfil en BD"
- "PUT /onboarding/profile › rechaza menores de 16 años"
- "PUT /onboarding/lifestyle › guarda el estilo de vida correctamente"
- "PUT /onboarding/training › guarda preferencias de entrenamiento"
- "PUT /onboarding/nutrition › guarda preferencias nutricionales"
- "PUT /onboarding/health › guarda condiciones de salud vacías"
- "PUT /onboarding/health › guarda condiciones de salud con datos"
- "PUT /onboarding/motivation › guarda el perfil de motivación"
- "POST /onboarding/complete › completa el onboarding y devuelve el plan generado"
- "POST /onboarding/complete › crea un plan en la BD"
- "POST /onboarding/complete › crea sesiones de entrenamiento en la BD"
- "POST /onboarding/complete › crea comidas en la BD"
- "POST /onboarding/complete › la respuesta incluye metabolism con bmr, tdee, target_calories"
- "POST /onboarding/complete › falla si no hay perfil físico (PROFILE_REQUIRED)"
- "POST /onboarding/complete › falla si no hay preferencias de entrenamiento (TRAINING_REQUIRED)"
- "POST /onboarding/complete › requiere autenticación"

**Causa probable (todos):** `PrismaClientKnownRequestError: Server has closed the connection` — PostgreSQL no disponible

---

### tests/integration/nutrition.test.js (18 fallos)
**Error tipo:** setup-failure

**Patrón:** Todos fallan en `createAndLoginUser` → `prisma.user.findUnique` en `testSetup.js:53`.

#### Tests afectados (todos):
- "GET /nutrition/today › devuelve lista de comidas del día (vacía si no hay)"
- "GET /nutrition/today › incluye totales de macros del día"
- "GET /nutrition/today › devuelve solo las comidas del usuario autenticado"
- "GET /nutrition/today › requiere autenticación → 401"
- "GET /nutrition/meals › acepta parámetro de fecha ?date=YYYY-MM-DD"
- "GET /nutrition/meals › requiere autenticación"
- "PUT /nutrition/meals/:id/complete › marca la comida como completada"
- "PUT /nutrition/meals/:id/complete › comida ya completada → 400 MEAL_ALREADY_COMPLETED"
- "PUT /nutrition/meals/:id/complete › otro usuario no puede completar la comida → 404"
- "PUT /nutrition/meals/:id/complete › ID de comida inexistente → 404"
- "PUT /nutrition/meals/:id/complete › requiere autenticación → 401"
- "GET /foods/search › busca alimentos con query válida"
- "GET /foods/search › query de 1 carácter → 400 QUERY_TOO_SHORT"
- "GET /foods/search › sin parámetro q → 400"
- "GET /foods/search › requiere autenticación → 401"
- "GET /foods/search › busca con query de exactamente 2 caracteres → 200"
- "GET /foods/barcode/:code › código inexistente → 404"
- "GET /foods/barcode/:code › requiere autenticación → 401"

**Causa probable (todos):** PostgreSQL no disponible

---

### tests/integration/progress.test.js (17 fallos)
**Error tipo:** setup-failure

**Patrón:** Todos fallan en `createAndLoginUser` → `prisma.user.findUnique` en `testSetup.js:53`.

#### Tests afectados (todos):
- "GET /progress › devuelve lista vacía si no hay registros"
- "GET /progress › devuelve los registros del usuario"
- "GET /progress › acepta parámetros de paginación limit y offset"
- "GET /progress › requiere autenticación → 401"
- "POST /progress › crea un registro de progreso correctamente"
- "POST /progress › no permite dos registros para la misma fecha"
- "POST /progress › un segundo usuario puede registrar para la misma fecha sin conflicto"
- "POST /progress › needs_plan_regeneration es false por defecto (sin estancamiento)"
- "POST /progress › needs_plan_regeneration es true cuando hay estancamiento detectado"
- "POST /progress › requiere autenticación → 401"
- "GET /progress/stats › devuelve stats vacías si no hay registros"
- "GET /progress/stats › calcula stats cuando hay registros de peso"
- "GET /progress/stats › la respuesta incluye todas las propiedades esperadas"
- "GET /progress/stats › requiere autenticación → 401"
- "GET /progress/stats › aislamiento: un usuario no ve el progreso de otro"
- "Aislamiento de datos entre usuarios › usuario B no puede ver el historial de usuario A"
- "Aislamiento de datos entre usuarios › los stats de usuario B no incluyen datos de usuario A"

**Causa probable (todos):** PostgreSQL no disponible

---

### tests/integration/logs.test.js (13 fallos)
**Error tipo:** setup-failure

**Patrón:** Todos fallan en `createAndLoginUser` → `prisma.user.findUnique` en `testSetup.js:53`.

#### Tests afectados (todos):
- "GET /logs/today › crea y devuelve el log del día al primer acceso"
- "GET /logs/today › segunda llamada devuelve el mismo log (idempotente)"
- "GET /logs/today › requiere autenticación → 401"
- "PUT /logs/today › actualiza agua y sueño correctamente"
- "PUT /logs/today › actualiza energía, pasos y ánimo"
- "PUT /logs/today › actualización parcial no borra campos previos"
- "PUT /logs/today › requiere autenticación → 401"
- "GET /logs/history › devuelve array vacío si no hay historial"
- "GET /logs/history › acepta parámetro days"
- "GET /logs/history › limita days a 365 como máximo"
- "GET /logs/history › incluye averages cuando hay datos con valores"
- "GET /logs/history › requiere autenticación → 401"
- "GET /logs/history › aislamiento: solo devuelve logs del usuario autenticado"

**Causa probable (todos):** PostgreSQL no disponible

---

### tests/integration/user.test.js (9 fallos)
**Error tipo:** setup-failure

**Patrón:** Todos fallan en `createAndLoginUser` → `prisma.user.findUnique` en `testSetup.js:53`.

#### Tests afectados (todos):
- "GET /user/me/export › devuelve estructura de exportación completa con status 200"
- "GET /user/me/export › incluye todas las secciones RGPD esperadas"
- "GET /user/me/export › devuelve arrays vacíos para datos que no existen"
- "GET /user/me/export › establece Content-Disposition como adjunto descargable"
- "GET /user/me/export › requiere autenticación → 401"
- "GET /user/me/export › no expone datos de otro usuario"
- "DELETE /user/me › elimina la cuenta del usuario y devuelve 200"
- "DELETE /user/me › el token queda inválido después de borrar la cuenta"
- "DELETE /user/me › borra todos los datos del usuario de la base de datos"

**Causa probable (todos):** PostgreSQL no disponible

---

### tests/e2e/criticalFlow.test.js (18 fallos)
**Error tipo:** setup-failure + assertion-failure en cascada

**Patrón:**
- Paso 1 (registro): devuelve 500 en lugar de 201 → `prisma.user.findUnique` en `criticalFlow.test.js:186` falla con `Server has closed the connection`
- Pasos 3–9 y 12–13: reciben 401 porque `accessToken` es undefined (login no pudo completarse)
- Paso 11 (refresh): recibe 400 en lugar de 200 (no hay `refresh_token` válido)
- Paso 10 (progreso): recibe 401

#### Test: "Paso 1 — Registro de usuario"
- **Esperado:** status 201
- **Recibido:** status 500
- **Causa probable:** PostgreSQL no disponible → `auth.controller.js:62` lanza `PrismaClientKnownRequestError`

#### Test: "Paso 2 — Verificación de email con OTP"
- **Esperado:** status 200
- **Recibido:** `PrismaClientKnownRequestError: Server has closed the connection` en `criticalFlow.test.js:186` (`prisma.user.findUnique`)
- **Causa probable:** No se pudo registrar el usuario en Paso 1 → no existe en BD → `findUnique` falla

#### Tests: "Pasos 3–6, 7–9, 12–13"
- **Esperado:** status 200/201
- **Recibido:** 401 (Unauthorized)
- **Causa probable:** `accessToken` es `undefined` porque el login en Paso 4 falló (sin BD no hay usuario)

#### Test: "Paso 11 — Renovar access token con refresh token"
- **Esperado:** status 200, nuevo `access_token`
- **Recibido:** status 400
- **Causa probable:** `refreshToken` es `undefined` → el endpoint devuelve 400 (body vacío o inválido)

---

## Suites que pasan

| Suite | Tests pasados | Motivo |
|-------|--------------|--------|
| `tests/unit/calculations.test.js` | 36/36 | Tests unitarios puros — sin BD ni red |
| `tests/unit/nutritionCalculator.test.js` | 53/53 | Tests unitarios puros — sin BD ni red |
| `tests/nutritionCalculator.test.js` | 11/11 | Tests unitarios puros — sin BD ni red |

---

## Archivos del backend que necesitan corrección

### Causa primaria (infraestructura — no código)

La totalidad de los 124 fallos tiene origen en **infraestructura**, no en bugs de código de aplicación:

**`DATABASE_URL` = `postgresql://healthy:healthy_pass@localhost:5432/healthy_db`**

PostgreSQL no corre localmente (ni tampoco hay `TEST_DATABASE_URL` configurada). La conexión falla con `ECONNRESET`. Para que los tests de integración pasen es necesario:

1. Levantar PostgreSQL local (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=healthy_pass postgres`) o
2. Configurar `TEST_DATABASE_URL` apuntando a la instancia Railway (con SSL)

### Problema secundario en código (1 fallo — rate limiting)

El test de rate limiting en `tests/integration/auth.test.js:614` tiene una lógica de aserción que no cubre el caso 500:

```js
// Solo acepta 401 o 429, pero con BD caída recibe 500
expect([401, 429]).toContain(lastStatus);  // falla si lastStatus === 500
```

Esto es un fallo de test, no de código de producción. El archivo afectado es:
- `projects/healthy/tests/integration/auth.test.js` (línea 614) — **el test no cubre el escenario 500 (BD no disponible)**

### Cobertura de código insuficiente (gap estructural)

La cobertura global de líneas es **43.93%** (umbral requerido: 80%). Esto es también consecuencia directa de la BD no disponible — los controladores nunca se ejecutan. Con BD activa, la cobertura subiría automáticamente conforme los tests de integración pasen.

---

## Prioridad de corrección

1. **[crítico] Infraestructura — PostgreSQL no disponible**
   - Acción: Configurar `TEST_DATABASE_URL` en `.env` de test o levantar PostgreSQL local antes de ejecutar tests
   - Comando: `docker run --name healthy-test-db -e POSTGRES_USER=healthy -e POSTGRES_PASSWORD=healthy_pass -e POSTGRES_DB=healthy_db -p 5432:5432 -d postgres:16`
   - Seguido de: `npx prisma migrate deploy` con `DATABASE_URL` apuntando al contenedor
   - Bloquea: 123 de los 124 tests fallidos

2. **[alto] `tests/integration/auth.test.js:614` — aserción de rate limiting no contempla status 500**
   - Cambio: `expect([401, 429, 500]).toContain(lastStatus)` o reestructurar el test para que falle graciosamente cuando la BD no está disponible
   - Afecta: 1 test

3. **[medio] Cobertura global de líneas (43.93% vs 80% requerido)**
   - Con la BD funcionando y los tests de integración pasando, la cobertura subirá automáticamente
   - Los controladores con 0% de cobertura (`logs.controller.js`, `nutrition.controller.js`, `plans.controller.js`, `progress.controller.js`, `training.controller.js`, `user.controller.js`, `onboarding.controller.js`) no tienen tests unitarios propios — dependen de los tests de integración

4. **[bajo] `src/utils/response.util.js` — cobertura 58.82% (líneas 9, 37, 44, 51, 58, 68, 81 sin cubrir)**
   - Algunos helpers de respuesta (`sendPaginated`, `sendCreated`, etc.) no son ejercitados por los tests unitarios existentes

---

## Cobertura de código por archivo

> Medida con la BD caída — los controladores muestran cobertura muy baja porque no se ejecutan en tiempo de test.

```
Archivo                         | % Stmts | % Branch | % Funcs | % Lines | Líneas sin cubrir
--------------------------------|---------|----------|---------|---------|-------------------
ALL FILES                       |   41.91 |    16.49 |   22.44 |   43.93 |
 src/app.js                     |   98.30 |    61.11 |  100.00 |   98.27 | 47
 src/controllers/
  auth.controller.js            |   24.67 |     5.17 |   28.57 |   27.33 | 18-40,63-96,108-123,135-141,153-182,196-208,214-231,237-254,260-272,278-301,307-321
  foods.controller.js           |   25.00 |     0.00 |    0.00 |   25.80 | 15-46,51-56
  logs.controller.js            |   15.90 |     0.00 |    0.00 |   16.27 | 10-16,21-27,32-53,58-81
  nutrition.controller.js       |   21.42 |     0.00 |    0.00 |   24.00 | 11-33,38-48
  onboarding.controller.js      |   10.65 |     0.00 |    0.00 |   11.40 | 13-20,29-31,36-59,64-75,80-91,96-107,112-144,149-160,165-304
  plans.controller.js           |   16.07 |     0.00 |    0.00 |   18.00 | 12-29,34-51,56-96,101-111
  progress.controller.js        |   15.09 |     0.00 |    0.00 |   16.66 | 12-23,28-60,65-98
  training.controller.js        |   15.09 |     0.00 |    0.00 |   17.02 | 11-34,39-53,58-73,78-97
  user.controller.js            |   11.66 |     0.00 |    0.00 |   12.50 | 18-93,104-196
 src/middleware/
  auth.middleware.js            |   80.00 |    83.33 |  100.00 |   80.00 | 19-20,23
  errorHandler.middleware.js    |   80.00 |    50.00 |  100.00 |   80.00 | 14,19
  rateLimiter.middleware.js     |   40.00 |    16.66 |   16.66 |   35.71 | 9-35
  validate.middleware.js        |  100.00 |    75.00 |  100.00 |  100.00 | 13
 src/prisma/
  client.js                     |  100.00 |    66.66 |  100.00 |  100.00 | 10,17
 src/routes/
  auth.routes.js                |  100.00 |   100.00 |  100.00 |  100.00 |
  foods.routes.js               |  100.00 |   100.00 |  100.00 |  100.00 |
  logs.routes.js                |  100.00 |   100.00 |  100.00 |  100.00 |
  nutrition.routes.js           |   80.00 |   100.00 |    0.00 |   80.00 | 13-14
  onboarding.routes.js          |  100.00 |   100.00 |  100.00 |  100.00 |
  plans.routes.js               |  100.00 |   100.00 |  100.00 |  100.00 |
  progress.routes.js            |  100.00 |   100.00 |  100.00 |  100.00 |
  training.routes.js            |   87.50 |   100.00 |    0.00 |   87.50 | 16-17
  user.routes.js                |  100.00 |   100.00 |  100.00 |  100.00 |
 src/services/
  redis.service.js              |  100.00 |    50.00 |  100.00 |  100.00 | 6
 src/utils/
  calculations.util.js         |  100.00 |    97.05 |  100.00 |  100.00 | 109
  crypto.util.js                |   66.66 |   100.00 |    0.00 |   88.88 | 27
  logger.util.js                |  100.00 |    50.00 |  100.00 |  100.00 | 4
  response.util.js              |   58.82 |     0.00 |   12.50 |   58.82 | 9,37,44,51,58,68,81
```

### Notas sobre cobertura real estimada (con BD activa)

Con PostgreSQL disponible y los 124 tests de integración pasando, la cobertura esperada sería aproximadamente:

| Capa | Cobertura estimada |
|------|--------------------|
| `src/controllers/*` | ~75-85% (depende de la completitud de los tests de integración) |
| `src/middleware/*` | ~90%+ |
| `src/utils/*` | ~90%+ (ya están bien cubiertos por tests unitarios) |
| `src/routes/*` | ~100% (ya pasan) |
| **Global estimado** | **~75-85%** (podría no alcanzar el 80% sin tests unitarios de controladores) |
