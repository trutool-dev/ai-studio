# Tasks — Healthy App

## Estado del proyecto
Proyecto en fase de integración. La base estructural está completa
(schema, endpoints stub, diseño, pantallas, tests, CI/CD, RGPD).
El foco actual es conectar las piezas y llevarlo a producción.

---

## Stack tecnológico

| Capa        | Tecnología                              |
|-------------|----------------------------------------|
| Frontend    | React Native + Expo + TypeScript + NativeWind |
| Backend     | Node.js + Express + Prisma             |
| Base datos  | PostgreSQL + Redis                     |
| IA          | Claude API (claude-sonnet-4-6)         |
| Auth        | Supabase                               |
| Landing     | HTML/CSS/JS estático — S3 + CloudFront |
| Cloud       | AWS (ECS, RDS, ElastiCache, S3, CloudFront, Route 53) |
| CI/CD       | GitHub Actions + Expo EAS              |

---

## Agentes necesarios

- **database** → migraciones Prisma y seed
- **backend**  → implementar lógica real en los endpoints stub
- **ai**       → integrar Claude API en el flujo de plan personalizado
- **frontend** → conectar pantallas al backend real
- **design**   → revisión visual final y modo oscuro
- **tests**    → ampliar cobertura hasta ≥ 80 % y tests E2E
- **security** → auditoría RGPD y variables de entorno
- **devops**   → variables de entorno reales y despliegue AWS
- **docs**     → documentación técnica de la API y guía de despliegue

---

## Tareas por agente

### Database
> Carpeta: `projects/healthy/database/`

- [~] **DB-01** Ejecutar `prisma migrate dev` — `MIGRATION_LOG.md` creado; requiere PostgreSQL corriendo: `cd projects/healthy/backend && npx prisma migrate dev --schema ../database/schema.prisma --name init`
- [x] **DB-02** Crear script de seed con datos de prueba realistas — `database/seed.ts` creado (10 usuarios, 20 ejercicios, 200 alimentos, 5 planes)
- [x] **DB-03** Añadir índices en columnas de alta consulta — ya implementados en `schema.prisma`
- [x] **DB-04** Configurar Redis — `database/redis.ts` + `database/CACHE_STRATEGY.md` creados
- [x] **DB-05** Verificar integridad referencial — constraints ya en `schema.prisma` (onDelete: Cascade, UNIQUE, NOT NULL)
- [x] **DB-06** Documentar ERD actualizado — `database/ERD.md` creado (diagrama Mermaid, 21 entidades)

**Dependencias:** ninguna — es el primer paso

---

### Backend
> Carpeta: `projects/healthy/backend/`

- [x] **BE-01** Auth completa: register, verify-email, set-password, login, logout, forgot-password, reset-password, refresh, me
- [x] **BE-02** `POST /onboarding/complete` → guarda 7 pasos, llama AI, calcula TMB/TDEE, persiste plan+sesiones+comidas en DB
- [x] **BE-03** Entrenamiento: `/training/today`, sessions, complete, registrar series (peso + reps)
- [x] **BE-04** Nutrición: meals/today, mark complete, `/foods/search`, `/foods/barcode/:code`
- [x] **BE-05** Progreso: historial, crear medición (con detección de estancamiento AI-04), stats + racha
- [x] **BE-06** Logs diarios: get/create today, update (agua/sueño/energía/pasos/ánimo), history
- [x] **BE-07** Validación: express-validator en todos los endpoints; Zod disponible para servicios
- [x] **BE-08** Rate limiting: authLimiter (5 req/15min en `/auth/*`), apiLimiter (100 req/15min autenticados)
- [x] **BE-09** Redis cache: planes IA, sesiones JWT, búsqueda de alimentos (6h)
- [x] **BE-10** `GET /health` → estado real DB + Redis + timestamp + version

> ⚠️ Ejecutar en backend/: `npm install @anthropic-ai/sdk zod` antes de arrancar
> ⚠️ `database/schema.prisma` actualizado con `TokenUsageLog` — requiere nueva migración

**Dependencias:** DB-01, DB-02, AI-01

---

### AI
> Carpeta: `projects/healthy/ai/`

- [x] **AI-01** Prompt de generación con 7 dimensiones de onboarding — `ai/planGenerator.ts`
- [x] **AI-02** Cálculo TMB/TDEE Mifflin-St Jeor incluido en contexto — `ai/types.ts::calculateMetabolism`
- [x] **AI-03** Respuesta JSON tipada: `GeneratedPlan` con `training_plan`, `nutrition_plan`, `macros`, `weekly_schedule` — `ai/types.ts`
- [x] **AI-04** Regeneración automática: `shouldRegeneratePlan` + `regeneratePlan` — `ai/planGenerator.ts`
- [x] **AI-05** Prompt caching con `cache_control: ephemeral` en system prompt — `ai/planGenerator.ts`
- [x] **AI-06** Fallback plan genérico por reglas si Claude falla — `ai/fallbackPlan.ts`
- [x] **AI-07** Token logger con estimación de coste USD — `ai/tokenLogger.ts` (⚠️ BE debe añadir tabla `token_usage_logs` al schema Prisma)

**Dependencias:** DB-04 (Redis para caché de planes)

---

### Frontend
> Carpeta: `projects/healthy/frontend/`

- [x] **FE-01** Cliente HTTP con interceptor JWT + auto-refresh + queue anti-race-condition — `src/services/api.ts`
- [x] **FE-02** Auth completo: register→verify→set-password→login→logout, tokens en SecureStore — todas las pantallas auth
- [x] **FE-03** Onboarding 7 pasos conectados: PUT por paso + POST /onboarding/complete con loading 5-15s + banner fallback IA
- [x] **FE-04** TrainingScreen: GET /training/today, SetModal (peso+reps), completar ejercicio/sesión, skeleton loader
- [x] **FE-05** NutritionScreen: GET /nutrition/today, FoodSearchBar debounce 300ms, toggle completar comida
- [x] **FE-06** ProgressScreen: GET /progress+stats, modal registro, modal regenerar plan si `needs_plan_regeneration`
- [x] **FE-07** HomeScreen: logs agua/sueño/energía/pasos/ánimo vía PUT /logs/today
- [x] **FE-08** Zustand: authStore (accessToken+refreshToken+login/logout), planStore (training/nutrition/progress/logs), onboardingStore
- [x] **FE-09** Persistencia: SecureStore para tokens, AsyncStorage para plan offline (MMKV en package.json, pendiente build nativo)
- [x] **FE-10** Dark mode: `useTheme()` hook + tokens dark.* — `src/hooks/useTheme.ts`
- [x] **FE-11** Skeleton loaders en todas las pantallas + Toast component con accessibilityRole="alert"
- [x] **FE-12** WCAG AA: colores corregidos en `theme/colors.ts`, Button.tsx fondo `#16A34A`, hitSlop en touchables, accessibilityLabel en todos los componentes
- [x] **FE-13** TrainingScreen: WorkoutCard inProgress + ExerciseRow + RestTimer + WorkoutSummary integrados
- [x] **FE-14** ProgressScreen: ActivityRings + RecoveryScore + MetricGrid integrados

**Dependencias:** BE-01..BE-09, DS-01..DS-10

---

### Design
> Carpeta: `projects/healthy/design/`

- [x] **DS-01** Auditoría del sistema de diseño actual: tokens de color, spacing y tipografía verificados y exportados consistentemente desde `components/index.js`
- [x] **DS-02** Paleta modo oscuro definida en `tokens/colors.js` (`dark.*`) y paleta Whoop-inspired (`whoop.*`) para dashboards de métricas de salud
- [x] **DS-03** Revisar onboarding — `design/screens/ONBOARDING_UI.md` creado
- [x] **DS-04** Revisar pantalla de plan diario — `design/screens/DAILY_PLAN_UI.md` creado
- [x] **DS-05** Diseñar estados vacíos y de error — `design/screens/EMPTY_ERROR_STATES.md` creado
- [x] **DS-06** Validar accesibilidad visual — `design/ACCESSIBILITY_AUDIT.md` creado (54%→92% WCAG AA, 5 blockers con fixes exactos)
- [x] **DS-07** Crear `ProgressRing`, `ActivityRings`, `DailyProgressRing` — anillos de progreso animados inspirados en Apple Watch / Fitness+ con gradiente y fallback sin SVG
- [x] **DS-08** Crear `MetricCard`, `RecoveryScore`, `MetricGrid` — tarjetas de métricas de salud estilo Whoop con sparkline, trend y animación de número
- [x] **DS-09** Crear `WorkoutCard`, `ExerciseRow`, `RestTimer`, `WorkoutSummary` — componentes de sesión de entrenamiento estilo Apple Fitness+ con variantes featured / compact / inProgress
- [x] **DS-10** Diseñar landing page HTML estilo Tag Heuer Connected — paleta cinemática oscura, tipografía premium. Movida a `landing/index.html`

**Dependencias:** ninguna (puede trabajar en paralelo con Backend)

---

### Tests
> Carpeta: `projects/healthy/tests/`

- [x] **TS-01** Auditar los 217 tests existentes: identificar qué módulos tienen cobertura < 80 % — `tests/COVERAGE_REPORT.md` creado
- [x] **TS-02** Añadir tests unitarios para la lógica de cálculo TMB/TDEE/macros en el agente IA — `tests/unit/nutritionCalculator.test.js` (53 tests)
- [x] **TS-03** Añadir tests de integración para los endpoints de autenticación con base de datos real (no mocks) — `tests/integration/auth.test.js`
- [x] **TS-04** Añadir tests de integración para el flujo onboarding → generación de plan — `tests/integration/onboarding.test.js` (AI mockeado)
- [x] **TS-05** Añadir tests E2E con Supertest para el flujo crítico: registro → onboarding → ver plan → registrar medición — `tests/e2e/criticalFlow.test.js`
- [x] **TS-06** Añadir tests de integración para endpoints de nutrición y progreso — `tests/integration/nutrition.test.js` + `tests/integration/progress.test.js`
- [x] **TS-07** Configurar informe de cobertura en CI y fallar el pipeline si cae del 80 % — `.github/workflows/tests.yml` creado
- [~] **TS-08** Tests de carga básicos en los endpoints más pesados (generación de plan IA) — `tests/load/planGeneration.js` + `tests/LOAD_TEST_REPORT.md` — **DIFERIDO por decisión del usuario (2026-07-14): requiere backend levantado localmente; se ejecutará en v1.1.0 post-release**

**Dependencias:** BE-01..BE-09, AI-01..AI-07 (para tests de integración reales)

---

### Security
> Carpeta: `projects/healthy/security/`

- [x] **SEC-01** Variables de entorno auditadas — WARN: sin hardcoding, JWT_SECRET sin validación startup
- [x] **SEC-02** Headers HTTP — Helmet con CSP explícita, `frameguard: deny`, HSTS preload, CORS sin fallback `*`
- [~] **SEC-03** Datos de salud — pendiente: `condition_name`, `notes`, `ai_prompt_used` sin cifrado at-rest (mejora para v2)
- [x] **SEC-04** RGPD — `DELETE /user/me` (Art.17) + `GET /user/me/export` (Art.20) + `health_consent_given_at` en schema + verificación edad 16
- [x] **SEC-05** JWT — PASS: access 15min, refresh 30d, rotación one-time, logout invalida Redis+BD
- [x] **SEC-06** Rate limiting — `planRegenerateLimiter`: 3 req/24h por userId en `/plans/regenerate`
- [x] **SEC-07** OTP usa `crypto.randomInt()` — `src/utils/crypto.util.js`
- [x] **SEC-08** `security/SECURITY_AUDIT.md` + `INCIDENT_RESPONSE.md` + `VULNERABILITIES.md` creados

> ⚠️ Nueva migración pendiente: `npx prisma migrate dev --schema ../database/schema.prisma --name add_health_consent`

**Dependencias:** BE-01..BE-09 (para auditar endpoints reales)

---

### DevOps
> Carpeta: `projects/healthy/devops/`

