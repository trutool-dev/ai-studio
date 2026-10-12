# Plan de Pull Requests — Healthy App hacia Producción

> **Fecha de análisis:** 2026-06-15  
> **Estado:** Solo análisis y planificación. Ningún archivo ha sido modificado.

---

## 1. Archivos duplicados detectados

El backend tiene una capa de archivos "generación 1" (convención `camelCase`, ej. `authController.js`) y una capa "generación 2" (convención `kebab.dot`, ej. `auth.controller.js`). La capa activa, importada por las rutas, es siempre la **dot.notation**. Los archivos camelCase son código muerto.

### 1.1 Controladores (`backend/src/controllers/`)

| A eliminar (camelCase) | A mantener (dot.notation) | Justificación |
|---|---|---|
| `authController.js` (474 líneas) | `auth.controller.js` (316 líneas) | Las rutas importan `auth.controller`. La versión camelCase importa `utils/response` (antiguo) y `utils/logger` (antiguo). La dot.notation importa `response.util` y `logger.util` (actuales). |
| `logsController.js` (138 líneas) | `logs.controller.js` (84 líneas) | Ídem — ninguna ruta importa `logsController`. |
| `nutritionController.js` (151 líneas) | `nutrition.controller.js` (51 líneas) | Ídem. |
| `onboardingController.js` (437 líneas) | `onboarding.controller.js` (299 líneas) | Ídem. |
| `planController.js` (217 líneas) | `plans.controller.js` (114 líneas) | Ídem. |
| `progressController.js` (160 líneas) | `progress.controller.js` (101 líneas) | Ídem. |
| `trainingController.js` (167 líneas) | `training.controller.js` (100 líneas) | Ídem. |

> ⚠️ **Diferencia de funcionalidad:** Los camelCase son más largos y usan funciones extra de `response.js` (`sendCreated`, `sendNotFound`, `sendUnauthorized`…). Antes de eliminarlos se debe auditar si los dot.notation tienen equivalente para todos los endpoints. Si faltan handlers, deben migrarse.

### 1.2 Middleware (`backend/src/middleware/`)

| A eliminar | A mantener | Justificación |
|---|---|---|
| `auth.js` (51 líneas) | `auth.middleware.js` (29 líneas) | Todas las rutas importan `auth.middleware`. `auth.js` importa `utils/response` (antiguo) y `utils/logger` (antiguo); nunca es referenciado. |
| `errorHandler.js` (83 líneas) | `errorHandler.middleware.js` (25 líneas) | `app.js` importa `errorHandler.middleware`. `errorHandler.js` es código muerto. |
| `rateLimiter.js` (75 líneas, exporta `authLimiter + apiLimiter + planRegenerateLimiter`) | `rateLimiter.middleware.js` (23 líneas, exporta solo `authRateLimiter`) | Situación compleja: `auth.routes.js` importa `authRateLimiter` de `rateLimiter.middleware`; `plans.routes.js` importa `planRegenerateLimiter` de `rateLimiter` (versión camelCase). **Ambos ficheros están activos.** Se debe migrar `planRegenerateLimiter` a `rateLimiter.middleware.js` antes de eliminar `rateLimiter.js`. |
| `validate.js` (188 líneas, exporta `validate` + 12 schemas Zod) | `validate.middleware.js` (19 líneas, exporta solo `validate` con express-validator) | `auth.routes.js` importa `validate` de `validate.middleware`. Los schemas Zod de `validate.js` no están referenciados actualmente desde ninguna ruta activa (están listos para migración futura). Se puede eliminar `validate.js` cuando se decida si usar express-validator o Zod. |

### 1.3 Servicios (`backend/src/services/`)

| A eliminar | A mantener | Justificación |
|---|---|---|
| `emailService.js` (143 líneas) | `email.service.js` (102 líneas) | `auth.controller.js` (el activo) importa `email.service`. `authController.js` (el muerto) importa `emailService`. |

