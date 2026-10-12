# Changelog — Healthy

Todos los cambios notables de este proyecto están documentados en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
El versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0-rc.1] - 2026-08-28

### Added
- Exercise dataset integration (1,324 real exercises from hasaneyldrm/exercises-dataset)
- `exerciseSelector` service with equipment/goal/difficulty/injury filtering (`backend/src/services/exerciseSelector.service.js`)
- `GET /exercises` and `GET /exercises/:id` API endpoints with pagination and filter support (`backend/src/routes/exercises.routes.js`)
- Seed script for exercise catalog download and bulk insertion (`database/seedExercises.js`)
- 64 new unit and integration tests for exercise functionality (18 + 19 + 27 tests)

### Changed
- Exercise schema extended with 11 new fields: `externalId`, `category`, `bodyPart`, `target`, `secondaryMuscles`, `instructionsEs`, `instructionsEn`, `gifUrl`, `thumbnailUrl`, `equipment`, `createdAt` (`backend/prisma/schema.prisma`)
- AI plan generation now uses real exercise catalog instead of allowing Claude to invent exercises (`backend/src/services/aiService.js`)
- `SYSTEM_PROMPT` updated with exercise catalog constraints section (`## CATÁLOGO DE EJERCICIOS`)
- `buildUserContextPrompt()` now accepts `exercises` parameter and generates catalog section in user prompt
- `onboarding.controller.js` `complete()` now calls `exerciseSelector` before `generatePlan`
- `plans.controller.js` `regeneratePlan()` now calls `exerciseSelector` before `regeneratePlan`
- `backend/src/app.js`: `/exercises` route registered with rate limiter
- `backend/jest.config.js`: added `modulePaths: ['<rootDir>/node_modules']` for test module resolution

### Fixed
- AI no longer invents exercises in training plans — all exercises come from the real database catalog
- Exercise IDs (`externalId`) are now traceable between the dataset, the database, and the generated plans

### Database
- Migration `20260828_add_exercise_dataset_fields`: `ALTER TABLE exercises ADD COLUMN` for all 11 new fields with `IF NOT EXISTS` guard
- New indexes on `category`, `equipment`, `target`, `bodyPart`, `externalId`

### Tests
- Total: 317/317 tests passing
- Line coverage: 89.18% (up from 88.21% in previous milestone)

---

## [0.9.0] - 2026-07-14

### Added
- `devops/EAS_CHECKLIST.md` — prerrequisitos y comandos paso a paso para builds iOS/Android con Expo EAS
- `devops/GO_LIVE_CHECKLIST.md` — checklist completo de criterios, pasos de tag y monitorización post-lanzamiento
- `tests/LIGHTHOUSE_PENDING.md` — instrucciones para ejecutar Lighthouse cuando el dominio `healthy.app` esté activo

### Changed
- Tests: 253/253 pasando, cobertura 88.21% (objetivo ≥80% superado)
- `docs/architecture-web.md` actualizado con estructura de monorepo, modelo Docker multi-stage y configuración Prisma 7
- `docs/deployment-guide.md` actualizado con instrucciones de Prisma 7 y despliegue desde raíz del monorepo

### Deferred
- Load tests (TS-08) diferidos a v1.1.0 por decisión del usuario (requieren backend levantado localmente)
- Lighthouse check pendiente hasta que `healthy.app` esté activo en DNS

---

## [0.8.0] - 2026-07-07

### Added
- Railway staging deploy operativo: `https://backend-staging-01ee.up.railway.app`
- `devops/PIPELINE_STATUS.md` — resultado del primer deploy verde en GitHub Actions
- `devops/RAILWAY_VARS_STATUS.md` — estado de variables de entorno en Railway
- `docs/architecture-web.md` — arquitectura AWS completa con diagrama, estructura del monorepo y configuración Prisma 7
- `docs/deployment-guide.md` — guía paso a paso para entornos local, staging y producción

### Fixed
- `RAILWAY_API_TOKEN` corregido a `RAILWAY_ENVIRONMENT_ID` en workflow `deploy-staging.yml`
- `REDIS_URL` configurada con URL directa en Railway (reemplaza referencia `${{Redis.REDIS_URL}}` que no resolvía)
- URL de staging hardcodeada en workflows actualizada a la URL real del servicio Railway
- Check `Deploy/Build+Push ECR` eliminado de branch protection rules de `main`

---

## [0.7.0] - 2026-07-08

### Added
- 253 tests en total (217 preexistentes + 36 nuevos en esta sesión)
- `backend/jest.config.js` con configuración de cobertura y paths
- `.github/workflows/tests.yml` — CI con servicios postgres+redis, threshold 80%, artefacto HTML

### Changed
- Cobertura de tests: de 23% inicial a 88.21% (umbral ≥80% superado)

---

## [0.6.0] - 2026-06-08

### Added
- Tests unitarios para `nutritionCalculator.js` (53 tests, 100% cobertura)
- Tests de integración para auth, onboarding, nutrition y progress
- Tests E2E del flujo crítico (registro → onboarding → plan → medición)
- `tests/load/planGeneration.js` con autocannon

---

## [0.5.0] - 2026-06-08 — Patch RGPD

### Added
- `DELETE /user/me` — eliminación en cascada (Art. 17 RGPD)
- `GET /user/me/export` — exportación JSON completa (Art. 20 RGPD)
- Campo `health_consent_given_at` en modelo `User`
- Validación de edad mínima ≥16 años en `POST /auth/register`
- `planRegenerateLimiter` — 3 req/24h por userId en `POST /plans/regenerate`
- OTP generado con `crypto.randomInt()` (elimina `Math.random()`)
- Helmet con CSP explícita, `frameguard: deny`, HSTS preload

---

## [0.4.0] - 2026-06-07 — Seguridad y Frontend

### Added
- Frontend React Native completo: auth, onboarding 7 pasos, training, nutrition, progress, home
- Zustand stores: authStore, planStore, onboardingStore
- Dark mode con hook `useTheme()`
- Skeleton loaders y Toast accesible en todas las pantallas
- Auditoría de seguridad RGPD: 0 hallazgos CRITICAL, 4 hallazgos ALTO resueltos en v0.5.0

---

## [0.3.0] - 2026-06-07 — Backend completo

### Added
- API REST completa: auth, onboarding, plans, training, nutrition, progress, logs, foods, user
- Integración Claude API con prompt caching (`cache_control: ephemeral`)
- Plan de fallback por reglas cuando Claude falla
- Detección de plateau (≥4 registros, ±0.5 kg, 14 días)
- Redis para caché de planes IA (TTL 24h) y sesiones JWT
- Rate limiting: authLimiter (5 req/15min) y apiLimiter (100 req/15min)

---

## [0.2.0] - 2026-06-07 — Sistema de diseño e infraestructura

### Added
- Sistema de diseño completo: tokens, componentes (ProgressRing, WorkoutCard, MetricCard, etc.)
- Landing page HTML autocontenida en `landing/index.html`
- Infraestructura AWS: S3 + CloudFront + Route 53 para landing
- Pipeline GitHub Actions para deploy automático de landing

---

## [0.1.0] - 2026-06-07 — Fundación

### Added
- Schema PostgreSQL con 21 entidades
- Módulo IA: `planGenerator.ts`, `fallbackPlan.ts`, `tokenLogger.ts`, `types.ts`
- ERD completo en `database/ERD.md`
- Redis con estrategia de caché documentada
