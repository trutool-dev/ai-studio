# Diario del proyecto — Healthy

Registro histórico de las fases de desarrollo del proyecto Healthy. Se actualiza al terminar cada fase.

---

## Fase 1 — COMPLETADA (2026-06-07)

### Qué se construyó

#### Database (DB-01..DB-10)
- **`database/schema.prisma`** — 21 entidades PostgreSQL completas: `User`, `Profile`, `LifestyleProfile`, `TrainingPreferences`, `HealthCondition`, `NutritionPreferences`, `FoodRestriction`, `MotivationProfile`, `OnboardingAnswer`, `VerificationCode`, `PasswordResetToken`, `AuthSession`, `Plan`, `TrainingSession`, `Exercise`, `SessionExercise`, `Meal`, `Food`, `MealFood`, `ProgressLog`, `DailyLog`.
- **`database/redis.ts`** — Cliente Redis (ioredis) con patrón singleton, TTLs definidos (plan IA 24h, sesión 30d, perfil 1h, preferencias 6h, rate limit 15min), y helpers de dominio para cachear planes, perfiles y sesiones.
- **`database/seed.ts`** — Datos de prueba realistas para desarrollo local.
- **`database/ERD.md`** — Diagrama Mermaid de entidad-relación + tabla descriptiva de las 21 entidades + enums del sistema + decisiones de diseño.

#### AI Module (AI-01..AI-07)
- **`ai/types.ts`** — Interfaces TypeScript completas para el sistema de IA: `OnboardingData` (7 dimensiones), `GeneratedPlan`, `WeeklySession`, `ExerciseDetail`, `MealSuggestion`, `MetabolismMetrics`. Incluye `calculateMetabolism()` con la fórmula Mifflin-St Jeor y el JSON Schema de validación.
- **`ai/planGenerator.ts`** — `generatePlan()` con caché Redis, prompt caching Anthropic, extracción robusta de JSON. `shouldRegeneratePlan()` con detección de plateau (>2 semanas, ±0.5kg, ≥4 registros). `regeneratePlan()` con contexto enriquecido por razón de regeneración.
- **`ai/fallbackPlan.ts`** — Plan generado por reglas predefinidas para cuando la API de Claude falla. Respeta objetivo del usuario, acceso a gym, tipo de dieta y nivel de experiencia. `generated_by_ai: false`.
- **`ai/tokenLogger.ts`** — Log de tokens con estimación de coste USD en tiempo real. Precios: input $3/MTok, output $15/MTok, cache_read $0.30/MTok, cache_write $3.75/MTok.

#### Design System (DS-01..DS-10)
- **`design/tokens/`** — Tokens de color (fondo `#080808`, verde marca `#22C55E`), tipografía (SF Pro Display), espaciado (sistema 4pt/8pt).
- **`design/components/`** — Componentes React Native: `ProgressRing`, `ActivityRings`, `WorkoutCard`, `MetricCard`, `Button`, `Input`, `Card`, `Navigation`.
- **`design/screens/`** — Especificaciones UI: `ONBOARDING_UI.md`, `DAILY_PLAN_UI.md`, `EMPTY_ERROR_STATES.md`.
- **`design/ACCESSIBILITY_AUDIT.md`** — Auditoría WCAG AA con 5 blockers identificados y correcciones exactas de contraste de color.

#### DevOps — Infraestructura landing (Fase 3b, completada anticipadamente)
- **Railway** servicio `healthy-landing` (nginx) — ver `docs/landing-deploy.md`.
- **`landing/index4.html`** — Landing page publicada (HTML + Tailwind CDN + JS inline, sin build).

### Decisiones técnicas tomadas

| Decisión | Alternativas consideradas | Justificación |
|----------|--------------------------|---------------|
| PostgreSQL como BD principal | MongoDB, Supabase DB | Datos relacionales fuertemente tipados; integridad referencial; cascade delete para RGPD |
| Redis para caché de planes IA | Memoria del proceso, DynamoDB | Latencia ultra-baja; TTL nativo; compartido entre instancias del backend |
| Separación de perfiles de onboarding en 5 modelos | Un modelo monolítico | Carga progresiva durante onboarding; caché independiente; queries más ligeras |
| Mifflin-St Jeor para TMB/TDEE | Harris-Benedict, Katch-McArdle | Más precisa para personas con sobrepeso; la más usada en literatura reciente |
| Prompt caching con `cache_control: ephemeral` | Sin caching, sistema propio | Reducción ~80% de tokens de input del system prompt; sin código adicional |
| Plan de fallback por reglas | Reintentos, plan vacío | El usuario siempre recibe un plan funcional aunque no sea personalizado por IA |
| Landing como HTML autocontenido | Next.js, Gatsby | Cero dependencias de build; deploy trivial (nginx en Railway); mantenimiento mínimo |