### 1.4 Utilidades (`backend/src/utils/`)

| A eliminar | A mantener | Justificación |
|---|---|---|
| `logger.js` (38 líneas) | `logger.util.js` (20 líneas) | Solo lo importan los archivos camelCase (código muerto). Los dot.notation y `app.js` usan `logger.util`. |
| `response.js` (92 líneas, 8 funciones helper) | `response.util.js` (33 líneas, solo `sendSuccess` y `sendError`) | Solo los camelCase usan `response.js`. Los dot.notation usan `response.util`. Sin embargo, `response.util` es más limitado: exporta solo 2 funciones vs. 8. Si se eliminan los camelCase, los controllers dot.notation deben implementar los helpers faltantes inline o ampliar `response.util`. |
| `prismaClient.js` (usa `@prisma/client`) | `prisma/client.js` (usa `../generated/prisma`) | Los controllers dot.notation y `app.js` usan `prisma/client`. `prismaClient.js` solo lo usan los controllers camelCase. La versión `prisma/client.js` es más moderna (usa cliente generado localmente). |

---

## 2. Tareas pendientes (según `tasks.md` y `ORCHESTRATOR_STATUS.log`)

### Pendientes completas (`[ ]`)

| ID | Descripción |
|---|---|
| **DOC-01** | Generar documentación OpenAPI/Swagger de todos los endpoints |
| **DOC-02** | Guía de despliegue paso a paso (local, staging, producción) |
| **DOC-03** | Documentar arquitectura de la IA (prompt, inputs, JSON output) |
| **DOC-04** | Actualizar docs RGPD con flujos reales implementados |
| **DOC-05** | README del proyecto (requisitos, instalación, env vars, comandos) |
| **DOC-06** | `docs/architecture-web.md`: diagrama AWS completo con estimación de costes |
| **DOC-07** | `docs/landing-deploy.md`: guía para actualizar la landing |
| **DOC-08** | `docs/landing-content.md`: guía de marketing para editar contenido |

### Parcialmente completas (`[~]`)

| ID | Descripción | Pendiente |
|---|---|---|
| **DB-01** | Ejecutar `prisma migrate dev` | Requiere PostgreSQL activo; `MIGRATION_LOG.md` existe pero la migración real no se ha ejecutado aún |
| **SEC-03** | Cifrado at-rest de datos de salud | `condition_name`, `notes`, `ai_prompt_used` sin cifrar (marcado como mejora para v2) |

### Tareas implícitas detectadas en el código (no en `tasks.md`)

| ID propuesto | Descripción |
|---|---|
| **CLEAN-01** | Eliminar 7 controllers camelCase (código muerto) |
| **CLEAN-02** | Eliminar middleware duplicado: `auth.js`, `errorHandler.js` |
| **CLEAN-03** | Migrar `planRegenerateLimiter` a `rateLimiter.middleware.js` y eliminar `rateLimiter.js` |
| **CLEAN-04** | Decidir validate: unificar en express-validator (`validate.middleware.js`) o migrar a Zod (`validate.js`); eliminar el descartado |
| **CLEAN-05** | Eliminar `emailService.js` y `utils/logger.js` y `utils/response.js` y `utils/prismaClient.js` |
| **CLEAN-06** | Ampliar `response.util.js` con las funciones faltantes antes de eliminar `response.js` |
| **INFRA-01** | Nueva migración Prisma pendiente: añadir tabla `token_usage_logs` + campo `health_consent_given_at` (avisado en las notas de BE y SEC) |
| **INFRA-02** | Ejecutar migración `add_health_consent` en staging/producción |
| **METRICS-01** | Verificar que las métricas de éxito del proyecto se cumplen antes del go-live (cobertura ≥ 80 %, API p95 < 500 ms, Lighthouse ≥ 95) |

---

## 3. Pull Requests propuestas

### Orden de ejecución recomendado