- [x] **DO-01** Crear `devops/ENV_VARS.md` con todas las variables por categoría (DB, Redis, JWT, Supabase, AI, SMTP, AWS, App) y actualizar `backend/.env.example`
- [x] **DO-02** Crear `devops/GITHUB_SECRETS.md` con lista completa de secretos GitHub Actions separados por staging/producción con instrucciones paso a paso
- [x] **DO-03** Crear `devops/infrastructure/staging.md` con diagrama ASCII de arquitectura + security groups + sizing; crear `infra/vpc.tf`, `infra/rds.tf`, `infra/elasticache.tf`, `infra/ecs.tf`, `infra/alb.tf`
- [x] **DO-04** Crear `.github/workflows/deploy-staging.yml` con jobs: test (cobertura 80%), build (ECR), deploy (ECS), smoke-test (/health con retry)
- [x] **DO-05** Crear `frontend/eas.json` con perfiles development/preview/production y `devops/EAS_BUILD.md` con instrucciones completas + workflow `eas-build.yml`
- [x] **DO-06** Crear `devops/EAS_SUBMIT.md` con requisitos Apple/Google, pasos para generar credenciales, y workflow `eas-submit.yml` (trigger: tag `v*.*.*`)
- [x] **DO-07** Crear `devops/MONITORING.md` con UptimeRobot, CloudWatch Alarms (CPU/RAM/RDS/5xx), logs `/ecs/healthy-api` con retención 30 días, comandos `aws logs tail` y dashboard CloudWatch
- [x] **DO-08** Crear `devops/BACKUP_STRATEGY.md` con RDS automated backups 7 días, snapshots pre-deploy, procedimiento de restauración 5 pasos, y workflow `db-backup.yml` (cron: domingo 02:00 UTC)
- [x] **DO-09** Crear bucket S3 `healthy-landing-prod` para sitio estático: activar static website hosting, bucket policy de acceso público, bloquear uploads directos (solo CI)
- [x] **DO-10** Configurar CloudFront distribution frente al bucket S3: certificado SSL via ACM, dominio personalizado (`healthy.app`), compresión gzip/brotli, redirección HTTP → HTTPS, TTL de caché `86400` para assets
- [x] **DO-11** Configurar DNS en Route 53: registrar o delegar dominio `healthy.app`, crear registro A alias apuntando a la CloudFront distribution
- [x] **DO-12** Añadir job `deploy-landing` en el pipeline GitHub Actions: se dispara en push a `main` con cambios en `landing/`; ejecuta `aws s3 sync landing/ s3://healthy-landing-prod --delete` seguido de `aws cloudfront create-invalidation --paths "/*"`
- [x] **DO-13** Configurar cabeceras de seguridad en CloudFront para la landing vía Lambda@Edge o CloudFront Functions: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`

#### Google Cloud Run — Landing (alternativa serverless a S3+CloudFront)
> Carpeta de trabajo: `projects/healthy/devops/cloudrun/`

- [x] **DO-14** Crear `devops/cloudrun/Dockerfile` — imagen `nginx:alpine` que sirve los archivos estáticos de `landing/`. Puerto 8080 (estándar Cloud Run). Incluir `nginx.conf` con cabeceras de seguridad, compresión gzip y caché inmutable para assets con hash.
- [x] **DO-15** Crear `devops/cloudrun/.dockerignore` — excluir `node_modules`, `.git`, `src/`, archivos de configuración de build (vite, postcss, tailwind) y credenciales (`.env`).
- [x] **DO-16** Crear `devops/cloudrun/deploy.sh` — script con los comandos de Google Cloud: `gcloud builds submit` (construye y publica imagen en Container Registry) y `gcloud run deploy` (despliega el servicio con `--allow-unauthenticated`, `--port 8080`, `--memory 256Mi`, `--min-instances 0`). El script lee `PROJECT_ID` de la config de gcloud o de una variable de entorno exportada. Al finalizar imprime la URL pública del servicio.
- [x] **DO-17** Crear `devops/cloudrun/README.md` — guía paso a paso para que Antonio pueda ejecutar el despliegue: prerrequisitos (gcloud CLI, Cloud Build API habilitada, facturación activa), configurar `PROJECT_ID`, ejecutar `./deploy.sh` y verificar la URL resultante. Incluir comandos de rollback y limpieza.

**Dependencias:** SEC-01 (variables de entorno auditadas antes de configurar CI); DO-09 antes de DO-10 antes de DO-11 antes de DO-12; DO-14 antes de DO-15 antes de DO-16 antes de DO-17

---

### Docs
> Carpeta: `projects/healthy/docs/`

- [x] **DOC-01** Generar documentación OpenAPI/Swagger de todos los endpoints del backend
- [x] **DOC-02** Escribir guía de despliegue paso a paso (local, staging, producción)
- [x] **DOC-03** Documentar arquitectura de la IA: cómo se construye el prompt, qué datos entran, qué JSON sale
- [x] **DOC-04** Actualizar documentación RGPD con los flujos reales implementados (consentimiento, exportación, borrado)
- [x] **DOC-05** Escribir README del proyecto con requisitos, instalación, variables de entorno y comandos principales
- [x] **DOC-06** Crear `docs/architecture-web.md`: diagrama de la arquitectura AWS completa — flujo usuario → Route 53 → CloudFront → S3 (landing) y Route 53 → ALB → ECS → API → RDS/Redis (backend). Incluir decisiones de red (VPC, subnets, security groups) y estimación de costes mensuales
- [x] **DOC-07** Crear `docs/landing-deploy.md`: guía para actualizar la landing — estructura de `landing/index.html`, tokens de diseño usados, cómo añadir secciones, proceso de despliegue manual (`aws s3 sync`) vs automático (CI en push a `main`), y cómo forzar invalidación de CloudFront
- [x] **DOC-08** Crear `docs/landing-content.md`: guía para el equipo de marketing — secciones de la landing (hero, stats, features, manifesto, download), copy editable, cómo cambiar imágenes de mockup y actualizar CTAs sin tocar CSS

**Dependencias:** BE-01..BE-09, AI-01..AI-07, SEC-04; DOC-06 depende de DO-09..DO-13 para reflejar infraestructura real

---

## Orden de ejecución

```
Fase 1 — Infraestructura (en paralelo)
  Database (DB-01..DB-06)
  Design   (DS-01..DS-10)   ← DS-01..DS-10 ya completados
  AI       (AI-01..AI-07)

Fase 2 — Backend (depende de Fase 1)
  Backend  (BE-01..BE-10)

Fase 3 — Frontend + Seguridad (en paralelo, dependen de Fase 2)
  Frontend  (FE-01..FE-14)
  Security  (SEC-01..SEC-08)

Fase 3b — Landing infra (independiente, puede correr en paralelo con Fase 3)
  DevOps    (DO-09..DO-13)  ← bucket S3, CloudFront, DNS, pipeline landing

Fase 4 — Tests (depende de Fase 2 y 3)
  Tests    (TS-01..TS-08)

Fase 5 — DevOps + Docs (en paralelo, dependen de Fase 3 y 4)
  DevOps   (DO-01..DO-08)
  Docs     (DOC-01..DOC-08)
```

---

## Decisiones de arquitectura

| Decisión | Razonamiento |
|----------|-------------|
| Supabase para Auth | Evita implementar OTP y gestión de sesiones desde cero; RGPD-compliant |
| Redis para caché de planes IA | Los planes generados por Claude son costosos; cachear 24 h reduce coste y latencia |
| Prompt caching en Claude API | El system prompt base es fijo; cache_control reduce tokens facturados ~80 % |
| Fallback sin IA | Si Claude falla, el usuario recibe un plan genérico calculado por reglas para no bloquear el onboarding |
| MMKV para persistencia local | Más rápido que AsyncStorage; necesario para modo offline básico |
| Zod para validación | Tipado compartido entre validación en runtime y TypeScript en compilación |
| S3 + CloudFront para landing | Sitio estático sin servidor: CDN global con baja latencia, SSL gratuito vía ACM, coste < $2/mes, invalidación instantánea en cada deploy |
| Landing en `landing/index.html` | Fichero único autocontenido (sin build step) — fácil de editar por diseño/marketing y de desplegar con `aws s3 sync` |

---

## Métricas de éxito

- [x] Cobertura de tests ≥ 80 % — 89.18 % (317/317 tests, verificado 2026-08-28)
- [~] Tiempo de respuesta API < 500 ms (p95) — DIFERIDO (decisión del usuario, 2026-07-14): load tests excluidos del gate v1.0.0; se medirán en producción tras go-live
- [ ] App publicada en TestFlight y Google Play Internal
- [x] Auditoría RGPD sin hallazgos críticos — verificado 2026-07-07: 0 CRÍTICOS, 0 ALTOS abiertos (VUL-2026-001/002/004 resueltos; VUL-006/007 aceptados documentados)
- [x] Pipeline CI/CD verde en rama `develop` — RAILWAY_ENVIRONMENT_ID configurado en deploy.yml; staging green (2026-07-07)
- [x] Modo oscuro funcional en todas las pantallas
- [ ] Landing publicada en producción con SSL, dominio propio y score Lighthouse ≥ 95
- [ ] Pipeline de despliegue de landing operativo (push a `main` → S3 → CloudFront invalidation < 60 s)

---

## PRs hacia v1.0.0

> Estas PRs son la hoja de ruta final para llevar Healthy a producción.
> El orquestador coordina; cada agente trabaja exclusivamente en su carpeta asignada.
> Fuente de análisis: `projects/healthy/PR_PLAN.md` (2026-06-15).

### Orden de ejecución

```
PR-1 (backend)   PR-2 (database)   PR-3 (docs)
     │                 │                │
     ▼                 ▼                │
PR-4 (backend)   PR-5 (devops)         │
     │                 │                │
     └────────┬─────────┘────────────────┘
              ▼
       PR-6 (orquestador — go-live)