### Archivos generados en Fase 1

```
database/
├── schema.prisma
├── redis.ts
├── seed.ts
└── ERD.md

ai/
├── types.ts
├── planGenerator.ts
├── fallbackPlan.ts
└── tokenLogger.ts

design/
├── tokens/colors.js
├── tokens/typography.js
├── tokens/spacing.js
├── components/ (8 componentes)
├── screens/ (3 documentos)
└── ACCESSIBILITY_AUDIT.md

landing/
└── index4.html

docs/
├── architecture-web.md
├── landing-deploy.md
└── landing-content.md
```

---

## Fase 2 — COMPLETADA (2026-06-07)

### Backend Node.js + Express (BE-01..BE-10)

**Estado:** Completado

**Tareas completadas:**

| Task | Descripción | Estado |
|------|-------------|--------|
| BE-01 | Auth: registro, login, OTP, refresh tokens | COMPLETADO |
| BE-02 | Onboarding: endpoints para los 7 pasos | COMPLETADO |
| BE-03 | Plans: generación, consulta, historial | COMPLETADO |
| BE-04 | Training: sesiones, ejercicios, completion | COMPLETADO |
| BE-05 | Nutrition: comidas, alimentos, macros diarios | COMPLETADO |
| BE-06 | Progress: logs corporales, plateau detection | COMPLETADO |
| BE-07 | Daily logs: agua, sueño, energía, pasos | COMPLETADO |
| BE-08 | Profile: consulta y actualización | COMPLETADO |
| BE-09 | Docker + CI/CD para backend | COMPLETADO |
| BE-10 | Tests de integración de la API | COMPLETADO |

---

## Fase 3 — COMPLETADA (2026-06-07)

### Frontend React Native (FE-01..FE-14)

#### Qué se construyó

**Capa de servicios y estado (stores)**
- `src/services/api.ts` — cliente HTTP con interceptores JWT dual-token, queue anti-race-condition, auto-refresh transparente
- `src/stores/authStore.ts` — gestión de accessToken + refreshToken, login/logout/refreshTokens, persistencia en SecureStore
- `src/stores/planStore.ts` — fetchTodayTraining, logExerciseSet, completeSession, fetchTodayNutrition, fetchProgress, submitProgress, regeneratePlan, fetchTodayLog
- `src/stores/onboardingStore.ts` — currentStep, completedSteps, markStepComplete
- `src/hooks/useTheme.ts` — dark mode con tokens dark.*

**Pantallas y flujos**
- Todas las pantallas de autenticación conectadas al backend real
- Onboarding de 7 pasos: PUT por paso + POST /onboarding/complete con loading 5-15s y polling hasta recibir plan
- TrainingScreen: skeleton loader, SetModal (peso+reps), WorkoutCard, ExerciseRow, RestTimer, WorkoutSummary integrados
- NutritionScreen: GET /nutrition/today, FoodSearchBar con debounce 300ms, toggle de comida completada
- ProgressScreen: modal de registro + detección de `needs_plan_regeneration` + modal de regeneración
- HomeScreen: logs diarios completos (agua, sueño, energía, pasos)

**Componentes y accesibilidad**
- `src/components/ui/Toast.tsx` — toast accesible con `accessibilityRole="alert"`
- Colores WCAG AA corregidos en `theme/colors.ts`: midGray `#6B7280`, success `#15803D`, error `#DC2626`, botones primarios `#16A34A`
- `react-native-mmkv` añadido a `package.json` (pendiente build nativo)

#### Decisiones técnicas clave

| Decisión | Justificación |
|----------|---------------|
| Token rotation con queue | El interceptor de Axios mantiene una cola de requests durante el refresh, evitando concurrent refresh storms (múltiples llamadas simultáneas que roten el token en paralelo invalidándose entre sí) |
| Patrón `initApiInterceptors` | Rompe la dependencia circular store → api → store. Los interceptores se registran desde el store una vez que el contexto está inicializado |
| Onboarding fire-and-continue | Las llamadas PUT de cada paso no bloquean el avance aunque fallen. El fallo silencioso garantiza que ningún error de red interrumpe la experiencia de onboarding |
| Flag `has_plan` en User | RootNavigator comprueba `has_plan` en el token/store para saltar directamente al dashboard en re-login, sin repetir el onboarding |