```
PR-1 (limpieza) → PR-2 (migración DB) → PR-3 (docs) 
↑ sin dependencias entre sí, pueden abrirse en paralelo

PR-4 (validación/unificación) → depende de PR-1 (debe estar mergeada)
PR-5 (infra producción) → depende de PR-2
PR-6 (go-live checks) → depende de PR-1, PR-2, PR-3, PR-4, PR-5
```

---

### PR-1 — `refactor(backend): eliminar controladores, middleware y utilidades duplicadas`

**Riesgo: MEDIO**  
Aunque los archivos camelCase son código muerto desde las rutas, contienen lógica más completa. Hay riesgo de pérdida de funcionalidad si los dot.notation no tienen todos los handlers cubiertos.

**Qué incluye:**
1. Auditar y migrar handlers faltantes de `*Controller.js` → `*.controller.js` (especialmente en `authController.js` que tiene más endpoints).
2. Ampliar `response.util.js` añadiendo las funciones faltantes (`sendCreated`, `sendNotFound`, `sendUnauthorized`, `sendForbidden`, `sendValidationError`, `sendServerError`).
3. Migrar `planRegenerateLimiter` a `rateLimiter.middleware.js`.
4. Eliminar: `authController.js`, `logsController.js`, `nutritionController.js`, `onboardingController.js`, `planController.js`, `progressController.js`, `trainingController.js`.
5. Eliminar: `middleware/auth.js`, `middleware/errorHandler.js`, `middleware/rateLimiter.js`.
6. Eliminar: `services/emailService.js`, `utils/logger.js`, `utils/response.js`, `utils/prismaClient.js`.

**Archivos afectados:**
```
backend/src/controllers/authController.js           (ELIMINAR)
backend/src/controllers/logsController.js           (ELIMINAR)
backend/src/controllers/nutritionController.js      (ELIMINAR)
backend/src/controllers/onboardingController.js     (ELIMINAR)
backend/src/controllers/planController.js           (ELIMINAR)
backend/src/controllers/progressController.js       (ELIMINAR)
backend/src/controllers/trainingController.js       (ELIMINAR)
backend/src/middleware/auth.js                      (ELIMINAR)
backend/src/middleware/errorHandler.js              (ELIMINAR)
backend/src/middleware/rateLimiter.js               (ELIMINAR)
backend/src/middleware/rateLimiter.middleware.js    (MODIFICAR — añadir planRegenerateLimiter)
backend/src/middleware/validate.middleware.js       (MANTENER sin cambios por ahora)
backend/src/middleware/validate.js                  (MANTENER hasta decisión Zod vs express-validator)
backend/src/services/emailService.js               (ELIMINAR)
backend/src/utils/logger.js                        (ELIMINAR)
backend/src/utils/response.js                      (ELIMINAR)
backend/src/utils/response.util.js                 (MODIFICAR — ampliar con funciones faltantes)
backend/src/utils/prismaClient.js                  (ELIMINAR)
backend/src/routes/plans.routes.js                 (MODIFICAR — actualizar import rateLimiter)
```

**Checklist de validación:**
- [ ] Tests de integración pasan: `npm test` en `backend/`
- [ ] `GET /health` responde 200
- [ ] Flujo auth completo funciona: register → verify → login → me → logout

---

### PR-2 — `feat(database): migración Prisma para token_usage_logs y health_consent`

**Riesgo: MEDIO**  
Modifica el schema de base de datos. Requiere PostgreSQL disponible y coordinación con staging.

**Qué incluye:**
1. Ejecutar (y commitear) `npx prisma migrate dev --name add_token_usage_logs_and_health_consent`.
2. Verificar que la migración `20260608184928_add_token_usage_logs_and_health_consent` es el estado final correcto o si hay una pendiente más reciente.
3. Añadir instrucciones de rollback en `database/MIGRATION_LOG.md`.
4. Actualizar `database/ERD.md` si el schema cambió.