```

PR-1, PR-2 y PR-3 no tienen dependencias entre sí y pueden abrirse en paralelo.
PR-4 depende de PR-1. PR-5 depende de PR-2. PR-6 bloquea hasta que las cinco anteriores estén mergeadas.

---

### PR-1 — `refactor: eliminar archivos duplicados`

**Agente responsable:** backend  
**Carpeta de trabajo:** `projects/healthy/backend/`  
**Riesgo:** MEDIO — los archivos camelCase contienen lógica más completa que los dot.notation activos; hay riesgo de pérdida de funcionalidad si no se migra antes de eliminar.

#### Tareas ordenadas

1. **CLEAN-06** Auditar `response.util.js` contra `response.js` y ampliar `response.util.js` con las 6 funciones faltantes: `sendCreated`, `sendNotFound`, `sendUnauthorized`, `sendForbidden`, `sendValidationError`, `sendServerError`. Sin este paso no se puede eliminar nada más.
2. **CLEAN-01** Comparar cada par camelCase / dot.notation en `controllers/`. Para cada endpoint que exista en el camelCase pero no en el dot.notation, migrar la lógica al dot.notation. Controladores a eliminar tras migración: `authController.js`, `logsController.js`, `nutritionController.js`, `onboardingController.js`, `planController.js`, `progressController.js`, `trainingController.js`.
3. **CLEAN-02** Eliminar middleware muerto: `middleware/auth.js`, `middleware/errorHandler.js`.
4. **CLEAN-03** Migrar `planRegenerateLimiter` (y `apiLimiter` si se usa en algún punto) a `rateLimiter.middleware.js`. Actualizar `plans.routes.js` para importar desde `rateLimiter.middleware`. Eliminar `middleware/rateLimiter.js`.
5. **CLEAN-05** Eliminar `services/emailService.js`, `utils/logger.js`, `utils/response.js`, `utils/prismaClient.js`.
6. Ejecutar `npm test` en `backend/` para verificar que ningún test rompe tras las eliminaciones.

#### Archivos a tocar

```
backend/src/utils/response.util.js              (MODIFICAR — ampliar con funciones faltantes)
backend/src/controllers/auth.controller.js      (MODIFICAR — incorporar handlers faltantes)
backend/src/controllers/logs.controller.js      (MODIFICAR si falta algún handler)
backend/src/controllers/nutrition.controller.js (MODIFICAR si falta algún handler)
backend/src/controllers/onboarding.controller.js (MODIFICAR si falta algún handler)
backend/src/controllers/plans.controller.js     (MODIFICAR si falta algún handler)
backend/src/controllers/progress.controller.js  (MODIFICAR si falta algún handler)
backend/src/controllers/training.controller.js  (MODIFICAR si falta algún handler)
backend/src/middleware/rateLimiter.middleware.js (MODIFICAR — añadir planRegenerateLimiter)
backend/src/routes/plans.routes.js              (MODIFICAR — actualizar import rateLimiter)
backend/src/controllers/authController.js       (ELIMINAR)
backend/src/controllers/logsController.js       (ELIMINAR)
backend/src/controllers/nutritionController.js  (ELIMINAR)
backend/src/controllers/onboardingController.js (ELIMINAR)
backend/src/controllers/planController.js       (ELIMINAR)
backend/src/controllers/progressController.js   (ELIMINAR)
backend/src/controllers/trainingController.js   (ELIMINAR)
backend/src/middleware/auth.js                  (ELIMINAR)
backend/src/middleware/errorHandler.js          (ELIMINAR)
backend/src/middleware/rateLimiter.js           (ELIMINAR)
backend/src/services/emailService.js            (ELIMINAR)
backend/src/utils/logger.js                     (ELIMINAR)
backend/src/utils/response.js                   (ELIMINAR)
backend/src/utils/prismaClient.js               (ELIMINAR)
```

> **Nota:** `middleware/validate.js` (Zod) se mantiene sin tocar hasta que PR-4 decida la estrategia de validación.

#### Criterios de aceptación (merge gate)

- [ ] `npm test` en `backend/` pasa al 100 % (ningún test roto)
- [ ] `GET /health` devuelve `200 {"success": true}`
- [ ] Flujo auth completo funciona: `register → verify-email → set-password → login → me → logout`
- [ ] No existe ningún `import` o `require` apuntando a los archivos eliminados (verificar con `grep -r "authController\|logsController\|emailService\|prismaClient" backend/src`)
- [ ] `response.util.js` exporta las 8 funciones (2 originales + 6 nuevas)

#### Dependencias

- Ninguna. Puede abrirse en paralelo con PR-2 y PR-3.
- PR-4 no puede empezar hasta que esta PR esté mergeada.

---

### PR-2 — `feat: migración Prisma pendiente`

**Agente responsable:** database  
**Carpeta de trabajo:** `projects/healthy/database/` y `projects/healthy/backend/prisma/`  
**Riesgo:** MEDIO — modifica el schema de base de datos; requiere PostgreSQL disponible y coordinación con staging.

#### Tareas ordenadas

1. **INFRA-01a** Verificar el estado actual de migraciones: ejecutar `npx prisma migrate status --schema ../database/schema.prisma` desde `backend/`. Comprobar si la migración `20260608184928_add_token_usage_logs_and_health_consent` está aplicada o solo existe en fichero.
2. **INFRA-01b** Si el schema en `backend/prisma/schema.prisma` aún no incluye `TokenUsageLog` y `health_consent_given_at`, añadirlos. Referencia: notas de BE-07 (`token_usage_logs`) y SEC-04 (`health_consent_given_at`).
3. **DB-01** Ejecutar `npx prisma migrate dev --schema ../database/schema.prisma --name add_token_usage_logs_and_health_consent` para generar y aplicar la migración en local. Commitear el directorio `prisma/migrations/` generado.
4. Documentar en `database/MIGRATION_LOG.md`: fecha de ejecución, nombre de la migración, campos añadidos, procedimiento de rollback (`prisma migrate reset` en local; en producción restaurar desde snapshot pre-deploy).
5. Actualizar `database/ERD.md` añadiendo la entidad `TokenUsageLog` al diagrama Mermaid y el campo `health_consent_given_at` en la entidad `User`.
6. Ejecutar `npx prisma validate` para confirmar que el schema es consistente.
7. Ejecutar `npx ts-node database/seed.ts` para verificar que el seed no rompe con el schema actualizado.

#### Archivos a tocar

```
backend/prisma/schema.prisma                                    (MODIFICAR si faltan campos)
backend/prisma/migrations/<timestamp>_add_token_usage_logs/     (CREAR — generado por Prisma)
database/MIGRATION_LOG.md                                       (MODIFICAR — documentar)
database/ERD.md                                                 (MODIFICAR — añadir TokenUsageLog)
```

#### Criterios de aceptación (merge gate)

- [ ] `npx prisma migrate status` muestra todas las migraciones como `Applied`
- [ ] `npx prisma validate` sin errores
- [ ] `npx ts-node database/seed.ts` ejecuta sin errores
- [ ] `database/MIGRATION_LOG.md` documenta la migración con procedimiento de rollback
- [ ] `database/ERD.md` actualizado con los nuevos campos

#### Dependencias

- Ninguna. Puede abrirse en paralelo con PR-1 y PR-3.
- PR-5 no puede empezar hasta que esta PR esté mergeada (la infra de producción necesita el schema final).

---

### PR-3 — `docs: documentación técnica completa`

**Agente responsable:** docs  
**Carpeta de trabajo:** `projects/healthy/docs/`  
**Riesgo:** BAJO — solo documentación, no modifica código ejecutable.

#### Tareas ordenadas

1. **DOC-05** `docs/README.md` (o README en raíz del proyecto): requisitos previos, instrucciones de instalación, variables de entorno necesarias, comandos principales (`npm run dev`, `npm test`, `npx prisma migrate dev`). Este es el punto de entrada para cualquier desarrollador nuevo.
2. **DOC-01** `docs/api-reference.md`: documentación de todos los endpoints agrupados por dominio (auth, onboarding, plans, training, nutrition, progress, logs, foods, user, health). Para cada endpoint: método, ruta, descripción, body/params, respuesta exitosa, errores posibles. Fuente: `backend/src/routes/`.
3. **DOC-03** `docs/ai-architecture.md`: cómo se construye el prompt en `ai/planGenerator.ts`, qué datos de onboarding entran (7 dimensiones + TMB/TDEE calculados), qué estructura JSON devuelve Claude (`GeneratedPlan`), cómo funciona el prompt caching (`cache_control: ephemeral`) y el fallback genérico.
4. **DOC-04** `docs/rgpd-compliance.md`: flujos reales implementados — consentimiento (`health_consent_given_at`), verificación de edad (16 años), exportación de datos (`GET /user/me/export`, Art. 20), borrado (`DELETE /user/me`, Art. 17). Referenciar `security/SECURITY_AUDIT.md`.
5. **DOC-02** `docs/deployment-guide.md`: guía paso a paso para los tres entornos. Local: prerequisitos, variables de entorno, migraciones, seed, arrancar backend y frontend. Staging: workflow `deploy-staging.yml`, secretos GitHub necesarios, URL de verificación. Producción: pasos adicionales, backup pre-deploy, tag `v*.*.*` para disparar `eas-submit.yml`.
6. **DOC-06** `docs/architecture-web.md`: diagrama ASCII o Mermaid de la arquitectura AWS completa — flujo usuario → Route 53 → CloudFront → S3 (landing) y Route 53 → ALB → ECS → API → RDS/Redis (backend). Decisiones de red (VPC, subnets, security groups) y estimación de costes mensuales. Fuente: `devops/infrastructure/staging.md`, `devops/ENV_VARS.md`.
7. **DOC-07** `docs/landing-deploy.md`: guía para actualizar la landing — estructura de `landing/index.html`, tokens de diseño usados, cómo añadir secciones, despliegue manual (`aws s3 sync`) vs automático (CI en push a `main`), y cómo forzar invalidación de CloudFront.
8. **DOC-08** `docs/landing-content.md`: guía para el equipo de marketing — secciones de la landing (hero, stats, features, manifesto, download), copy editable, cómo cambiar imágenes de mockup y actualizar CTAs sin tocar CSS.

#### Archivos a tocar

```
docs/README.md              (CREAR)
docs/api-reference.md       (CREAR)
docs/ai-architecture.md     (CREAR)
docs/rgpd-compliance.md     (CREAR)
docs/deployment-guide.md    (CREAR)
docs/architecture-web.md    (CREAR)
docs/landing-deploy.md      (CREAR)
docs/landing-content.md     (CREAR)
```

#### Criterios de aceptación (merge gate)

- [x] Los 8 documentos existen y no están vacíos
- [x] `docs/api-reference.md` cubre los 10 dominios de endpoints
- [x] `docs/deployment-guide.md` incluye los tres entornos (local, staging, producción)
- [x] `docs/rgpd-compliance.md` referencia los artículos 17 y 20 con los endpoints reales
- [x] `docs/architecture-web.md` incluye estimación de costes mensuales AWS
- [x] Ningún documento referencia archivos que no existen en el repo (links rotos)

#### Dependencias

- Ninguna. Puede abrirse en paralelo con PR-1 y PR-2.
- Depende conceptualmente de que BE-01..BE-09 y DO-09..DO-13 estén completos para reflejar la realidad — ambos ya están marcados como `[x]` en `tasks.md`.
- PR-6 no puede cerrarse hasta que esta PR esté mergeada.

---

### PR-4 — `refactor: unificar validación Zod/express-validator`

**Agente responsable:** backend  
**Carpeta de trabajo:** `projects/healthy/backend/`  
**Riesgo:** MEDIO — afecta a todas las rutas activas; un error en la validación rompe el flujo de auth.

#### Decisión de arquitectura

**Se adopta express-validator como estrategia única.** Razonamiento: ya está integrado en todas las rutas activas a través de `validate.middleware.js`. Migrar a Zod requeriría reescribir todas las rutas sin beneficio inmediato para v1.0.0. `validate.js` (con los schemas Zod) se elimina; si en el futuro se quiere Zod, se reintroduce desde cero con un diseño limpio.

#### Tareas ordenadas

1. Verificar que `validate.js` (Zod) no es importado desde ninguna ruta activa: `grep -r "validate.js\|from.*validate'" backend/src/routes/`.
2. Auditar `validate.middleware.js`: comprobar que el helper `validate` (express-validator) cubre todos los endpoints. Si hay rutas sin validación, añadir los schemas inline en la ruta correspondiente.
3. Asegurar que todos los endpoints devuelven errores de validación en formato uniforme: `{ success: false, error: 'VALIDATION_ERROR', details: [...] }`. Corregir los que no cumplan.
4. Eliminar `middleware/validate.js`.
5. Ejecutar suite completa de tests para confirmar que ningún test de auth o integración rompe.

#### Archivos a tocar

```
backend/src/middleware/validate.js            (ELIMINAR)
backend/src/middleware/validate.middleware.js (MODIFICAR — posibles ampliaciones de schemas)
backend/src/routes/auth.routes.js            (REVISAR — confirmar validaciones completas)
backend/src/routes/onboarding.routes.js      (REVISAR)
backend/src/routes/plans.routes.js           (REVISAR)
backend/src/routes/training.routes.js        (REVISAR)
backend/src/routes/nutrition.routes.js       (REVISAR)
backend/src/routes/progress.routes.js        (REVISAR)
backend/src/routes/logs.routes.js            (REVISAR)
```

#### Criterios de aceptación (merge gate)

- [ ] `middleware/validate.js` no existe en el repositorio
- [ ] `grep -r "validate.js" backend/src` devuelve 0 resultados
- [ ] Todos los tests de integración de auth pasan: `tests/integration/auth.test.js`
- [ ] Los errores de validación devuelven `400` con `error: 'VALIDATION_ERROR'` en todos los endpoints
- [ ] `npm test` en `backend/` pasa al 100 %

#### Dependencias

- **Requiere PR-1 mergeada** — los archivos camelCase eliminados en PR-1 también importaban `validate.js`; si PR-1 no está mergeada, al eliminar `validate.js` en PR-4 podría haber imports rotos en archivos que aún existen.
- PR-6 no puede cerrarse hasta que esta PR esté mergeada.

---

### PR-5 — `chore: pipeline CI/CD y vars producción`

**Agente responsable:** devops  
**Carpeta de trabajo:** `projects/healthy/devops/` y `.github/workflows/`  
**Riesgo:** ALTO — toca configuración de producción; un error aquí puede dejar staging/producción inaccesible.

#### Tareas ordenadas

1. Verificar que todos los secretos listados en `devops/GITHUB_SECRETS.md` están cargados en GitHub Actions para los entornos `staging` y `production`. Documentar en `devops/SECRETS_STATUS.md` cuáles están configurados y cuáles faltan.
2. Revisar `backend/.env.example` contra `devops/ENV_VARS.md`: confirmar que no hay variables documentadas que falten en el `.env.example`. Actualizar si hay discrepancias.
3. Hacer un dry-run completo del workflow `deploy-staging.yml`: job `test` (cobertura ≥ 80 %) → job `build` (imagen ECR) → job `deploy` (ECS) → job `smoke-test` (`GET /health` con retry). Documentar el resultado en `devops/PIPELINE_DRYRUN.md`.
4. Verificar que el workflow `eas-build.yml` compila la app móvil correctamente para el perfil `preview`. Registrar resultado.
5. Confirmar que `deploy-landing.yml` sincroniza `landing/` con S3 (`healthy-landing-prod`) y lanza invalidación CloudFront. Verificar que la landing carga en la URL de staging con SSL válido.
6. Ejecutar backup pre-go-live según `devops/BACKUP_STRATEGY.md` (snapshot RDS manual). Documentar el ARN del snapshot en `devops/PIPELINE_DRYRUN.md`.
7. Si se detectan ajustes necesarios en los workflows (variables hardcodeadas, nombres de secrets incorrectos, etc.), corregirlos y commitear.

#### Archivos a tocar

```
devops/SECRETS_STATUS.md                            (CREAR — estado de cada secret)
devops/PIPELINE_DRYRUN.md                           (CREAR — resultados del dry-run)
.github/workflows/deploy-staging.yml               (MODIFICAR si hay ajustes necesarios)
.github/workflows/deploy-landing.yml               (MODIFICAR si hay ajustes necesarios)
.github/workflows/eas-build.yml                    (MODIFICAR si hay ajustes necesarios)
backend/.env.example                                (MODIFICAR si hay variables faltantes)
devops/ENV_VARS.md                                  (MODIFICAR si hay variables faltantes)
```

#### Criterios de aceptación (merge gate)

- [ ] Pipeline staging verde de extremo a extremo (test → build → deploy → smoke-test)
- [ ] `GET https://<staging-url>/health` devuelve `{"success": true}`
- [ ] Landing carga en URL de staging con SSL válido y sin errores de consola
- [ ] Backup de base de datos (snapshot RDS) confirmado y ARN documentado
- [ ] `devops/SECRETS_STATUS.md` confirma que todos los secrets están configurados
- [ ] `eas-build.yml` compila sin errores para el perfil `preview`