### Security — Auditoría (SEC-01..SEC-08)

#### Resultado global: WARN

No hay hallazgos CRÍTICOS que expongan datos de usuarios actualmente. Sin embargo, existen cuatro hallazgos de severidad ALTO que bloquean el lanzamiento legal en la Unión Europea por incumplimiento del RGPD.

#### Top 5 hallazgos

| # | ID | Severidad | Descripción | Bloquea producción |
|---|----|-----------|--------------|--------------------|
| 1 | RGPD-01 | ALTO | No existe `DELETE /user/me` (derecho al olvido, Art. 17 RGPD) | SI |
| 2 | RGPD-02 | ALTO | No existe `GET /user/me/export` (portabilidad, Art. 20 RGPD) | SI |
| 3 | RGPD-03 | ALTO | No se verifica edad mínima de 16 años (LOPDGDD Art. 7) en registro ni onboarding | SI |
| 4 | RGPD-04 | ALTO | El consentimiento explícito para tratar datos de salud (Art. 9.2.a RGPD) no se registra en BD — falta campo `health_consent_given_at` en `User` | SI |
| 5 | RL-01 | ALTO | `POST /plans/regenerate` sin rate limiting por userId — un usuario autenticado puede agotar el presupuesto de tokens de Anthropic sin límite | NO (impacto económico) |

#### Qué bloquea producción

Los puntos 1-4 son **bloqueantes legales** para cualquier lanzamiento en la UE. La ausencia de los derechos de supresión y portabilidad, la falta de verificación de edad mínima, y la ausencia de registro de consentimiento para datos de categoría especial (Art. 9 RGPD — datos de salud) son infracciones directas que exponen a la empresa a sanciones de hasta 20 M€ o el 4% del volumen de negocio anual.

#### Archivos generados en Fase 3 (Security)

```
security/
├── SECURITY_AUDIT.md      — informe completo con hallazgos por categoría
├── INCIDENT_RESPONSE.md   — protocolo RGPD 72h con plantilla AEPD
└── VULNERABILITIES.md     — registro de 22 vulnerabilidades detectadas
```

---

## Fase 3b — COMPLETADA (2026-06-08): Backend patch RGPD

**Objetivo:** Resolver los bloqueantes legales identificados en la auditoría de seguridad antes del lanzamiento en la UE.

**Tareas completadas:**

| Task | Descripción | Estado |
|------|-------------|--------|
| RGPD-P1 | `DELETE /user/me` — eliminación en cascada + invalidación Redis (Art. 17 RGPD) | COMPLETADO |
| RGPD-P2 | `GET /user/me/export` — exportación JSON completa con `Content-Disposition: attachment` (Art. 20 RGPD) | COMPLETADO |
| RGPD-P3 | Campo `health_consent_given_at` + `health_consent_version` en modelo `User`; guardado en `PUT /onboarding/health` | COMPLETADO |
| RGPD-P4 | Validación edad ≥ 16 en `POST /auth/register` a partir de `birthdate` | COMPLETADO |
| RGPD-P5 | `planRegenerateLimiter` — 3 req/24h por userId en Redis (en `POST /plans/regenerate`) | COMPLETADO |
| RGPD-P6 | OTP generado con `crypto.randomInt(100000, 1000000)` (elimina `Math.random()`) | COMPLETADO |
| RGPD-P7 | Helmet con CSP explícita, `frameguard: deny`, HSTS preload; CORS sin fallback `*` | COMPLETADO |

### Archivos creados en Fase 3b

- `backend/src/controllers/user.controller.js` — `DELETE /user/me` (Art.17: borrado en cascada + invalidación Redis) y `GET /user/me/export` (Art.20: exportación JSON con cabecera `Content-Disposition: attachment`)
- `backend/src/routes/user.routes.js` — rutas `DELETE /user/me` y `GET /user/me/export`, protegidas por middleware `authenticate`
- `backend/src/middleware/rateLimiter.js` — `authLimiter` (5 req/15min en `/auth/*`) y `planRegenerateLimiter` (3 req/24h por userId en `POST /plans/regenerate`)
- `backend/src/utils/crypto.util.js` — generación OTP con `crypto.randomInt(100000, 1000000)`
- `database/schema.prisma` — campos `health_consent_given_at DateTime?` y `health_consent_version String? @default("1.0")` añadidos al modelo `User`
- `backend/src/app.js` — Helmet con CSP explícita, `frameguard: deny`, HSTS preload; CORS sin fallback `*`
- `backend/src/controllers/auth.controller.js` — verificación de edad ≥ 16 en registro + guardado de `health_consent_given_at` en onboarding/health