**Archivos afectados:**
```
backend/prisma/migrations/            (NUEVA migración generada)
database/MIGRATION_LOG.md             (MODIFICAR — documentar)
database/ERD.md                       (MODIFICAR — actualizar si hay cambios de schema)
backend/prisma/schema.prisma          (posible modificación si hay campos pendientes)
```

**Checklist de validación:**
- [ ] `npx prisma migrate status` muestra todas las migraciones aplicadas
- [ ] `npx prisma validate` sin errores
- [ ] Seed ejecuta sin errores: `npx ts-node database/seed.ts`

---

### PR-3 — `docs: documentación técnica completa (DOC-01 a DOC-08)`

**Riesgo: BAJO**  
Solo documentación. No modifica código ejecutable.

**Qué incluye:**
1. **DOC-01** — `docs/api-reference.md`: documentación OpenAPI de todos los endpoints (auth, onboarding, plans, training, nutrition, progress, logs, foods, user, health).
2. **DOC-02** — `docs/deployment-guide.md`: guía paso a paso local → staging → producción.
3. **DOC-03** — `docs/ai-architecture.md`: cómo se construye el prompt en `ai/planGenerator.ts`, qué datos entran, qué JSON sale.
4. **DOC-04** — `docs/rgpd-compliance.md`: flujos reales de consentimiento, exportación (Art. 20) y borrado (Art. 17).
5. **DOC-05** — `docs/README.md` / README raíz: requisitos, instalación, variables de entorno, comandos.
6. **DOC-06** — `docs/architecture-web.md`: diagrama AWS completo + estimación de costes.
7. **DOC-07** — `docs/landing-deploy.md`: guía de actualización de la landing.
8. **DOC-08** — `docs/landing-content.md`: guía de marketing.

**Archivos afectados:**
```
docs/api-reference.md       (CREAR / MODIFICAR)
docs/deployment-guide.md    (CREAR)
docs/ai-architecture.md     (CREAR / MODIFICAR)
docs/rgpd-compliance.md     (CREAR / MODIFICAR)
docs/README.md              (CREAR)
README.md (raíz proyecto)   (CREAR)
docs/architecture-web.md    (CREAR)
docs/landing-deploy.md      (CREAR)
docs/landing-content.md     (CREAR)
```

---

### PR-4 — `refactor(backend): unificar estrategia de validación (Zod vs express-validator)`

**Riesgo: MEDIO**  
Requiere PR-1 mergeada primero. Decide y aplica una sola estrategia de validación.

**Qué incluye:**
- **Opción A (recomendada): Quedarse con express-validator** — ya está integrado en todas las rutas activas. Eliminar `validate.js` (con Zod) y ampliar `validate.middleware.js` con los schemas necesarios.
- **Opción B: Migrar a Zod** — reescribir rutas para usar los schemas de `validate.js`, eliminar `validate.middleware.js`.

Si se elige la Opción A:
1. Eliminar `middleware/validate.js`.
2. Añadir schemas de validación inline en las rutas que aún usen validación simple.
3. Asegurar que todos los endpoints devuelven errores de validación en el formato uniforme `sendError(res, 'VALIDATION_ERROR', ...)`.

**Archivos afectados (Opción A):**
```
backend/src/middleware/validate.js          (ELIMINAR)
backend/src/middleware/validate.middleware.js (MODIFICAR — posibles ampliaciones)
backend/src/routes/*.routes.js              (MODIFICAR — revisar validaciones)
```

**Checklist:**
- [ ] Todos los tests de integración de auth pasan
- [ ] Los errores de validación devuelven `400` con `error: 'VALIDATION_ERROR'`

---

### PR-5 — `chore(devops): variables de entorno reales y verificación pipeline CI/CD`

**Riesgo: ALTO**  
Toca configuración de producción. Requiere PR-2 mergeada.