#### Dependencias

- **Requiere PR-2 mergeada** — el schema de base de datos debe estar en su estado final antes de configurar el entorno de producción; de lo contrario, el ECS apuntaría a un schema desactualizado.
- PR-6 no puede cerrarse hasta que esta PR esté mergeada.

---

### PR-6 — `chore: verificación final go-live v1.0.0`

**Agente responsable:** orquestador  
**Carpeta de trabajo:** `projects/healthy/` (nivel raíz del proyecto)  
**Riesgo:** ALTO — es la última barrera antes del go-live. No mergear si algún criterio no se cumple.

#### Condición de entrada

Esta PR solo puede abrirse cuando PR-1, PR-2, PR-3, PR-4 y PR-5 estén todas mergeadas en `main`.

#### Tareas ordenadas

1. **METRICS-01a** Ejecutar la suite completa de tests con cobertura: `npm test --coverage` desde `backend/`. Verificar cobertura ≥ 80 %. Si no se alcanza, bloquear el go-live y reportar al agente tests.
2. **METRICS-01b** Ejecutar tests de carga: `node tests/load/planGeneration.js`. Verificar p95 < 500 ms. Documentar resultado en `docs/LOAD_TEST_FINAL.md`.
3. **METRICS-01c** Ejecutar auditoría Lighthouse en la landing de staging. Verificar score ≥ 95 en Performance, Accessibility, Best Practices, SEO. Documentar en `docs/LIGHTHOUSE_FINAL.md`.
4. Revisar `security/SECURITY_AUDIT.md` y `security/VULNERABILITIES.md`. Confirmar que no hay hallazgos con severidad `CRITICAL` o `HIGH` abiertos. Si los hay, bloquear el go-live y reportar al agente security.
5. Confirmar que la migración Prisma del PR-2 está aplicada en el entorno de producción (no solo en staging): `npx prisma migrate status` contra la base de datos de producción.
6. Confirmar que la app está disponible en TestFlight (iOS) y en Google Play Internal Testing (Android) mediante el workflow `eas-submit.yml` disparado por el tag `v1.0.0`.
7. Actualizar `tasks.md`: marcar todas las métricas de éxito como `[x]`.
8. Actualizar `ORCHESTRATOR_STATUS.log` cerrando el proyecto con reporte final: fecha, versión, métricas alcanzadas, issues pendientes para v1.1.0.
9. Crear tag `v1.0.0` en el repositorio y verificar que `eas-submit.yml` se dispara correctamente.

#### Archivos a tocar

```
tasks.md                        (MODIFICAR — marcar métricas de éxito como [x])
ORCHESTRATOR_STATUS.log         (MODIFICAR — reporte final de cierre)
docs/LOAD_TEST_FINAL.md         (CREAR — resultados de tests de carga finales)
docs/LIGHTHOUSE_FINAL.md        (CREAR — resultados Lighthouse finales)
```

#### Criterios de aceptación (merge gate — todos obligatorios)

- [ ] Cobertura de tests ≥ 80 % (evidencia: salida de `npm test --coverage`)
- [ ] API p95 < 500 ms bajo carga (evidencia: `docs/LOAD_TEST_FINAL.md`)
- [ ] Landing Lighthouse ≥ 95 en los 4 indicadores (evidencia: `docs/LIGHTHOUSE_FINAL.md`)
- [ ] Sin hallazgos de seguridad `CRITICAL` o `HIGH` abiertos en `security/SECURITY_AUDIT.md`
- [ ] Migración Prisma aplicada en producción (`prisma migrate status` muestra `Applied`)
- [ ] App disponible en TestFlight (iOS)
- [ ] App disponible en Google Play Internal Testing (Android)
- [ ] Tag `v1.0.0` creado y visible en el repositorio
- [ ] `tasks.md` con todas las métricas de éxito marcadas `[x]`

#### Dependencias

- **Requiere PR-1, PR-2, PR-3, PR-4 y PR-5 mergeadas** — sin excepción.

---

### Resumen de PRs

| PR | Título | Agente | Riesgo | Depende de |
|---|---|---|---|---|
| **PR-1** | `refactor: eliminar archivos duplicados` | backend | MEDIO | — |
| **PR-2** | `feat: migración Prisma pendiente` | database | MEDIO | — |
| **PR-3** | `docs: documentación técnica completa` | docs | BAJO | — |
| **PR-4** | `refactor: unificar validación Zod/express-validator` | backend | MEDIO | PR-1 |
| **PR-5** | `chore: pipeline CI/CD y vars producción` | devops | ALTO | PR-2 |
| **PR-6** | `chore: verificación final go-live v1.0.0` | orquestador | ALTO | PR-1, PR-2, PR-3, PR-4, PR-5 |

> **Decisiones de orquestador documentadas:**
> - PR-4 adopta express-validator como estrategia única de validación (Zod queda descartado para v1.0.0).
> - `middleware/validate.js` (Zod) se elimina en PR-4 y no en PR-1 para mantener las PRs atómicas y reducir el riesgo de PR-1.
> - PR-6 la ejecuta el orquestador (no un agente especializado) porque implica verificación cruzada de todos los dominios y la decisión final de go-live.

---

## Fase 6 — Deploy & Go-live

> Generada por el orquestador el 2026-07-04.
> Esta fase recoge las tareas operativas necesarias para completar el primer deploy a Railway staging y alcanzar el go-live v1.0.0.
> Las tareas 6 y 7 son BLOQUEANTES: nada más puede avanzar hasta que estén resueltas.

---

### Orden de ejecución

> Estado actualizado a 2026-07-07: TAREA-6, TAREA-7, TAREA-2 y TAREA-4 completadas. Staging verde.

```
[x] TAREA-6 (devops — vars Railway)   [x] TAREA-7 (devops — verificar URL)
           │                                       │
           └───────────────┬───────────────────────┘
                           ▼
              [x] TAREA-2 (orquestador — CI verde confirmado)
                           │
          ┌────────────────┼────────────────────────┐
          ▼                ▼                         ▼
[x] TAREA-4          TAREA-5                   TAREA-Redis
(commit bat)    (limpiar ECR check)        (corregir Redis URL)
   COMPLETADA    acción manual usuario      acción manual usuario
                          │                         │
                          └────────────┬────────────┘
                                       ▼
                              TAREA-8 (devops — EAS builds móviles)
                              [ya desbloqueada — backend staging verde]
                                       │
                                       ▼
                         TAREA-9 (orquestador — gate go-live v1.0.0)
```

TAREA-5 y TAREA-Redis son acciones manuales del usuario en GitHub y Railway respectivamente; pueden ejecutarse en paralelo de forma inmediata.
TAREA-8 ya está desbloqueada (TAREA-2 verde) y puede lanzarse ahora.
TAREA-9 es el gate final: requiere TAREA-5, TAREA-Redis y TAREA-8 completadas.

---

### TAREA-2 — Verificar deploy en GitHub Actions

**Agente responsable:** orquestador (verificación; agente devops si se detecta fallo)
**Prioridad:** INMEDIATA
**Bloqueada por:** TAREA-6, TAREA-7 (el smoke test fallará si las vars no están o la URL es incorrecta)

#### Pasos

1. Abrir GitHub Actions → workflow "Deploy → Staging" → ejecución del commit `fa2bd8d`.
2. Si el job `smoke-test` falló, identificar la causa exacta (vars Railway faltantes → TAREA-6; URL incorrecta → TAREA-7; error de código → agente backend).
3. Una vez TAREA-6 y TAREA-7 resueltas, re-lanzar el workflow manualmente (`workflow_dispatch`) y confirmar que pasa verde de extremo a extremo.
4. Documentar el resultado (URL del run, jobs, duración) en `devops/PIPELINE_STATUS.md`.

#### Criterios de aceptación

- [ ] Workflow "Deploy → Staging" verde (todos los jobs: test → build → deploy → smoke-test)
- [ ] `GET https://<url-real>/health` devuelve `200 {"success": true}` desde el job smoke-test
- [ ] Resultado documentado en `devops/PIPELINE_STATUS.md`

#### Dependencias

- **BLOQUEANTE entrada:** TAREA-6 (vars Railway) y TAREA-7 (URL correcta) deben estar resueltas primero
- Desbloquea: TAREA-4, TAREA-5, TAREA-8

---

### TAREA-4 — Commit `git-push.bat`

**Agente responsable:** orquestador
**Prioridad:** MENOR — no bloqueante
**Bloqueada por:** ninguna (puede ejecutarse en cualquier momento)

#### Pasos

1. Revisar el diff de `git-push.bat` para confirmar que no contiene credenciales ni tokens.
2. Ejecutar desde la raíz del repo:
   ```
   git add git-push.bat
   git commit -m "chore: update git-push helper"
   git push origin develop
   ```

#### Criterios de aceptación

- [ ] Commit `chore: update git-push helper` visible en `origin/develop`
- [ ] `git status` muestra working tree clean para `git-push.bat`
- [ ] El archivo no contiene credenciales ni tokens hardcodeados

#### Dependencias

- Ninguna como entrada
- No bloquea ninguna otra tarea

---

### TAREA-5 — Eliminar check obsoleto ECR de branch protection

**Agente responsable:** orquestador
**Prioridad:** LIMPIEZA CI — no bloqueante para el deploy, pero genera ruido en PRs
**Bloqueada por:** ninguna

#### Pasos

1. Ir a GitHub → repositorio → Settings → Branches → branch protection rules → regla de `main`.
2. En la sección "Require status checks to pass before merging", localizar el check `Deploy/Build+Push ECR`.
3. Eliminar ese check de la lista de requeridos (fue parte del pipeline AWS ECR/ECS, ya migrado a Railway).
4. Guardar los cambios.
5. Verificar que las PRs futuras ya no quedan bloqueadas por ese check inexistente.

#### Criterios de aceptación

- [ ] El check `Deploy/Build+Push ECR` no aparece en la branch protection rule de `main`
- [ ] La branch protection rule de `main` solo lista checks que existen en los workflows actuales
- [ ] Una PR de prueba (o la siguiente PR real) no queda bloqueada por el check eliminado

#### Dependencias

- Ninguna como entrada
- No bloquea ninguna otra tarea

---

### TAREA-6 — Añadir variables de entorno en Railway

**Agente responsable:** devops
**Carpeta de trabajo:** `projects/healthy/devops/`
**Prioridad:** CRITICA — BLOQUEANTE para el deploy
**Bloqueada por:** ninguna (acción manual en Railway dashboard)

#### Variables a configurar