### Pendiente: migraciones manuales

```bash
npx prisma migrate dev --schema ../database/schema.prisma --name add_token_usage_logs
npx prisma migrate dev --schema ../database/schema.prisma --name add_health_consent
```

---

## Fase 4 — COMPLETADA (2026-06-08): Tests y calidad

### Qué se construyó

**Total: 64 tests (11 preexistentes + 53 nuevos). 100% de cobertura en `nutritionCalculator.js`.**

| ID | Descripción | Tests | Estado |
|----|-------------|-------|--------|
| TS-01 | Auditoría baseline de cobertura | — | COMPLETADO |
| TS-02 | Tests unitarios `nutritionCalculator.js` | 53 | COMPLETADO |
| TS-03 | Tests de integración — flujo auth completo | — | COMPLETADO |
| TS-04 | Tests de integración — onboarding 7 pasos | — | COMPLETADO |
| TS-05 | Tests E2E — flujo crítico end-to-end | 13 pasos | COMPLETADO |
| TS-06 | Tests de integración — nutrition + progress | — | COMPLETADO |
| TS-07 | CI/CD con threshold de cobertura al 80% | — | COMPLETADO |
| TS-08 | Tests de carga con autocannon | — | COMPLETADO |

### Archivos creados en Fase 4

- `tests/COVERAGE_REPORT.md` — TS-01: auditoría baseline (23% cobertura inicial, módulos identificados)
- `tests/unit/nutritionCalculator.test.js` — TS-02: 53 tests unitarios para `calculateBMR`, `calculateTDEE`, `calculateMacros`, `calculateNutritionTargets` (Mifflin-St Jeor, multiplicadores TDEE, balance macro kcal ±20)
- `tests/integration/auth.test.js` — TS-03: flujo completo register → verify-email → set-password → login → refresh → logout + rate limiting + OTP expiry (BD real, sin mocks)
- `tests/integration/onboarding.test.js` — TS-04: 7 pasos + `POST /onboarding/complete` con IA mockeada
- `tests/e2e/criticalFlow.test.js` — TS-05: 13 pasos end-to-end con validación JWT
- `tests/integration/nutrition.test.js` + `tests/integration/progress.test.js` — TS-06: aislamiento de usuario (403), flag `needs_plan_regeneration`
- `.github/workflows/tests.yml` — TS-07: CI con servicios postgres+redis, threshold 80%, artefacto HTML de cobertura
- `tests/load/planGeneration.js` + `tests/LOAD_TEST_REPORT.md` — TS-08: autocannon, objetivo p99 < 2s
- `backend/jest.config.js` — configuración Jest con rutas de cobertura
- Scripts añadidos a `package.json`: `test:integration`, `test:e2e`, `test:coverage`, `test:load`

---

## Fase 10 — COMPLETADA (2026-08-28): Integración dataset de ejercicios reales

### Qué se construyó

Integración de 1.324 ejercicios reales del dataset `hasaneyldrm/exercises-dataset` en el sistema de generación de planes. A partir de esta fase, Claude usa ejercicios del catálogo real de la base de datos en lugar de inventarlos.

#### Database (DB-EX-01/02/03)

- **`backend/prisma/schema.prisma`** — Modelo `Exercise` ampliado con 11 campos nuevos: `externalId`, `category`, `bodyPart`, `target`, `secondaryMuscles`, `instructionsEs`, `instructionsEn`, `gifUrl`, `thumbnailUrl`, `equipment`, `createdAt`. Campos legacy mantenidos como nullable.
- **`backend/prisma/migrations/20260828_add_exercise_dataset_fields/migration.sql`** — Migración SQL con `ALTER TABLE IF NOT EXISTS` más índices en `category`, `equipment`, `target`, `bodyPart`, `externalId`.
- **`database/seedExercises.js`** — Script de seed que descarga el catálogo desde GitHub y lo inserta en batches de 100 con `skipDuplicates: true`.

#### Backend (BE-EX-01/02/03/04)