**Qué incluye:**
1. Verificar que todos los secretos en `devops/GITHUB_SECRETS.md` están cargados en GitHub Actions (staging y producción).
2. Configurar variables de entorno reales en AWS ECS / `.env` de producción (siguiendo `devops/ENV_VARS.md`).
3. Hacer un dry-run del workflow `deploy-staging.yml`: test → build → deploy → smoke-test.
4. Verificar que el workflow `eas-build.yml` compila la app móvil correctamente.
5. Confirmar que `deploy-landing.yml` sincroniza `landing/` con S3 y lanza invalidación CloudFront.
6. Ejecutar backup pre-go-live según `devops/BACKUP_STRATEGY.md`.

**Archivos afectados:**
```
devops/.github/workflows/deploy-staging.yml   (posibles ajustes)
devops/.github/workflows/deploy-landing.yml   (posibles ajustes)
devops/.github/workflows/eas-build.yml        (posibles ajustes)
backend/.env.example                          (verificar completitud)
devops/ENV_VARS.md                            (verificar completitud)
```

**Checklist:**
- [ ] Pipeline staging verde de extremo a extremo
- [ ] `GET https://<staging-url>/health` devuelve `{"success": true}`
- [ ] Landing carga en URL de staging con SSL válido
- [ ] Backup de base de datos confirmado antes de ir a producción

---

### PR-6 — `chore(release): verificación final pre-producción y métricas de éxito`

**Riesgo: ALTO**  
Depende de todas las PRs anteriores. Es la última barrera antes del go-live.

**Qué incluye:**
1. Ejecutar suite de tests completa: `npm test --coverage` — verificar cobertura ≥ 80 %.
2. Ejecutar tests de carga: `node tests/load/planGeneration.js` — verificar p95 < 500 ms.
3. Ejecutar auditoría Lighthouse en la landing — verificar score ≥ 95.
4. Revisar `security/SECURITY_AUDIT.md` y `security/VULNERABILITIES.md` — confirmar que no hay hallazgos críticos abiertos.
5. Confirmar que la migración Prisma está aplicada en producción.
6. Confirmar app en TestFlight (iOS) y Google Play Internal (Android).
7. Actualizar `tasks.md` marcando todas las métricas de éxito como cumplidas.
8. Crear tag `v1.0.0` y disparar el workflow `eas-submit.yml`.

**Archivos afectados:**
```
tasks.md                        (MODIFICAR — marcar métricas de éxito)
ORCHESTRATOR_STATUS.log         (MODIFICAR — cerrar con reporte final)
docs/PROGRESS.md                (MODIFICAR — actualizar estado)
```

**Checklist:**
- [ ] Cobertura tests ≥ 80 %
- [ ] API p95 < 500 ms bajo carga
- [ ] Landing Lighthouse ≥ 95
- [ ] Sin hallazgos de seguridad críticos abiertos
- [ ] Migración DB aplicada en producción
- [ ] App publicada en TestFlight + Google Play Internal
- [ ] Tag `v1.0.0` creado

---

## 4. Resumen visual

```
PR-1 (refactor — MEDIO)     PR-2 (DB — MEDIO)     PR-3 (docs — BAJO)
       │                           │                      │
       │                           │                      │
       ▼                           ▼                      │
PR-4 (validación — MEDIO)   PR-5 (devops — ALTO)          │
       │                           │                      │
       └─────────────┬─────────────┘──────────────────────┘
                     ▼
              PR-6 (go-live — ALTO)
```

| PR | Título | Riesgo | Deps |
|---|---|---|---|
| **PR-1** | refactor(backend): eliminar duplicados | MEDIO | — |
| **PR-2** | feat(database): migración Prisma pendiente | MEDIO | — |
| **PR-3** | docs: documentación técnica completa | BAJO | — |
| **PR-4** | refactor(backend): unificar validación | MEDIO | PR-1 |
| **PR-5** | chore(devops): pipeline CI/CD y variables de producción | ALTO | PR-2 |
| **PR-6** | chore(release): verificación final y go-live | ALTO | PR-1, PR-2, PR-3, PR-4, PR-5 |