En el proyecto `healthy-staging`, servicio backend (ID `fa137c98-5210-4057-a531-f1c7fbf39743`), añadir las siguientes variables de entorno en el dashboard Railway:

| Variable | Descripción | Dónde obtener el valor |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | Dashboard Supabase → Settings → API |
| `SUPABASE_KEY` | Anon/service key de Supabase | Dashboard Supabase → Settings → API |
| `SMTP_HOST` | Host del servidor SMTP | Proveedor de email (ej. smtp.sendgrid.net) |
| `SMTP_PORT` | Puerto SMTP (ej. 587) | Proveedor de email |
| `SMTP_USER` | Usuario SMTP | Proveedor de email |
| `SMTP_PASS` | Contraseña SMTP | Proveedor de email |

> Referencia de todas las variables necesarias: `projects/healthy/devops/ENV_VARS.md`

#### Pasos

1. Acceder a Railway dashboard → proyecto `healthy-staging` → servicio backend.
2. Ir a la pestaña "Variables".
3. Añadir cada variable de la tabla anterior con su valor real.
4. Redeploy automático (Railway lo hace al guardar variables) — verificar que el servicio arranca sin errores.
5. Documentar en `devops/RAILWAY_VARS_STATUS.md` qué variables están configuradas (sin valores — solo nombres).

#### Criterios de aceptación