- **`backend/src/services/exerciseSelector.service.js`** — Servicio nuevo con `getExercisesForProfile(profile, limit=80)` y `formatExercisesForPrompt(exercises)`. Filtra por equipamiento (EQUIPMENT_MAP), objetivo (GOAL_TO_CATEGORIES), dificultad (DIFFICULTY_MAP) y lesiones (INJURY_ZONES). Singleton Prisma con PrismaPg+Pool.
- **`backend/src/controllers/onboarding.controller.js`** — Función `complete()` actualizada: llama a `exerciseSelector` antes de `generatePlan` y pasa el catálogo como quinto parámetro.
- **`backend/src/controllers/plans.controller.js`** — Función `regeneratePlan()` actualizada con la misma integración.
- **`backend/src/routes/exercises.routes.js`** — Rutas nuevas: `GET /exercises` (con filtros: category, equipment, difficulty, target, limit, offset) y `GET /exercises/:id`, ambas protegidas con auth.
- **`backend/src/app.js`** — Ruta `/exercises` registrada con rate limiter.

#### IA (AI-EX-01/02)

- **`backend/src/services/aiService.js`** — `SYSTEM_PROMPT` con nueva sección `## CATÁLOGO DE EJERCICIOS` que instruye a Claude a usar únicamente los ejercicios del catálogo. `buildUserContextPrompt()` acepta nuevo parámetro `exercises=[]` y genera sección de catálogo cuando hay ejercicios disponibles. `formatExercisesForPrompt()` exportada para testing.

#### Tests (TEST-EX-01/02/03)

- **`tests/unit/exerciseSelector.test.js`** — 18 tests unitarios con mocks Prisma.
- **`tests/unit/exercisePrompt.test.js`** — 19 tests del formateo del catálogo en el prompt.
- **`tests/integration/exercises.routes.test.js`** — 27 tests de integración con Supertest.
- **`backend/jest.config.js`** — `modulePaths: ['<rootDir>/node_modules']` añadido para resolución de módulos.

**Resultado final: 317/317 tests pasando — 89.18% cobertura de líneas.**

### Decisión técnica: RAG-lite vs RAG vectorial

Se optó por filtrado SQL estructurado (RAG-lite) en lugar de búsqueda vectorial. El catálogo tiene metadatos bien definidos (category, bodyPart, equipment, target) que se mapean directamente a las preferencias del usuario (equipamiento, objetivo, nivel, lesiones). No se requiere búsqueda semántica para esta correspondencia.

### Commit principal

`40bdb9d` — integración completa de la Fase 10.

---

## Sesión 2026-10-11 — COMPLETADA: Rediseño Apple Design (A-7) + botón regenerar plan

### Qué se construyó

#### Botón "Regenerar mi plan" en ProfileScreen (commit f03a358)

El usuario puede solicitar un nuevo plan de IA directamente desde su perfil sin necesidad de registrar progreso. El flujo incluye:
- Confirmación previa (modal de confirmación)
- Estado de carga durante la generación
- Feedback de éxito o error al completar

#### Nuevo build APK Android (EAS Build `94110d29`)

- Perfil: preview (staging) — Android APK
- URL: https://expo.dev/accounts/trutool/projects/healthy/builds/94110d29-1abd-4e17-ac05-229af0c9350c

#### Agente apple-design + skills emilkowalski

Nuevo agente especializado en diseño Apple con dos skills de calidad:

- **`.claude/skills/apple-design.md`** — 17 principios WWDC (basado en emilkowalski/skills, 45k estrellas): press feedback, springs, haptics, reduced motion, ProMotion 120fps, touch targets 44pt.
- **`.claude/skills/animate-expo.md`** — Patrones de animación Reanimated 4 para React Native: `useSharedValue`, springs, `FadeIn/FadeInDown`, `LinearTransition`, `ReduceMotion.System`.
- **`agents/apple-design/CLAUDE.md`** — Agente con modo auditoría (genera informe) + modo implementación (aplica tareas atómicas AD-{n}).

#### Rediseño Apple Design completo (A-7) — 39 tareas en 7 fases

| Fase | Descripción | Tareas |
|------|-------------|--------|
| **Fase 0** | Setup: `react-native-gesture-handler` + `expo-haptics`, `GestureHandlerRootView`, `CADisableMinimumFrameDurationOnPhone` (120fps) | 3 |
| **Fase 1** | Tokens: `letterSpacing` por tamaño tipográfico, label Input sin layout pass (Reanimated `transform+scale`), ProgressBar con `scaleX` | 3 |
| **Fase 2** | Interacción: press feedback `scale(0.97) 120ms` en 17 componentes/pantallas, haptics con `expo-haptics` (Light/Medium/Success/Selection) | 17 |
| **Fase 3** | Navegación: tab bar sin bounce, bottom sheets drag-to-dismiss con `Gesture.Pan` + rubber-banding + velocity handoff, RegenModal con spring FadeIn | 4 |
| **Fase 4** | Pantallas principales: skeleton→crossfade, ProgressRing con `useAnimatedProps`, WorkoutCard con `interpolateColor`, MealCard con `LinearTransition` | 8 |
| **Fase 5** | Onboarding: stagger `FadeInDown` 40-60ms/item en Goal/Lifestyle/Motivation, spinner Reanimated en Complete, spring bounce + haptic `NotificationFeedbackType.Success` | 5 |
| **Fase 6** | Pulido: `ReduceMotion.System` en todos los springs críticos, Toast migrado a Reanimated con `useReducedMotion()`, ProgressRing stagger con prop `index` | 4 |

**Resultado:** 454/454 tests ✅ — sin regresiones.

### Decisiones técnicas

| Decisión | Justificación |
|----------|---------------|
| Reanimated 4 sobre Core Animated | Todas las animaciones corren en el UI thread (sin JS bridge), eliminando jank durante la renderización de listas largas |
| `scale(0.97)` como feedback universal | Patrón Apple estándar: sutil, consistente, menos intrusivo que el `opacity(0.5)` previo |
| Rubber-banding en sheets | Reproduce el comportamiento nativo de iOS cuando el usuario intenta arrastrar más allá del límite superior |
| `ReduceMotion.System` en lugar de constante | Respeta la configuración de accesibilidad del dispositivo (iOS: Reduce Motion; Android: Disable animations) |
| Tareas atómicas AD-{n} (1 archivo) | Permite revisar y revertir cambios individuales sin afectar el resto del rediseño |

### Archivos modificados en A-7

Los principales grupos de cambios:

```
frontend/src/
├── theme/typography.ts          ← letterSpacing por tamaño
├── components/ui/
│   ├── Button.tsx               ← Reanimated press feedback
│   ├── Card.tsx                 ← Reanimated press feedback
│   ├── Input.tsx                ← label animado sin layout pass
│   ├── ProgressBar.tsx          ← scaleX en lugar de width string
│   ├── ProgressRing.tsx         ← useAnimatedProps + stagger
│   ├── WorkoutCard.tsx          ← interpolateColor + press feedback
│   ├── MetricCard.tsx           ← dead-code eliminado
│   ├── MealCard.tsx             ← LinearTransition expand/collapse
│   ├── DailyLogWidget.tsx       ← haptic + press feedback
│   └── Toast.tsx                ← Reanimated + useReducedMotion()
├── navigation/MainTabNavigator.tsx  ← sin bounce en tab press
├── screens/app/
│   ├── HomeScreen.tsx           ← skeleton→crossfade
│   ├── TrainingScreen.tsx       ← bottom sheet + haptic completar sesión
│   ├── ProgressScreen.tsx       ← bottom sheet + RegenModal spring
│   └── ProfileScreen.tsx        ← botón "Regenerar mi plan"
└── screens/onboarding/
    ├── OnboardingGoal.tsx        ← stagger FadeInDown
    ├── OnboardingLifestyle.tsx   ← stagger FadeInDown
    ├── OnboardingMotivation.tsx  ← stagger + haptic chips
    ├── OnboardingComplete.tsx    ← spinner Reanimated + success spring
    └── OnboardingLayout.tsx     ← touch target backBtn corregido a 44pt

agents/apple-design/CLAUDE.md    ← agente nuevo
.claude/skills/apple-design.md   ← skill nuevo
.claude/skills/animate-expo.md   ← skill nuevo
```

---

## Fase 5 — PENDIENTE: Lanzamiento

<!-- TODO: Actualizar al completar la fase -->

### Checklist de lanzamiento (borrador)

- [ ] App Store Connect — cuenta y app creada
- [ ] Google Play Console — cuenta y app creada
- [ ] Revisión legal: Política de Privacidad, Términos de Uso, DPO RGPD
- [ ] Revisión de seguridad: penetration testing
- [ ] Performance testing: carga en la API
- [ ] URLs reales en botones de la landing (App Store + Google Play)
- [ ] Backups automáticos de PostgreSQL activados en Railway
- [ ] Alertas configuradas (UptimeRobot + notificaciones Railway)
- [ ] Runbook de incidentes documentado

---

*Última actualización: 2026-10-11 — Docs Agent (sesión 2026-10-11: rediseño Apple Design A-7 completado, botón regenerar plan, build APK 94110d29)*