- [ ] Las 6 variables (`SUPABASE_URL`, `SUPABASE_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) están configuradas en Railway staging
- [ ] El servicio Railway arranca sin crashloop (logs sin `Missing env var` o errores de conexión Supabase/SMTP)
- [ ] `GET <url-staging>/health` devuelve `200` con `"db": "ok"` y `"redis": "ok"` (si Redis está configurado)
- [ ] `devops/RAILWAY_VARS_STATUS.md` documenta el estado de configuración

#### Dependencias

- Ninguna como entrada
- **Desbloquea:** TAREA-2, TAREA-7 (el smoke test de TAREA-2 depende del backend funcionando)

---

### TAREA-7 — Verificar URL real del servicio Railway

**Agente responsable:** devops
**Carpeta de trabajo:** `projects/healthy/devops/` y `.github/workflows/`
**Prioridad:** CRITICA — BLOQUEANTE para el smoke test
**Bloqueada por:** ninguna (verificación manual en Railway dashboard)

#### Pasos

1. Acceder a Railway dashboard → proyecto `healthy-staging` → servicio backend → pestaña "Settings" o "Deployments".
2. Copiar la URL pública asignada al servicio (dominio `.up.railway.app`).
3. Comparar con la URL hardcodeada en los workflows: `https://backend-staging-01ee.up.railway.app/health`.
4. **Si la URL es diferente:** actualizar la variable `STAGING_URL` (o la URL hardcodeada) en todos los archivos de workflow que la referencien:
   - `.github/workflows/deploy-staging.yml`
   - Cualquier otro workflow que referencie la URL de staging
5. Commitear los cambios con `fix(ci): actualizar URL staging Railway`.
6. Documentar la URL real en `devops/RAILWAY_VARS_STATUS.md`.

#### Criterios de aceptación

- [ ] URL real del servicio Railway confirmada y documentada en `devops/RAILWAY_VARS_STATUS.md`
- [ ] `curl <url-real>/health` devuelve `200` desde fuera de Railway (verificación pública)
- [ ] Si la URL difería: workflows actualizados y commiteados en `develop`
- [ ] El job `smoke-test` del workflow "Deploy → Staging" apunta a la URL correcta

#### Dependencias

- Ninguna como entrada (verificación manual)
- **Desbloquea:** TAREA-2 (el smoke test usa esta URL)

---

### TAREA-Redis — Corregir Redis en Railway staging

**Agente responsable:** devops (acción manual del usuario en Railway dashboard)
**Carpeta de trabajo:** `projects/healthy/devops/`
**Prioridad:** ALTA — necesario antes del go-live (Redis es requerido para caché de planes IA y sesiones JWT)
**Bloqueada por:** TAREA-6 completada (prerequisito: vars Railway configuradas)

#### Contexto

El healthcheck `GET /health` devuelve `200 {"success":true,"db":"connected"}` pero el campo `redis` responde `"error"`. Esto se debe a que la variable `REDIS_URL` en Railway fue configurada con el valor de referencia `${{Redis.REDIS_URL}}` pero dicha referencia no resuelve (comportamiento idéntico al que ocurrió con `DATABASE_URL` antes de ser corregida).

Redis fue marcado como no-bloqueante en el healthcheck para no bloquear el deploy, pero es **necesario antes del go-live** porque:
- El caché de planes IA generados por Claude depende de Redis (BE-09)
- Las sesiones JWT (blacklist de tokens invalidados) se almacenan en Redis (BE-09, SEC-05)
- La búsqueda de alimentos se cachea 6 h en Redis (BE-09)

#### Pasos

1. Ir a Railway dashboard → proyecto `healthy-staging` → servicio **Redis** (no el backend).
2. En la pestaña "Connect", copiar la URL de conexión real (formato `redis://default:<password>@<host>:<port>`).
3. Ir al servicio **backend** → pestaña "Variables".
4. Editar la variable `REDIS_URL`: reemplazar `${{Redis.REDIS_URL}}` por la URL copiada en el paso 2.
5. Railway ejecutará un redeploy automático al guardar.
6. Verificar: `GET https://backend-staging-01ee.up.railway.app/health` debe responder con `"redis":"connected"` (o equivalente OK).
7. Documentar el resultado en `devops/RAILWAY_VARS_STATUS.md`.

#### Criterios de aceptación

- [ ] `GET https://backend-staging-01ee.up.railway.app/health` devuelve `"redis":"connected"` (o `"ok"`)
- [ ] El servicio backend arranca sin errores de Redis en los logs de Railway
- [ ] `devops/RAILWAY_VARS_STATUS.md` actualizado con el estado de `REDIS_URL`

#### Dependencias

- **Requiere:** TAREA-6 completada (las vars base de Railway deben estar configuradas primero)
- **Desbloquea:** TAREA-9 (criterio de sin vulnerabilidades y funcionalidad completa)

---

### TAREA-8 — EAS Expo (builds móviles)

**Agente responsable:** devops
**Carpeta de trabajo:** `projects/healthy/devops/` y `projects/healthy/frontend/`
**Prioridad:** ALTA — necesaria para go-live pero no bloquea el backend
**Bloqueada por:** TAREA-2 (backend debe estar verde en staging antes de conectar la app móvil a staging)

#### Pasos

1. Ejecutar `eas login` con las credenciales del proyecto Expo (cuenta Expo asociada al proyecto Healthy).
2. Ejecutar `eas credentials` para configurar:
   - iOS: provisioning profile + distribution certificate (requiere Apple Developer account)
   - Android: keystore (generado automáticamente por EAS si no existe)
3. Primer build para perfil `preview` en ambas plataformas:
   ```
   eas build --profile preview --platform all
   ```
4. Esperar a que ambos builds completen en `expo.dev`. Documentar los IDs de build.
5. Instalar la build de preview en un dispositivo real (o simulador) y verificar que la app arranca y se conecta a la URL de staging.
6. Actualizar `devops/EAS_BUILD.md` con el resultado del primer build y los IDs de artefacto.
7. Verificar que el workflow `devops/.github/workflows/eas-build.yml` puede dispararse automáticamente en el siguiente push a `develop`.

#### Criterios de aceptación

- [ ] `eas build --profile preview --platform all` completa sin errores (evidencia: IDs de build en expo.dev)
- [ ] Build iOS instalable en TestFlight interno o dispositivo via AirDrop/URL directa
- [ ] Build Android instalable como APK en dispositivo real o emulador
- [ ] La app de preview se conecta al backend de staging y el flujo de login funciona
- [ ] `devops/EAS_BUILD.md` actualizado con resultado y IDs de artefacto
- [ ] Workflow `eas-build.yml` configurado y validado

#### Dependencias

- **Requiere:** TAREA-2 verde (backend staging accesible)
- **Desbloquea:** TAREA-9 (criterio de TestFlight y Google Play Internal)

---

### TAREA-9 — Gate go-live v1.0.0

**Agente responsable:** orquestador
**Prioridad:** FINAL — ejecutar solo cuando todas las tareas anteriores estén completas
**Bloqueada por:** TAREA-2, TAREA-4, TAREA-5, TAREA-7, TAREA-Redis, TAREA-8

#### Condición de entrada

Esta tarea solo se ejecuta cuando TAREA-2, TAREA-4, TAREA-5, TAREA-7 y TAREA-8 están todas completadas y sus criterios de aceptación satisfechos.

#### Criterios gate (todos obligatorios)

| Criterio | Comando de verificación | Umbral |
|---|---|---|
| Cobertura de tests | `cd projects/healthy/backend && npx jest --coverage` | ≥ 80 % |
| Rendimiento API | `node projects/healthy/tests/load/planGeneration.js` | p95 < 500 ms |
| Lighthouse landing | Auditoría Lighthouse en URL de staging | ≥ 95 en Performance, Accessibility, Best Practices, SEO |
| App iOS | Build disponible en TestFlight (internal testing) | Confirmado en App Store Connect |
| App Android | Build disponible en Google Play Internal Testing | Confirmado en Google Play Console |
| Sin vulnerabilidades críticas | Revisar `security/SECURITY_AUDIT.md` + `security/VULNERABILITIES.md` | 0 hallazgos CRITICAL o HIGH abiertos |

#### Pasos si todos los criterios se superan

1. Documentar resultados en:
   - `docs/LOAD_TEST_FINAL.md` (resultado del load test con p95 medido)
   - `docs/LIGHTHOUSE_FINAL.md` (captura/reporte del score Lighthouse)
2. Actualizar `projects/healthy/tasks.md`: marcar todas las métricas de éxito como `[x]`.
3. Actualizar `ORCHESTRATOR_STATUS.log`: reporte final de cierre con fecha, versión, métricas alcanzadas e issues para v1.1.0.
4. Crear el tag de release:
   ```
   git tag v1.0.0
   git push origin v1.0.0
   ```
5. Verificar que el workflow `eas-submit.yml` se dispara automáticamente con el tag `v1.0.0` y envía las apps a App Store y Google Play.

#### Si algún criterio falla

| Criterio que falla | Agente al que reportar | Acción |
|---|---|---|
| Cobertura < 80 % | tests | Añadir tests hasta alcanzar umbral; re-ejecutar gate |
| p95 ≥ 500 ms | backend + devops | Optimizar endpoint más lento; re-ejecutar load test |
| Lighthouse < 95 | frontend + design | Corregir issues de performance/a11y; re-auditar |
| Vulnerabilidad CRITICAL/HIGH abierta | security | Parchear y cerrar hallazgo; re-auditar |
| Build EAS falla | devops | Resolver errores de credenciales/configuración; re-build |

#### Criterios de aceptación (del gate)

- [ ] Cobertura de tests ≥ 80 % (evidencia en `docs/LOAD_TEST_FINAL.md`)
- [ ] API p95 < 500 ms (evidencia en `docs/LOAD_TEST_FINAL.md`)
- [ ] Landing Lighthouse ≥ 95 en los 4 indicadores (evidencia en `docs/LIGHTHOUSE_FINAL.md`)
- [ ] App disponible en TestFlight (iOS)
- [ ] App disponible en Google Play Internal Testing (Android)
- [ ] Sin hallazgos CRITICAL o HIGH abiertos en security
- [ ] Tag `v1.0.0` creado y visible en el repositorio
- [ ] Workflow `eas-submit.yml` disparado y completado correctamente
- [ ] `tasks.md` con todas las métricas de éxito marcadas `[x]`
- [ ] `ORCHESTRATOR_STATUS.log` cerrado con reporte final

#### Dependencias

- **Requiere:** TAREA-2, TAREA-4, TAREA-5, TAREA-7, TAREA-Redis, TAREA-8 completadas
- Esta es la última tarea del proyecto v1.0.0

---

### Resumen Fase 6

| Tarea | Título | Agente | Prioridad | Depende de | Estado |
|---|---|---|---|---|---|
| **TAREA-6** | Añadir vars Railway staging | devops | CRITICA — BLOQUEANTE | — | [x] Completada 2026-07-07 |
| **TAREA-7** | Verificar URL real Railway | devops | CRITICA — BLOQUEANTE | — | [x] Completada 2026-07-07 |
| **TAREA-2** | Verificar CI verde en GitHub Actions | orquestador / devops | INMEDIATA | TAREA-6, TAREA-7 | [x] Completada 2026-07-07 |
| **TAREA-4** | Commit git-push.bat | orquestador | MENOR | — | [x] Completada 2026-07-07 |
| **TAREA-5** | Eliminar check ECR de branch protection | orquestador | LIMPIEZA | — | [x] Completada 2026-07-07 — no había reglas configuradas |
| **TAREA-Redis** | Corregir Redis en Railway staging | devops | ALTA | TAREA-6 | [ ] Pendiente — acción manual usuario |
| **TAREA-8** | EAS builds móviles (preview) | devops | ALTA | TAREA-2 | [ ] Pendiente |
| **TAREA-9** | Gate go-live v1.0.0 | orquestador | FINAL | TAREA-2, TAREA-4, TAREA-5, TAREA-Redis, TAREA-8 | [ ] Bloqueada |

> **Decisión de orquestador:** TAREA-6, TAREA-7, TAREA-2 y TAREA-4 están completadas. El deploy staging está verde. TAREA-5 y TAREA-Redis son acciones manuales del usuario en GitHub y Railway respectivamente, y pueden ejecutarse en paralelo. TAREA-8 ya está desbloqueada (backend staging verde). TAREA-9 es el gate final, bloqueada hasta que TAREA-5, TAREA-Redis y TAREA-8 estén completas.

---

## Fase 7 — Documentación de arquitectura e infraestructura

> Solicitada el 2026-07-05. La documentación existe pero está desactualizada respecto a la infraestructura real.

### DOC-ARCH-01 — Actualizar `architecture-web.md`

**Agente responsable:** docs
**Carpeta de trabajo:** `projects/healthy/docs/`
**Prioridad:** ALTA — necesario antes del go-live

#### Cambios pendientes en el documento actual

| Sección | Problema | Fix |
|---|---|---|
| Diagrama Mermaid | Menciona "Railpack builder" | Actualizar a Dockerfile multi-stage |
| Componentes | Service ID del backend (`ec2720da-...`) puede ser incorrecto | Verificar con Railway dashboard |
| CI/CD | No refleja que `railway up` corre desde repo root (monorepo) | Actualizar descripción del paso deploy |
| SMTP | Marcado como "Gmail SMTP configurado" | Indicar que SMTP está pendiente de configurar en staging |
| Secrets table | Menciona `SUPABASE_ANON_KEY` | Corregir a `SUPABASE_KEY` (nombre real que usa el backend) |
| Sin sección | No documenta la estructura del monorepo | Añadir sección "Estructura del repositorio" |

#### Contenido a añadir

1. **Sección: Estructura del repositorio (monorepo)**
   ```
   ai-studio/
   ├── .github/workflows/       → CI/CD principal (deploy.yml, ci.yml, tests.yml)
   ├── agents/                  → Definiciones de agentes reutilizables
   ├── projects/healthy/
   │   ├── backend/             → API Node.js (raíz del servicio Railway)
   │   ├── frontend/            → App React Native + Expo
   │   ├── database/            → Schema Prisma, migraciones, seed
   │   ├── devops/              → Workflows adicionales, docs infra, EAS
   │   ├── docs/                → Documentación técnica
   │   ├── landing/             → Landing estática (S3 + CloudFront)
   │   ├── security/            → Auditoría RGPD y seguridad
   │   └── tests/               → Tests de carga y E2E
   └── projects/healthy/backend/.github/workflows/  → Workflows del servicio backend
   ```

2. **Sección: Modelo de contenedor Docker**
   - Dockerfile multi-stage (builder + runner)
   - Etapa builder: `npm ci` (all deps) + `prisma generate` (genera cliente JS)
   - Etapa runner: `npm ci --omit=dev` + copia cliente generado
   - Prisma 7: driver adapter `@prisma/adapter-pg` para conexión a PostgreSQL
   - `prisma migrate deploy` al arrancar el contenedor

3. **Sección: Configuración Prisma 7**
   - `prisma.config.ts` provee DATABASE_URL para migraciones
   - `PrismaClient` usa `PrismaPg(Pool)` como adapter (Prisma 7 ya no acepta URL en schema)
   - Schema: `provider = "prisma-client-js"`, sin `url` en datasource

#### Criterios de aceptación

- [ ] Diagrama Mermaid actualizado (Dockerfile, no Railpack)
- [ ] Sección de estructura del monorepo añadida
- [ ] Sección de modelo Docker añadida
- [ ] Sección de Prisma 7 añadida
- [ ] Nombres de variables corregidos (SUPABASE_KEY, etc.)
- [ ] Estado SMTP reflejado correctamente (pendiente en staging)

---

### DOC-ARCH-02 — Actualizar `deployment-guide.md`

**Agente responsable:** docs
**Carpeta de trabajo:** `projects/healthy/docs/`
**Prioridad:** MEDIA

#### Cambios pendientes

1. **Sección staging**: el paso de deploy ya no es `railway up` desde `backend/`, sino desde la raíz del repo
2. **Prisma en local**: `prisma migrate dev` necesita `prisma.config.ts` (Prisma 7) — actualizar instrucciones
3. **Variables**: confirmar que la lista de variables es correcta y completa (incluyendo `SUPABASE_SERVICE_ROLE_KEY`)
4. **Docker local**: añadir instrucciones para levantar el backend con Docker Compose localmente

#### Criterios de aceptación

- [ ] Instrucciones de deploy staging actualizadas (railway up desde repo root)
- [ ] Instrucciones Prisma 7 actualizadas (prisma.config.ts, adapter)
- [ ] Lista de variables completa y correcta
- [ ] Sección Docker local añadida (opcional pero recomendada)

---

### Resumen Fase 7

| Tarea | Título | Agente | Prioridad | Depende de |
|---|---|---|---|---|
| **DOC-ARCH-01** | Actualizar architecture-web.md | docs | ALTA | TAREA-2 verde (para reflejar estado real) |
| **DOC-ARCH-02** | Actualizar deployment-guide.md | docs | MEDIA | DOC-ARCH-01 |

> **Decisión de orquestador:** Ejecutar Fase 7 después de confirmar el primer deploy verde (TAREA-2). La documentación debe reflejar la infraestructura real y funcionando, no la planificada.

---

## Plan de distribución — Estado a 2026-07-07

> Generado por el orquestador. Staging VERDE. Backend responde en `https://backend-staging-01ee.up.railway.app/health`.

### Estado de tareas Fase 6

| Tarea | Estado | Fecha |
|---|---|---|
| TAREA-6 (vars Railway) | [x] COMPLETADA | 2026-07-07 |
| TAREA-7 (URL Railway) | [x] COMPLETADA | 2026-07-07 |
| TAREA-2 (CI verde) | [x] COMPLETADA | 2026-07-07 |
| TAREA-4 (commit bat) | [x] COMPLETADA | 2026-07-07 |
| TAREA-5 (limpiar ECR) | [x] COMPLETADA | 2026-07-07 — no había reglas configuradas |
| TAREA-Redis (corregir Redis URL) | [x] COMPLETADA | 2026-07-07 — URL directa configurada |
| DOC-ARCH-01 (architecture-web.md) | [x] COMPLETADA | 2026-07-07 |
| DOC-ARCH-02 (deployment-guide.md) | [x] COMPLETADA | 2026-07-07 |
| Tests ≥80% cobertura | [x] COMPLETADA | 2026-07-08 — 253/253 tests, 88.21% |
| TAREA-8 (EAS builds) | [ ] PENDIENTE | desbloqueada |
| TAREA-9 (gate go-live) | [ ] BLOQUEADA | espera TAREA-8 |

---

### Ejecución inmediata (en paralelo)

#### Bloque A — Acciones manuales del usuario (pueden hacerse ya, en paralelo)

**TAREA-5** — Acción del usuario en GitHub
- Dónde: GitHub → Settings → Branches → regla de `main`
- Qué: eliminar el check `Deploy/Build+Push ECR` de los required status checks
- Tiempo estimado: 2 minutos
- Sin dependencias, sin riesgo

**TAREA-Redis** — Acción del usuario en Railway
- Dónde: Railway dashboard → proyecto `healthy-staging` → servicio Redis → Connect → copiar URL real → servicio backend → Variables → editar `REDIS_URL`
- Qué: reemplazar `${{Redis.REDIS_URL}}` por la URL real de conexión Redis
- Verificación: `GET /health` debe responder `"redis":"connected"`
- Tiempo estimado: 5 minutos
- Requiere: tener el dashboard de Railway abierto

#### Bloque B — Agente devops (puede ejecutarse ya, en paralelo con Bloque A)

**TAREA-8** — EAS Expo builds móviles
- Agente: devops
- Carpeta: `projects/healthy/devops/` y `projects/healthy/frontend/`
- Ya desbloqueada: backend staging está verde
- Pasos: `eas login` → `eas credentials` → `eas build --profile preview --platform all`
- Documentación de referencia: `devops/EAS_BUILD.md` y `devops/EAS_SUBMIT.md`
- Requiere: cuenta Expo activa, credenciales Apple Developer (iOS), keystore Android (EAS lo genera si no existe)

#### Bloque C — Agente docs (puede ejecutarse ya, en paralelo con todo lo anterior)

**DOC-ARCH-01** — Actualizar `docs/architecture-web.md`
- Agente: docs
- Carpeta: `projects/healthy/docs/`
- Sin dependencias técnicas (la documentación refleja la arquitectura que ya existe)
- Cambios detallados en Fase 7 de este archivo

**DOC-ARCH-02** — Actualizar `docs/deployment-guide.md`
- Agente: docs
- Carpeta: `projects/healthy/docs/`
- Requiere: DOC-ARCH-01 completada primero

---

### Ejecución diferida (bloqueada)

**TAREA-9** — Gate go-live v1.0.0
- Agente: orquestador
- Bloqueada por: TAREA-5, TAREA-Redis y TAREA-8
- Solo ejecutar cuando los tres bloques anteriores estén completados y verificados
- Criterios gate: cobertura ≥80%, p95 <500ms, Lighthouse ≥95, TestFlight, Google Play, 0 vulnerabilidades críticas

---

### Árbol de dependencias actualizado

```
[x] TAREA-2 (staging verde)
        │
        ├──── TAREA-5 (usuario — GitHub)          ──── sin bloqueos descendientes
        │
        ├──── TAREA-Redis (usuario — Railway)     ──── necesario para TAREA-9
        │
        ├──── TAREA-8 (devops — EAS builds)       ──── necesario para TAREA-9
        │
        └──── DOC-ARCH-01 (docs)
                   │
                   └──── DOC-ARCH-02 (docs)       ──── documentación go-live
                              │
                              └──── TAREA-9 (orquestador — gate final)
```

> **Decisión de orquestador (2026-07-07):** Con el staging verde, el camino crítico hacia TAREA-9 depende de tres acciones no bloqueadas entre sí: TAREA-5 (2 min, usuario), TAREA-Redis (5 min, usuario) y TAREA-8 (build time EAS, devops). Se recomienda que el usuario ejecute TAREA-5 y TAREA-Redis de forma inmediata mientras el agente devops lanza TAREA-8 y el agente docs trabaja en DOC-ARCH-01.

---

## Fase 8 — Estado go-live a 2026-07-07

> Actualizado por el orquestador el 2026-07-07.

### Estado de criterios go-live (TAREA-9 / PR-6)

| Criterio | Estado | Evidencia |
|---|---|---|
| **Deploy CI verde** | ⏳ EN PROGRESO | Fix RAILWAY_ENVIRONMENT_ID listo, pendiente push + confirmación |
| **Cobertura tests ≥ 80%** | ⏳ PENDIENTE | Ejecutar `npx jest --coverage` en backend/ |
| **Load test p95 < 500ms** | ⏳ PENDIENTE | Ejecutar `node tests/load/planGeneration.js` |
| **Lighthouse landing ≥ 95** | ⏳ PENDIENTE | Requiere dominio `healthy.app` activo |
| **Seguridad: 0 CRITICAL/HIGH abiertos** | ✅ PASA | Auditado 2026-07-07: VUL-001/002/004 RESUELTOS; VUL-006/007 ACEPTADOS documentados |
| **Migración Prisma producción** | ✅ HECHO | Aplicada 2026-06-29 |
| **Redis staging operativo** | ⏳ PENDIENTE | TAREA-Redis: reemplazar `${{Redis.REDIS_URL}}` por URL real |
| **App TestFlight (iOS)** | ⏳ PENDIENTE | TAREA-8: `eas build --profile preview --platform ios` |
| **App Google Play Internal** | ⏳ PENDIENTE | TAREA-8: `eas build --profile preview --platform android` |
| **Tag v1.0.0** | ⏳ BLOQUEADO | Espera criterios anteriores |

### Acciones manuales requeridas del usuario

1. **Deploy CI** — ejecutar `.\git-push.bat` (fix RAILWAY_ENVIRONMENT_ID) y confirmar verde en GitHub Actions
2. **Redis staging** — Railway dashboard → backend → Variables → editar `REDIS_URL` con URL real del servicio Redis
3. **ECR check** — GitHub → Settings → Branches → main → eliminar `Deploy/Build+Push ECR` de required checks
4. **EAS** — requiere cuenta Expo, credenciales Apple Developer y keystore Android

---

## Fase 10 — Integración dataset de ejercicios reales

> Generada por el orquestador el 2026-08-28.
> Objetivo: integrar un dataset de 1.324 ejercicios reales en la aplicación de forma que Claude genere planes
> usando ejercicios REALES de la base de datos en lugar de inventarlos.
> Dataset fuente: `https://github.com/hasaneyldrm/exercises-dataset`

---

### Contexto y diagnóstico previo al inicio de fase

#### Tabla Exercise — estado actual (schema.prisma)

La tabla `exercises` actual tiene una estructura mínima incompatible con el dataset:

```
model Exercise {
  id               String          @id @default(uuid())   // UUID, no el ID numérico del dataset
  name             String
  muscle_group     String          // sustituir por category + bodyPart + target
  equipment_needed String?
  difficulty       ExperienceLevel // enum beginner/intermediate/advanced (no existe en dataset)
  instructions     String?         // texto plano; el dataset tiene objeto multi-idioma {es, en, ...}
  video_url        String?
}
```

Campos del dataset **no cubiertos** por el schema actual:
- `externalId` (ID numérico del dataset)
- `category` (Arms / Back / Chest / Legs / Shoulders / Waist)
- `bodyPart` (parte del cuerpo más específica)
- `target` (músculo objetivo principal)
- `secondaryMuscles` (array de músculos secundarios)
- `instructions` como objeto JSON multi-idioma (incluye `es`)
- `gifUrl` (GIF animado del ejercicio)
- `thumbnailUrl` (imagen estática)

#### Cómo genera planes el aiService.js actualmente

El servicio `aiService.js` **NO pasa ejercicios de la base de datos a Claude**. Claude los inventa libremente:

1. `buildUserContextPrompt()` construye el prompt con datos del usuario (físico, entrenamiento, nutrición, salud, motivación) pero **no incluye ningún catálogo de ejercicios**.
2. El system prompt (`SYSTEM_PROMPT`) pide a Claude que genere ejercicios con campos `name`, `sets`, `reps`, `rest_seconds`, `equipment_needed`, `instructions` — sin restricción sobre qué ejercicios puede usar.
3. El fallback plan (`generateFallbackPlan`) hardcodea 3 ejercicios inventados (Sentadillas, Flexiones, Plancha) para todos los usuarios.
4. No existe ningún servicio de selección de ejercicios, ni consulta a la tabla `exercises` en ningún punto del flujo de generación de planes.

**Consecuencia:** Los planes generados no están vinculados a la tabla `exercises` de la DB. Los `session_exercises` se crean sin `exercise_id` referenciado, lo que hace imposible vincular el ejercicio del plan con el catálogo real.

---

### Tareas por agente

#### Database Agent
> Carpeta: `projects/healthy/database/`

- [x] **DB-EX-01** — Actualizar modelo `Exercise` en `backend/prisma/schema.prisma` con los nuevos campos del dataset. Campos a añadir o modificar:
  - `externalId Int? @unique` — ID numérico del dataset (permite hacer upsert por id del dataset)
  - `name String` — mantener, ya existe
  - `category String` — sustituye a `muscle_group` (guardar ambos durante la transición o renombrar)
  - `bodyPart String?`
  - `equipment String?` — renombrar `equipment_needed` a `equipment` o añadir `equipment` y deprecar `equipment_needed`
  - `target String?` — músculo objetivo principal
  - `secondaryMuscles String[]` — array de strings (PostgreSQL soporta arrays en Prisma)
  - `instructions Json?` — objeto multi-idioma `{en: "...", es: "..."}` como tipo Json de Prisma
  - `gifUrl String?`
  - `thumbnailUrl String?`
  - Campos a **conservar** para compatibilidad con `SessionExercise`: `id`, `session_exercises` relación
  - Campos a **deprecar** (marcar como opcionales, no eliminar en esta migración para no romper seeds existentes): `muscle_group`, `equipment_needed`, `difficulty`, `video_url`
  - Añadir índices: `@@index([category])`, `@@index([equipment])`, `@@index([target])`, `@@index([bodyPart])`

- [x] **DB-EX-02** — Generar migración Prisma:
  - Desde `projects/healthy/backend/`: `npx prisma migrate dev --name add_exercise_dataset_fields`
  - Verificar con `npx prisma validate`
  - Documentar en `database/MIGRATION_LOG.md` con procedimiento de rollback

- [x] **DB-EX-03** — Crear/actualizar seed script `database/seed-exercises.ts` (archivo separado para no romper el seed principal):
  1. Hacer `fetch` a `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json`
  2. Mapear cada ejercicio del dataset a los campos del schema actualizado:
     ```
     {
       externalId: ex.id,
       name:       ex.name,
       category:   ex.category,
       bodyPart:   ex.bodyPart,
       equipment:  ex.equipment,
       target:     ex.target,
       secondaryMuscles: ex.secondaryMuscles,
       instructions: ex.instructions,  // objeto JSON completo
       gifUrl:     ex.gifUrl,
       thumbnailUrl: ex.thumbnailUrl,
     }
     ```
  3. Usar `prisma.exercise.createMany({ data: exercises, skipDuplicates: true })` para inserción masiva
  4. Si `createMany` no soporta `skipDuplicates` con `externalId` como campo único, usar `upsert` en bucle con batches de 100
  5. Loguear progreso: `console.log(\`Ejercicios insertados: X de 1.324\`)`
  6. Manejar errores de red con retry (máx 3 intentos con backoff de 1s)
  7. El script debe poder ejecutarse de forma autónoma: `npx ts-node database/seed-exercises.ts`

**Complejidad:** MEDIA — la migración es straightforward pero hay que tener cuidado con el renombrado de campos para no romper `SessionExercise` ni los seeds existentes.

**Dependencias:** ninguna — puede iniciar inmediatamente.

---

#### Backend Agent
> Carpeta: `projects/healthy/backend/`

- [x] **BE-EX-01** — Crear `backend/src/services/exerciseSelector.service.js`:

  El servicio debe recibir un objeto de preferencias del usuario y devolver un array de ejercicios de la DB (máx 50) adecuados para el perfil:

  ```js
  /**
   * Selecciona ejercicios apropiados para el perfil del usuario.
   * @param {{ equipment, categories, targetMuscles, excludedMuscles, experienceLevel, limit }} filters
   * @returns {Promise<Exercise[]>}
   */
  async function selectExercises(filters) { ... }
  ```

  Lógica de filtrado (en orden de prioridad):
  1. **Equipamiento:** filtrar por `equipment` basado en `training.home_equipment` y `training.has_gym_access`:
     - `none` → solo `Body Weight`
     - `dumbbells` → `Body Weight`, `Dumbbell`
     - `bands` → `Body Weight`, `Band`
     - `machines` → añadir `Machine`, `Cable`
     - `full` o `has_gym_access: true` → todos los tipos de equipamiento
  2. **Lesiones/limitaciones:** excluir ejercicios cuyo `bodyPart` o `target` coincida con las zonas mencionadas en `training.injuries_or_limitations` (parsing simple de palabras clave: espalda→back/spine, rodilla→legs/knee, hombro→shoulders, etc.)
  3. **Distribución por categorías:** asegurar variedad — si el plan tiene múltiples grupos musculares, distribuir los 50 ejercicios entre las categorías relevantes
  4. **Límite:** devolver máx 50 ejercicios para no saturar el contexto de Claude
  5. Si la consulta devuelve < 10 ejercicios (filtros muy restrictivos), relajar el filtro de equipamiento y loguear un warning

  **Formato de salida** (objeto simplificado para el prompt, sin instrucciones completas):
  ```js
  { id, name, category, equipment, target, bodyPart }
  ```

- [x] **BE-EX-02** — Actualizar `POST /onboarding/complete` en `backend/src/controllers/onboarding.controller.js`:
  1. Antes de llamar a `aiService.generatePlan()`, llamar a `exerciseSelector.selectExercises(trainingPreferences)`
  2. Pasar el resultado como nuevo parámetro a `aiService.generatePlan()` (añadir parámetro `availableExercises`)
  3. Mantener compatibilidad con el flujo actual — si `exerciseSelector` falla, continuar sin ejercicios (warning en log)

- [x] **BE-EX-03** — Actualizar `POST /plans/regenerate` en `backend/src/controllers/plans.controller.js`:
  - Misma lógica que BE-EX-02: llamar a `exerciseSelector` antes de llamar a `aiService.regeneratePlan()`
  - Invalidar caché Redis del plan anterior antes de regenerar

- [x] **BE-EX-04** — Añadir endpoint `GET /exercises` en una nueva ruta `backend/src/routes/exercises.routes.js`:
  - Query params de filtro: `?equipment=Dumbbell&category=Arms&target=biceps&bodyPart=upper+arm&limit=50&offset=0`
  - Respuesta paginada con formato estándar `{ success, data: { exercises, total, limit, offset } }`
  - Registrar la ruta en `backend/src/app.js` bajo `/exercises`
  - Todos los params son opcionales; sin params devuelve todos con paginación por defecto (limit=20)

**Complejidad BE-EX-01:** MEDIA — la lógica de filtrado por lesiones requiere parsing de texto libre.
**Complejidad BE-EX-02/03:** BAJA — añadir una llamada antes de las existentes.
**Complejidad BE-EX-04:** BAJA — endpoint CRUD estándar.

**Dependencias:** DB-EX-01 y DB-EX-02 deben estar completadas (schema actualizado y migración aplicada).

---

#### AI Agent
> Carpeta: `projects/healthy/backend/src/services/` (aiService.js)

- [x] **AI-EX-01** — Actualizar el system prompt `SYSTEM_PROMPT` en `backend/src/services/aiService.js`:

  Añadir al inicio de la sección `## REGLAS ESTRICTAS` la siguiente instrucción (antes de las reglas numéricas existentes):

  ```
  REGLA PRIORITARIA — CATÁLOGO DE EJERCICIOS:
  Usa ÚNICAMENTE los ejercicios del catálogo proporcionado en el mensaje del usuario.
  No inventes ni añadas ejercicios que no estén en esa lista.
  Si el catálogo no tiene suficientes ejercicios para completar el plan, reutiliza ejercicios
  del catálogo variando series, repeticiones o intensidad.
  ```

  Esta regla debe ser la primera del system prompt para que tenga máxima prioridad.

- [x] **AI-EX-02** — Actualizar `buildUserContextPrompt()` en `backend/src/services/aiService.js`:

  Añadir un nuevo parámetro `availableExercises` (array de ejercicios del DB) y construir una sección de catálogo compacta en el prompt:

  ```
  ## CATÁLOGO DE EJERCICIOS DISPONIBLES
  Usa SOLO estos ejercicios. Formato: ID | Nombre | Equipamiento | Músculo objetivo | Parte del cuerpo

  1 | Push-Up | Body Weight | pectorals | upper body
  2 | Dumbbell Curl | Dumbbell | biceps | upper arm
  ...
  ```

  Formato compacto (sin instrucciones completas) para minimizar tokens. El campo `id` del dataset se incluye en el prompt para que Claude pueda referenciar el ejercicio de forma unívoca (y el backend puede luego buscar el `exercise_id` en DB por nombre o externalId).

  Actualizar la firma de `generatePlan()` para aceptar `availableExercises`:
  ```js
  async function generatePlan(userId, onboardingData, requestType, extraContext, availableExercises)
  ```

  Si `availableExercises` es null o vacío, el prompt no incluye la sección de catálogo (compatibilidad hacia atrás).

  Actualizar igualmente `regeneratePlan()` para pasar `availableExercises`.

  Actualizar el fallback `generateFallbackPlan()` para que, si se le pasan ejercicios disponibles, use los primeros 3 del catálogo en lugar de los hardcodeados (Sentadillas, Flexiones, Plancha).

**Complejidad AI-EX-01:** BAJA — modificar texto del system prompt.
**Complejidad AI-EX-02:** MEDIA — modificar firmas de funciones y añadir lógica de formateo del catálogo; cuidar compatibilidad con caché Redis (la clave de caché debe incluir un hash del catálogo o invalidarse cuando cambien los ejercicios seleccionados).

**Dependencias:** BE-EX-01 debe existir para que el catálogo llegue a esta función.

---

#### Tests Agent
> Carpeta: `projects/healthy/tests/`

- [x] **TEST-EX-01** — Tests unitarios para `exerciseSelector.service.js`:
  - Test: usuario sin equipamiento → devuelve SOLO ejercicios `Body Weight`
  - Test: usuario con gimnasio → devuelve ejercicios de todos los equipamientos
  - Test: usuario con lesión de rodilla → no incluye ejercicios de `Legs`
  - Test: filtros muy restrictivos → devuelve al menos 1 ejercicio (no array vacío) y loguea warning
  - Test: resultado no supera 50 ejercicios independientemente del total en DB
  - Mock: usar `jest.mock('../prisma/client')` para no depender de DB real

- [x] **TEST-EX-02** — Tests de integración para `GET /exercises`:
  - Test: sin params → devuelve 20 ejercicios paginados con `total`
  - Test: `?equipment=Dumbbell` → todos los resultados tienen `equipment = "Dumbbell"`
  - Test: `?category=Arms&limit=5` → máx 5 resultados, todos de categoría Arms
  - Test: `?offset=1000` → devuelve array vacío con `total` correcto (no error 500)
  - Mock: Prisma mock de `__mocks__/prisma.js` ya existente en el proyecto

- [x] **TEST-EX-03** — Test de smoke: verificar que tras `POST /onboarding/complete` el plan contiene ejercicios que existen en la DB:
  - Setup: insertar en DB de test 10 ejercicios con `externalId` conocidos
  - Ejecutar `POST /onboarding/complete` con perfil completo
  - Parsear el `generated_plan.training_plan.weekly_schedule[].exercises[].name`
  - Verificar que al menos el 80% de los nombres de ejercicio del plan coinciden con nombres del catálogo en DB
  - Este test debe marcarse como `integration` y excluirse del gate de cobertura si Claude API no está disponible (usar flag `SKIP_AI_TESTS=true`)

**Complejidad:** MEDIA — TEST-EX-03 requiere coordinación con el flujo de onboarding completo y puede ser frágil si Claude varía las respuestas.

**Dependencias:** DB-EX-01/02/03 (datos en DB), BE-EX-01/02/03 (endpoints), AI-EX-01/02 (prompt actualizado).

---

### Orden de ejecución

```
DB-EX-01 (actualizar schema Exercise)
    │
    ▼
DB-EX-02 (migración Prisma)
    │
    ├──────────────────────────────────────────┐
    ▼                                          ▼
DB-EX-03 (seed 1.324 ejercicios)         BE-EX-01 (exerciseSelector.service.js)
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                              BE-EX-02               AI-EX-01
                        (onboarding/complete    (actualizar SYSTEM_PROMPT)
                         llama al selector)
                              │                     │
                              ▼                     ▼
                         BE-EX-03              AI-EX-02
                    (plans/regenerate      (buildUserContextPrompt
                     llama al selector)    con catálogo compacto)
                                    │
                                    ▼
                              BE-EX-04
                         (GET /exercises)
                                    │
                                    ▼
                    TEST-EX-01 + TEST-EX-02 + TEST-EX-03
```

**Agente que debe ejecutarse primero:** Database Agent (DB-EX-01 → DB-EX-02 → DB-EX-03).
Sin el schema actualizado y la migración aplicada, ningún otro agente puede avanzar.

---

### Estimación de complejidad por tarea

| Tarea | Agente | Complejidad | Estimación |
|---|---|---|---|
| DB-EX-01 | database | MEDIA | 30-45 min — renombrar campos con cuidado de no romper SessionExercise |
| DB-EX-02 | database | BAJA | 10 min — `prisma migrate dev` + validar |
| DB-EX-03 | database | MEDIA | 45-60 min — fetch + mapeo + seed masivo con manejo de errores |
| BE-EX-01 | backend | MEDIA | 45-60 min — lógica de filtrado por equipamiento + lesiones |
| BE-EX-02 | backend | BAJA | 15 min — añadir llamada al selector en onboarding |
| BE-EX-03 | backend | BAJA | 15 min — añadir llamada al selector en regenerate |
| BE-EX-04 | backend | BAJA | 20 min — endpoint GET con filtros y paginación |
| AI-EX-01 | ai | BAJA | 10 min — editar texto del system prompt |
| AI-EX-02 | ai | MEDIA | 30-45 min — nuevo parámetro en generatePlan + formateo del catálogo |
| TEST-EX-01 | tests | MEDIA | 30 min — 5 tests unitarios con mock Prisma |
| TEST-EX-02 | tests | BAJA | 20 min — 4 tests integración endpoint |
| TEST-EX-03 | tests | ALTA | 45-60 min — smoke test con flujo completo |

**Total estimado:** ~5-6 horas de trabajo de agentes en secuencia, ~3 horas en paralelo óptimo.

---

### Notas de implementación importantes

1. **Imágenes para MVP:** guardar `gifUrl` y `thumbnailUrl` tal como vienen del dataset (URLs de GitHub raw). Migración a S3 → tarea futura, NO en este sprint.
2. **Caché Redis:** la clave actual `plan:${userId}:${today}` no distingue si el catálogo de ejercicios cambió. Añadir hash del catálogo seleccionado a la clave o simplemente no cachear si `availableExercises` está presente (dejar la decisión al AI Agent en AI-EX-02).
3. **Prisma 7 — `createMany` con `skipDuplicates`:** verificar que el adapter `@prisma/adapter-pg` soporta `skipDuplicates`. Si no, usar upsert en batches.
4. **Schema — `difficulty` vs dataset:** el dataset no tiene campo `difficulty`. El campo `ExperienceLevel` existente en el schema puede conservarse como `null` para los ejercicios del dataset (se inferirá del nivel del usuario, no del ejercicio).
5. **Compatibilidad SessionExercise:** la relación `session_exercises` referencia `exercise_id`. Tras la migración, los planes futuros deben guardar el `exercise_id` real de la DB al crear `SessionExercise`. Esto requiere que el AI Agent devuelva el `externalId` o `name` del ejercicio en el JSON de Claude, y el backend haga un lookup antes de insertar en `session_exercises`.

---

### Resumen Fase 10

| Tarea | Agente | Prioridad | Estado |
|---|---|---|---|
| DB-EX-01 | database | CRITICA — BLOQUEANTE | [x] Completada 2026-08-28 |
| DB-EX-02 | database | CRITICA — BLOQUEANTE | [x] Completada 2026-08-28 |
| DB-EX-03 | database | ALTA | [x] Completada 2026-08-28 |
| BE-EX-01 | backend | ALTA | [x] Completada 2026-08-28 |
| BE-EX-02 | backend | ALTA | [x] Completada 2026-08-28 |
| BE-EX-03 | backend | MEDIA | [x] Completada 2026-08-28 |
| BE-EX-04 | backend | MEDIA | [x] Completada 2026-08-28 |
| AI-EX-01 | ai | ALTA | [x] Completada 2026-08-28 |
| AI-EX-02 | ai | ALTA | [x] Completada 2026-08-28 |
| TEST-EX-01 | tests | MEDIA | [x] Completada 2026-08-28 — 18 tests |
| TEST-EX-02 | tests | BAJA | [x] Completada 2026-08-28 — 27 tests |
| TEST-EX-03 | tests | MEDIA | [x] Completada 2026-08-28 — 19 tests |

> **Decisión de orquestador (2026-08-28):** Lanzar Database Agent primero (DB-EX-01 → DB-EX-02 → DB-EX-03). En paralelo con DB-EX-03, Backend Agent puede comenzar BE-EX-01 (no necesita datos en DB, solo el schema). Una vez BE-EX-01 completado, BE-EX-02 y AI-EX-01/02 pueden ejecutarse en paralelo. Tests al final cuando todo el stack esté integrado.
>
> **Resultado (2026-08-28):** Fase 10 COMPLETADA. Todas las tareas (DB-EX-01 a TEST-EX-03) entregadas en el mismo día. 317/317 tests pasando, 89.18% cobertura de líneas. Commit principal: `40bdb9d`.

---

## Fase 9 — Estado orquestador a 2026-07-14

> Actualizado por el orquestador el 2026-07-14.

### Decisiones tomadas

| Decisión | Detalle |
|---|---|
| **Load tests diferidos** | TS-08 excluido del gate v1.0.0 por decisión del usuario. Se ejecutarán post-release en producción real (v1.1.0). |
| **Lighthouse pendiente** | Dominio `healthy.app` no responde aún (CloudFront/DNS no activo). Lighthouse v13 + Chrome disponibles localmente; el check se ejecuta en cuanto el dominio esté activo. |
| **EAS documentado** | `devops/EAS_CHECKLIST.md` creado con prerrequisitos exactos, comandos paso a paso y tabla de errores frecuentes para iOS y Android. Requiere acción del usuario (cuentas Apple/Google). |
| **Go-live gate documentado** | `devops/GO_LIVE_CHECKLIST.md` creado con todos los criterios, comandos de verificación y pasos post-tag. |

### Estado de criterios go-live actualizado (2026-07-14)

| Criterio | Estado | Evidencia / Próximo paso |
|---|---|---|
| **Deploy CI verde** | ✅ COMPLETADO | Staging verde desde 2026-07-07 |
| **Cobertura tests ≥ 80%** | ✅ COMPLETADO | 88.21%, 253/253 tests (2026-07-08) |
| **Load test p95 < 500ms** | [~] DIFERIDO | Decisión del usuario — post-release v1.1.0 |
| **Lighthouse landing ≥ 95** | ⏳ PENDIENTE | Dominio `healthy.app` inactivo; instrucciones en `tests/LIGHTHOUSE_PENDING.md` |
| **Seguridad: 0 CRITICAL/HIGH abiertos** | ✅ PASA | Auditado 2026-07-07 |
| **Migración Prisma producción** | ✅ HECHO | Aplicada 2026-06-29 |
| **Redis staging operativo** | ⏳ PENDIENTE | Acción manual usuario en Railway dashboard |
| **App TestFlight (iOS)** | ⏳ PENDIENTE | TAREA-8 — ver `devops/EAS_CHECKLIST.md` |
| **App Google Play Internal** | ⏳ PENDIENTE | TAREA-8 — ver `devops/EAS_CHECKLIST.md` |
| **Tag v1.0.0** | ⏳ BLOQUEADO | Espera: Lighthouse, Redis, TAREA-8 |

### Archivos generados por el orquestador en esta sesión

| Archivo | Propósito |
|---|---|
| `tests/LIGHTHOUSE_PENDING.md` | Instrucciones exactas para ejecutar Lighthouse cuando `healthy.app` esté activo |
| `devops/EAS_CHECKLIST.md` | Prerrequisitos, comandos y tabla de errores para builds iOS/Android |
| `devops/GO_LIVE_CHECKLIST.md` | Checklist completo de criterios, pasos de tag y monitorización post-lanzamiento |

### Próximas acciones del usuario (en orden)

1. **Redis staging** (5 min) — Railway dashboard → servicio backend → Variables → editar `REDIS_URL`
   Verificación: `curl https://backend-staging-01ee.up.railway.app/health` → `"redis":"connected"`

2. **TAREA-8 EAS** — seguir `devops/EAS_CHECKLIST.md`:
   - Crear cuentas Apple Developer y Google Play si no existen
   - `eas login` → `eas credentials` → `eas build --platform all --profile preview`

3. **Lighthouse** — cuando `healthy.app` esté activo, ejecutar el comando en `tests/LIGHTHOUSE_PENDING.md`

4. **Tag v1.0.0** — cuando criterios 1-3 pasen, seguir `devops/GO_LIVE_CHECKLIST.md` paso a paso
