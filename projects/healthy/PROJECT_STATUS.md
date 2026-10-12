# PROJECT STATUS — Healthy App

> Archivo de estado del proyecto. El agente orquestador lo lee al iniciar cada sesión
> y lo actualiza al finalizar. Es la fuente de verdad del proyecto.
>
> Ultima actualización: 2026-10-12 | Sesión: Bug fix onboarding/complete (const→let). Nuevo APK build 39e44a5e con rediseño Apple Design. Docs actualizados.

---

## Estado general

| Campo | Valor |
|-------|-------|
| Fase actual | Sesión 2026-10-12 — Bug fix onboarding, nuevo APK con rediseño, docs actualizados |
| Rama activa | develop — commit `72d38af` (fix onboarding const→let) |
| Backend staging | ✅ ACTIVO — `backend-staging-01ee.up.railway.app` (desplegado 2026-10-12) |
| Tests | 454/454 pasando — lineas 96.78% / branches 85.01% |
| APK Android | ✅ Build `39e44a5e` disponible — rediseño Apple Design completo |
| Siguiente accion inmediata | **M-17** — Confirmar seed foods (`GET /foods/search?q=pollo`) → **M-18** — Probar APK `39e44a5e` en dispositivo → **M-19** — Google Play Internal Testing |

---

## Infraestructura

| Componente | Solucion | Estado |
|------------|----------|--------|
| Backend Node.js | Railway healthy-staging | ✅ ACTIVO — verificado 2026-09-06 |
| PostgreSQL | Railway PostgreSQL plugin | ✅ ACTIVO — db:connected |
| Redis | Railway Redis plugin | ✅ ACTIVO — redis:connected |
| Landing page | AWS S3 + CloudFront | ✅ OK — produccion |
| CI/CD backend | GitHub Actions → Railway CLI | ✅ OK |
| ANTHROPIC_API_KEY | Variable Railway staging | ✅ Configurado — créditos activos (M-11b completada) |
| App Android | EAS Build (Expo) | ✅ APK disponible — Build `39e44a5e` (rediseño Apple Design A-7, lanzado 2026-10-12) |
| App iOS | EAS Build (Expo) | ❌ APLAZADO indefinidamente |

**IDs Railway:**
- Proyecto: `a01d9f3d-510b-4529-b75a-d9d7198cbcb5`
- Service staging: `fa137c98-5210-4057-a531-f1c7fbf39743`
- Env staging: `1bc84954-5618-44fd-98fc-5b4190523cf0`

**Expo:**
- Cuenta: `trutool` | Project ID: `aea3d849-76a5-48a2-950f-936ee2422eee`

---

## Tareas pendientes — MANUALES (Antonio)

| ID | Tarea | Prioridad | Estado |
|----|-------|-----------|--------|
| M-1 | Actualizar Railway a plan Hobby en railway.app ($5/mes) | CRITICO | ✅ Completada |
| M-1b | Despertar servicios Railway — redeploy staging | CRITICO | ✅ Completada |
| M-2 | Verificar build Android: `eas build:list --limit 1 --platform android` | CRITICO | ✅ Completada |
| M-3 | Build Android EAS con deps corregidas | CRITICO | ✅ Completada — APK build 5befc66f (commit 9d8522a) en https://expo.dev/artifacts/eas/WqEK5PmpORXPgcL1DFnT-6hQ-YRAZlxsrVjqcU-Xo6c.apk |
| M-4 | Ejecutar seed de ejercicios: `node projects/healthy/database/seedExercises.js` con DATABASE_URL de Railway | IMPORTANTE | Pendiente |
| M-5 | Registrar Bundle ID `com.healthy.app` en developer.apple.com | APLAZADO | ❌ APLAZADO indefinidamente — sin publicación iOS |
| M-6 | Crear app en App Store Connect para iOS | APLAZADO | ❌ APLAZADO indefinidamente — sin publicación iOS |
| M-7 | Instalar y probar APK en dispositivo Android real | IMPORTANTE | **EN CURSO** — Antonio probando APK en dispositivo Android |
| M-8 | Publicar APK en Google Play Console → Internal Testing | IMPORTANTE | Pendiente (depende M-7) — ver docs/PUBLISHING_GUIDE.md |
| M-9 | Configurar dominio `api.healthy.app` → Railway en panel DNS | PRO FINAL | Pendiente |
| M-10 | Lighthouse landing | PRO FINAL | ✅ Completada — Acc/SEO corregidos (A-Landing completada). Perf 95-98, Acc 95+, SEO 95+. Lighthouse real con URL pública pendiente de M-9 (DNS) |
| M-11 | Configurar ANTHROPIC_API_KEY en Railway staging variables de entorno | CRITICO | ✅ Completada — configurado en staging |
| M-11b | Añadir créditos a cuenta Anthropic (console.anthropic.com → Plans & Billing) | CRITICO | ✅ Completada — verificado via /health/ai → success:true |
| M-12 | Re-ejecutar CP-01..CP-10 con IA activa | IMPORTANTE | ✅ Completada — score 23/50 (2 CPs con IA real: CP-07, CP-08; ver detalle sesión 2026-10-09) |
| M-13 | Aprobar y mergear PR develop → main en GitHub | RELEASE | Pendiente |
| M-14 | Crear tag v1.0.0: `git tag v1.0.0 && git push origin v1.0.0` | RELEASE | Pendiente (depende M-13) |
| M-15 | Diseñar e implementar icono de la app | IMPORTANTE | Pendiente — sustituir `assets/icon.png` (1024×1024px) y `assets/adaptive-icon.png` (sin fondo) y lanzar nuevo build EAS |
| M-16 | Poblar tabla foods en Railway staging con 3 scripts: `seed-foods.js` (128 alimentos base) + `import-usda.js` (200+ USDA) + `import-openfoodfacts.js` (700+ Open Food Facts, requiere servicio activo). Objetivo: ~1.000 alimentos. | CRITICO | **EN CURSO** — Antonio ejecutando seeds con DATABASE_PUBLIC_URL de Railway |
| M-17 | Confirmar M-16 completada: `GET /foods/search?q=pollo` debe devolver resultados (no `{ foods: [], total: 0 }`) | CRITICO | Pendiente — primera acción próxima sesión |
| M-18 | Instalar nuevo APK (build `39e44a5e`, rediseño Apple Design) y probar: press feedback escala 0.97, tab bar sin bounce, bottom sheets drag-to-dismiss en Training y Progress, stagger onboarding, haptic feedback | IMPORTANTE | Pendiente — APK disponible en expo.dev/accounts/trutool/projects/healthy/builds/39e44a5e-8692-4f98-b46a-3b1077ee935d |
| M-19 | Publicar APK en Google Play Console → Internal Testing | IMPORTANTE | Pendiente (depende M-18) |

## Tareas pendientes — AUTOMATICAS (agentes)

| ID | Tarea | Agente | Estado | Depende de |
|----|-------|--------|--------|------------|
| A-1 | Mejorar branch coverage de 69.57% a 80%+ | Tests Agent | ✅ Completada — 85.01% / 454 tests | Nada |
| A-2 | Build iOS en EAS: `eas build --platform ios --profile preview` | DevOps Agent | ❌ APLAZADO | Sin publicación iOS por ahora |
| A-3 | Subir a TestFlight: `eas submit --platform ios` | DevOps Agent | ❌ APLAZADO | Sin publicación iOS por ahora |
| A-4 | Deploy a Railway tras merge a main | CI/CD GitHub Actions | Pendiente | M-13 |
| A-5 | Generar documentacion API (Swagger/OpenAPI) con endpoint /exercises | Docs Agent | ✅ Completada — swagger.yaml 40 endpoints | Nada |
| A-Landing | Corregir Accessibility y SEO landing (scores actuales 82-88 → 95+) | Frontend Agent | ✅ Completada — Acc/SEO corregidos (sesión 2026-10-10) | Nada |
| A-6 | **Expansión de micronutrientes completos**: (1) Ampliar modelo Prisma `Food` con fiber, sugar, saturated_fat, sodium, potassium, calcium, iron, vitamin_c, vitamin_d, vitamin_b12 + migración; (2) Actualizar `import-usda.js` para capturar todos los nutrientes USDA disponibles; (3) Actualizar `foods.controller.js` para devolver nuevos campos; (4) Modificar frontend `NutritionScreen` y `FoodDetailScreen` para mostrar tabla de micronutrientes (calorías, macros, fibra, azúcares, grasas saturadas, sodio, calcio, hierro, vitaminas). Referencia commits: seed 61a3729, import 93e470a | Backend + Database + Frontend Agents | Pendiente — planificar con orquestador | M-16 |
| **A-7** | **Rediseño Apple Design** — Ver sección detallada abajo | Apple-Design Agent | ✅ **COMPLETADA** — 39 tareas en 7 fases, 454/454 tests, APK build 94110d29 | Nada |

---

## A-7 — Rediseño Apple Design (detalle) ✅ COMPLETADA — 2026-10-11

**Objetivo:** Rediseñar el frontend de Healthy aplicando los 17 principios de Apple Design
(WWDC 2018/2020/2026) y las mejores prácticas de animación nativa para Expo/React Native.

**Agente responsable:** `apple-design` (skills: `apple-design.md` + `animate-expo.md`)

**Skills instalados en:** `.claude/skills/apple-design.md` + `.claude/skills/animate-expo.md`

**Resultado final:** 39/39 tareas completadas · 454/454 tests ✅ · APK build `94110d29` generado

### Flujo de trabajo para el orquestador

```
PASO 1 → Invocar apple-design en MODO AUDITORÍA
         El agente genera: apple-design-audit.md + tareas AD-{n}

PASO 2 → Orquestador lee la auditoría y valida las tareas AD-{n}
         Reorganiza prioridades en este archivo

PASO 3 → Invocar apple-design en MODO IMPLEMENTACIÓN (tarea por tarea)
         Orden: Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5

PASO 4 → Tests Agent: verificar que nada se rompió
PASO 5 → DevOps Agent: nuevo build EAS con los cambios
```

### Fase 0 — Setup de dependencias (pre-auditoría — ya listo para ejecutar)

| ID | Tarea | Estado |
|----|-------|--------|
| AD-0a | `npx expo install react-native-reanimated react-native-worklets react-native-gesture-handler expo-haptics` | ✅ Completada |
| AD-0b | Envolver app root con `GestureHandlerRootView` en `_layout.tsx` | ✅ Completada |
| AD-0c | Añadir `CADisableMinimumFrameDurationOnPhone: true` en `app.json` (120fps ProMotion) | ✅ Completada |

### Auditoría completada — 2026-10-11

Informe completo en: `projects/healthy/apple-design-audit.md`
**10 hallazgos críticos · 13 hallazgos moderados · 6 oportunidades de delight · 39 tareas**

---

### Fase 1 — Sistema de diseño (tokens + componentes base)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-1a | Añadir letterSpacing a bodyLarge (0.15), bodyNormal (0.1), caption (0.25) | `src/theme/typography.ts` | S | ✅ Completada |
| AD-1b | Migrar animación de label flotante de fontSize a transform+scale (sin layout pass) | `src/components/ui/Input.tsx` | M | ✅ Completada |
| AD-1c | Migrar ProgressBar de animar `width` string a `scaleX` transform | `src/components/ui/ProgressBar.tsx` | S | ✅ Completada |

---

### Fase 2 — Interacción (press feedback, haptics)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-2a | Migrar Button a Reanimated CSS transition (cubic-bezier 0.23,1,0.32,1 / 120ms) | `src/components/ui/Button.tsx` | M | ✅ Completada |
| AD-2b | Migrar Card press feedback a Reanimated | `src/components/ui/Card.tsx` | S | ✅ Completada |
| AD-2c | Migrar WorkoutCard press feedback a Reanimated | `src/components/ui/WorkoutCard.tsx` | S | ✅ Completada |
| AD-2d | Migrar MetricCard press feedback a Reanimated | `src/components/ui/MetricCard.tsx` | S | ✅ Completada |
| AD-2e | Añadir press feedback (scale 0.97) a SelectCard onboarding | `src/screens/onboarding/SelectCard.tsx` | S | ✅ Completada |
| AD-2f | Añadir press feedback + haptic Light al botón +250ml de DailyLogWidget | `src/components/ui/DailyLogWidget.tsx` | S | ✅ Completada |
| AD-2g | Añadir press feedback a tarjeta workout en HomeScreen | `src/screens/app/HomeScreen.tsx` | S | ✅ Completada |
| AD-2h | Reemplazar TouchableOpacity → Pressable en LoginScreen | `src/screens/auth/LoginScreen.tsx` | S | ✅ Completada |
| AD-2i | Reemplazar TouchableOpacity → Pressable en RegisterScreen | `src/screens/auth/RegisterScreen.tsx` | S | ✅ Completada |
| AD-2j | Reemplazar TouchableOpacity → Pressable en SetPasswordScreen | `src/screens/auth/SetPasswordScreen.tsx` | S | ✅ Completada |
| AD-2k | Reemplazar TouchableOpacity → Pressable en ForgotPasswordScreen | `src/screens/auth/ForgotPasswordScreen.tsx` | S | ✅ Completada |
| AD-2l | Reemplazar TouchableOpacity → Pressable en ProfileScreen | `src/screens/app/ProfileScreen.tsx` | S | ✅ Completada |
| AD-2m | Reemplazar TouchableOpacity → Pressable en ProgressScreen + añadir scale | `src/screens/app/ProgressScreen.tsx` | S | ✅ Completada |
| AD-2n | Añadir haptic (notificationAsync.Success) al completar sesión de entrenamiento | `src/screens/app/TrainingScreen.tsx` | S | ✅ Completada |
| AD-2o | Añadir haptic (impactAsync.Light) al marcar ejercicio completado (ExerciseRow) | `src/components/ui/WorkoutCard.tsx` | S | ✅ Completada |
| AD-2p | Añadir haptic + press feedback a chips de motivación en OnboardingMotivation | `src/screens/onboarding/OnboardingMotivation.tsx` | S | ✅ Completada |
| AD-2q | Corregir touch target backBtn de 36pt a 44pt en OnboardingLayout | `src/screens/onboarding/OnboardingLayout.tsx` | S | ✅ Completada |

---

### Fase 3 — Navegación (tab bar, modales, sheets)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-3a | Eliminar bounce scale en tab press (C-03) — mantener solo icono + dot como feedback | `src/navigation/MainTabNavigator.tsx` | S | ✅ Completada |
| AD-3b | Reemplazar SetModal (TrainingScreen) con bottom sheet Reanimated + drag-to-dismiss | `src/screens/app/TrainingScreen.tsx` | L | ✅ Completada |
| AD-3c | Reemplazar ProgressModal con bottom sheet Reanimated + drag-to-dismiss | `src/screens/app/ProgressScreen.tsx` | L | ✅ Completada |
| AD-3d | Reemplazar RegenModal con modal centered Reanimated (fade + scale spring) | `src/screens/app/ProgressScreen.tsx` | M | ✅ Completada |

---

### Fase 4 — Pantallas principales (Home, Training, Nutrition, Progress, Profile)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-4a | Migrar SkeletonBlock de Core Animated a Reanimated (UI thread) | `src/screens/app/HomeScreen.tsx` | S | ✅ Completada |
| AD-4b | Añadir crossfade skeleton→contenido con Reanimated FadeIn/FadeOut | `src/screens/app/HomeScreen.tsx` | M | ✅ Completada |
| AD-4c | Migrar pulso de progreso (pct > 0.5) a Reanimated withRepeat | `src/screens/app/TrainingScreen.tsx` | S | ✅ Completada |
| AD-4d | Migrar ProgressRing `strokeDashoffset` de Core Animated a Reanimated useAnimatedProps | `src/components/ui/ProgressRing.tsx` | M | ✅ Completada |
| AD-4e | Eliminar dead-code `scoreAnim` en RecoveryScore (no se usa visualmente) | `src/components/ui/MetricCard.tsx` | S | ✅ Completada |
| AD-4f | Migrar ExerciseRow color interpolation a Reanimated interpolateColor | `src/components/ui/WorkoutCard.tsx` | M | ✅ Completada |
| AD-4g | Migrar ExerciseRow scale feedback de timing a Reanimated withSpring | `src/components/ui/WorkoutCard.tsx` | S | ✅ Completada |
| AD-4h | Añadir Layout animation (LinearTransition) a MealCard expand/collapse | `src/components/ui/MealCard.tsx` | M | ✅ Completada |

---

### Fase 5 — Onboarding y Auth (flujos de entrada)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-5a | Añadir FadeInDown stagger (50ms/card) a SelectCard en OnboardingGoal | `src/screens/onboarding/OnboardingGoal.tsx` | S | ✅ Completada |
| AD-5b | Añadir FadeInDown stagger a opciones en OnboardingLifestyle | `src/screens/onboarding/OnboardingLifestyle.tsx` | S | ✅ Completada |
| AD-5c | Añadir FadeInDown stagger a chips de motivación en OnboardingMotivation | `src/screens/onboarding/OnboardingMotivation.tsx` | S | ✅ Completada |
| AD-5d | Migrar spinner de OnboardingComplete a Reanimated (mantiene useNativeDriver: true) | `src/screens/onboarding/OnboardingComplete.tsx` | S | ✅ Completada |
| AD-5e | Añadir spring bounce al círculo de éxito en OnboardingComplete + haptic Success | `src/screens/onboarding/OnboardingComplete.tsx` | S | ✅ Completada |

---

### Fase 6 — Pulido (reduced motion, accesibilidad, 120fps)

| ID | Tarea | Archivo | Esfuerzo | Estado |
|----|-------|---------|----------|--------|
| AD-6a | Añadir `reduceMotion: ReduceMotion.System` a todos los withSpring/withTiming críticos | Múltiples | M | ✅ Completada |
| AD-6b | Añadir `useReducedMotion()` en componentes con animaciones de posición/slide (Toast, sheets) | `src/components/ui/Toast.tsx`, sheets | M | ✅ Completada |
| AD-6c | Migrar Toast de Core Animated translateY a Reanimated (interruptible) | `src/components/ui/Toast.tsx` | M | ✅ Completada |
| AD-6d | Añadir stagger FadeIn a ActivityRings al montar ProgressScreen | `src/components/ui/ProgressRing.tsx` | S | ✅ Completada |

---

### Cómo iniciar la implementación

```
ORDEN: Fase 0 (AD-0a, AD-0b, AD-0c) → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5 → Fase 6
Las fases 0-2 son las más críticas para la sensación nativa.
Cada tarea AD-{n} es atómica: un archivo, un componente.
```

---

## Checklist Go-live

| Criterio | Objetivo | Estado |
|----------|----------|--------|
| Tests lineas | >= 80% | ✅ OK — 96.78% |
| Tests branches | >= 80% | ✅ OK — 85.01% |
| Lighthouse landing | >= 95 | ✅ OK — A-Landing completada, Acc/SEO corregidos |
| App Android Google Play Internal | Publicada | ⚠️ M-7 EN CURSO — APK en prueba en dispositivo real; M-8 pendiente |
| App iOS TestFlight | Publicada | ❌ APLAZADO indefinidamente — sin publicación iOS |
| Backend staging operativo | Activo | ✅ ACTIVO |
| ANTHROPIC_API_KEY en staging | Configurado | ✅ Configurado |
| Créditos Anthropic | Disponibles | ✅ ACTIVO — M-11b completada, /health/ai confirma success:true |
| Seed 1.324 ejercicios ejecutado | Completo | PENDIENTE — ejecutar M-4 |
| CP-01..CP-10 con IA activa | 8+/10 | ⚠️ PARCIAL — score 23/50; IA real en 2/10 CPs; 7 CPs con caché Redis fallback; ver sesión 2026-10-09 |
| Tag v1.0.0 | Creado | PENDIENTE |

---

## Historial de fases completadas

| Fase | Descripcion | Commit | Fecha |
|------|-------------|--------|-------|
| Fase 1-4 | Auth, onboarding, planes, entrenamiento | — | 2026-06 |
| Fase 5 | Deploy Railway staging | — | 2026-07 |
| Fase 6 | Variables de entorno Railway | — | 2026-07 |
| Fase 7 | Tests 253/253 — cobertura 88.21% | — | 2026-07 |
| Fase 8 | Build Android (EAS) | — | 2026-07 |
| Fase 9 | Entregables de evaluacion AI | — | 2026-07 |
| Fase 10 | Integracion 1.324 ejercicios reales | 40bdb9d | 2026-08-28 |
| Fase 10b | Tests 454/454 — lineas 96.78% / branches 85.01% / Swagger 40 endpoints | fab1dad | 2026-08-31 |
| Sesion 2026-09-02a | RGPD Art.9 consentimiento explícito (frontend checkbox + backend log) | pendiente commit | 2026-09-02 |
| Sesion 2026-09-02b | Evaluacion CP-01..CP-10 contra staging. Endpoints debug auth (/dev/code, /dev/auto-verify). Informe EVALUATION_DELIVERABLES actualizado. Lighthouse M-10 completado. | 87d13f7 | 2026-09-02 |
| Sesion 2026-09-06 | Bug fix Claude API (SYSTEM_PROMPT mal posicionado). ANTHROPIC_API_KEY configurado en Railway. Endpoint /health/ai diagnóstico. Créditos Anthropic: "credit balance is too low" detectado. CP tests re-ejecutados con fallback (score 35/50). M-11b identificado como bloqueante crítico. | df455ac | 2026-09-06 |
| Sesion 2026-10-09 | M-3: build Android 5befc66f in progress (EAS). M-11b confirmada: /health/ai → success:true, IA activa. M-12: CP-01..CP-10 re-ejecutados (score 23/50). IA real confirmada en CP-07 y CP-08. 7 CPs con caché Redis fallback (usuarios eval_20261009_XX heredaron planes del día de la sesión). Causa: cache Redis TTL 24h impide regenerar planes el mismo día. | pendiente | 2026-10-09 |
| Sesion 2026-10-10a | M-3 ✅ confirmada — APK build 5befc66f (commit 9d8522a) listo. M-7 EN CURSO — APK instalado en emulador Android Studio (adb install). A-Landing ✅ completada — Acc/SEO corregidos. PUBLISHING_GUIDE.md creado. M-15 añadida: diseñar icono de la app. | pendiente | 2026-10-10 |
| Sesion 2026-10-10b | Investigación BD alimentos: BEDCA bloqueada, USDA ✅ gratuita. Creados `seed-foods.js` (128 alimentos ES, commit 61a3729), `import-usda.js` (200+ ES→USDA, commit 93e470a), `import-openfoodfacts.js` (20 categorías × 60 productos, commit e392cb5 + retry 503 en 1cc12b8). Fix Prisma client path en scripts seed. .gitignore actualizado. M-16 EN CURSO. A-6 planificada. | e8924f1 | 2026-10-10 |
| Sesion 2026-10-12 | Bug fix crítico `onboarding/complete`: `const→let` en destructuring línea 163 causaba `TypeError: Assignment to constant variable` cuando el usuario enviaba datos del onboarding directamente al endpoint final. Fix commit `72d38af`, desplegado a Railway. Nuevo APK `39e44a5e` con rediseño Apple Design completo generado via EAS Build. Docs actualizados (README, ai-architecture, architecture-web, PROGRESS, PROJECT_STATUS). Tareas M-17/M-18/M-19 añadidas como arranque próxima sesión. Investigación autenticación staging: SMTP no configurado, usar `/auth/dev/auto-verify` con `Content-Type: application/json`. | 72d38af | 2026-10-12 |
| Sesion 2026-10-11 | A-7 ✅ COMPLETADA — rediseño Apple Design en 39 tareas / 7 fases: Fase 0 (Reanimated 4 + Gesture Handler + expo-haptics + 120fps ProMotion), Fase 1 (letterSpacing, Input label sin layout pass, ProgressBar scaleX), Fase 2 (press feedback scale 0.97 + haptics en 17 componentes/pantallas), Fase 3 (tab bar sin bounce, bottom sheets drag-to-dismiss, RegenModal spring), Fase 4 (skeleton→crossfade, ProgressRing useAnimatedProps, WorkoutCard interpolateColor, MealCard LinearTransition), Fase 5 (stagger FadeInDown onboarding, spinner Reanimated, success spring + haptic), Fase 6 (ReduceMotion.System, Toast Reanimated, ProgressRing stagger). Botón "Regenerar mi plan" en ProfileScreen (commit f03a358). Nuevo build APK 94110d29. Agente apple-design + skills emilkowalski instalados. 454/454 tests ✅. | f03a358 | 2026-10-11 |

### Sesion 2026-10-09 — Detalle tecnico

**M-3 Estado build Android:**

| Campo | Valor |
|-------|-------|
| Build ID | 5befc66f-5958-40f2-86a2-60d1b5ae4861 |
| Plataforma | Android |
| Status | in progress |
| Perfil | preview (internal distribution) |
| SDK | 54.0.0 |
| Version | 1.0.0 (versionCode 1) |
| Iniciado | 2026-09-10 20:58:10 |
| Accion requerida | Verificar si ha terminado: `eas build:list --limit 1 --platform android` |

**M-12 Resultados CP-01..CP-10 (sesion 2026-10-09, con IA activa):**

| CP | Descripcion | Resultado | Cals | Protein | Sessions/wk | Modelo | Score |
|----|-------------|-----------|------|---------|-------------|--------|-------|
| CP-01 | Mujer sedentaria, perder peso | PASA | 1300 | 89g | 3 | fallback-rules-v1 | 5/5 |
| CP-02 | Hombre activo, ganar musculo | FALLA (cals 1520 vs >3200) | 1520 | 103g | 4 | fallback-rules-v1 | 0/5 |
| CP-03 | Lesion rodilla | NO EVALUABLE (sin IA) | 1300 | 89g | 3 | fallback-rules-v1 | 2/5 |
| CP-04 | Vegano | ERROR (onboarding bloqueado) | 0 | 0g | 0 | - | 0/5 |
| CP-05 | Diabetes tipo 2 | PARCIAL (carbs=145g OK) | 1300 | 89g | 3 | fallback-rules-v1 | 3/5 |
| CP-06 | Sin equipamiento | NO EVALUABLE (sin IA) | 1300 | 89g | 4 | fallback-rules-v1 | 2/5 |
| CP-07 | Tiempo limitado | PASA (IA real!) | 2324 | 160g | 3 | claude-sonnet-4-6 | 5/5 |
| CP-08 | Regeneracion estancamiento | PASA (IA real!) | 1346 | 122g | 4 | claude-sonnet-4-6 | 5/5 |
| CP-09 | Atleta avanzado | FALLA (cals 1520 vs >3500) | 1520 | 103g | 5 | fallback-rules-v1 | 0/5 |
| CP-10 | Multiples restricciones | FALLA (restricciones no verificadas) | 1300 | 89g | 3 | fallback-rules-v1 | 1/5 |

**Puntuacion sesion 2026-10-09:** 23/50

**Causa raiz del bajo score:**
- La cache Redis (TTL 24h, clave `plan:userId:fecha`) almacena el plan generado (sea AI o fallback) para todo el dia
- Los usuarios `eval_20261009_XX` 1-6 y 9-10 obtuvieron un plan fallback durante el primer intento del dia (registro con timeout = posible error AI transitorio)
- Solo CP-07 y CP-08 llegaron frescos a Claude con exito
- IA CONFIRMADA FUNCIONANDO: CP-07 (TDEE 2330 kcal mantenimiento) y CP-08 (target 1350 kcal perdida peso) son correctos
- Para score completo: ejecutar con usuarios con emails de dia siguiente o usar `POST /plans/regenerate` que evita cache

---

### Fase 10 — Detalle tecnico (2026-08-28)

- `exerciseSelector.service.js`: filtra ejercicios por equipamiento, objetivo, dificultad y lesiones (hasta 80 por peticion)
- `GET /exercises`: endpoint nuevo con filtros category, equipment, difficulty, target, limit, offset
- `buildUserContextPrompt`: acepta parametro exercises[] — Claude usa SOLO ejercicios del catalogo real
- Schema Exercise: 11 campos nuevos (externalId, category, bodyPart, target, secondaryMuscles, instructionsEs/En, gifUrl, thumbnailUrl, equipment, createdAt)
- Seed: `node projects/healthy/database/seedExercises.js` — descarga desde GitHub, batch 100, skipDuplicates
- 64 tests nuevos → total 317/317

### Sesion 2026-09-06 — Detalle tecnico

**Endpoints nuevos añadidos al backend:**

| Commit | Descripcion |
|--------|-------------|
| a4ee6d1 | `GET /auth/dev/code?email=xxx` — devuelve OTP en staging/dev (bloqueado en production) |
| 87d13f7 | `POST /auth/dev/auto-verify` — verifica email y crea contraseña en un paso (staging/dev) |
| 888a695 | Resultados CP-01..CP-10 documentados en EVALUATION_DELIVERABLES.md + run_cp_tests.py |
| 035afc3 | **FIX CRITICO**: Bug en llamada Claude API corregido — SYSTEM_PROMPT estaba en mensaje de usuario en lugar del parámetro `system` |
| df455ac | `GET /health/ai` — endpoint diagnóstico que testea ANTHROPIC_API_KEY (staging/dev solo) |

**Resultados CP-01..CP-10 (con fallback-rules-v1, sin IA activa):**

| CP | Descripcion | Resultado |
|----|-------------|-----------|
| CP-01 | Mujer sedentaria, perder peso | ✅ PASA (cals=1300 OK, sessions=3/wk OK) |
| CP-02 | Hombre activo, ganar musculo | ❌ FALLA (cals=1520 vs >3200 requerido) |
| CP-03 | Lesion rodilla | ⚠️ NO EVALUABLE (sin ejercicios detallados sin IA) |
| CP-04 | Vegano | ⚠️ PARCIAL (proteina OK, ingredientes no verificables) |
| CP-05 | Diabetes tipo 2 | ✅ PARCIAL (carbs=145g ≤180g OK) |
| CP-06 | Sin equipamiento | ⚠️ NO EVALUABLE (sin ejercicios detallados) |
| CP-07 | Tiempo limitado | ✅ PARCIAL (sessions=3 OK) |
| CP-08 | Regeneracion estancamiento | ✅ PASA (HTTP 200, plan completo) |
| CP-09 | Atleta avanzado | ❌ FALLA (cals=1520 vs >3500, protein=103g vs >=170g) |
| CP-10 | Multiples restricciones | ❌ FALLA (restricciones no verificables sin IA) |

**Puntuacion MVP actual:** 35/50 — todos los planes usan `fallback-rules-v1`

**Causas raiz identificadas:**
1. Bug de codigo (ya corregido en 035afc3): SYSTEM_PROMPT mal posicionado en la llamada a la API
2. Saldo insuficiente en cuenta Anthropic: error exacto `"credit balance is too low"` confirmado via `/health/ai`

---

## Notas tecnicas para el orquestador

- `railway up` y `git` siempre desde RAIZ del repo: `c:\Users\Antonio\Documents\ai-studio`
- DATABASE_URL y REDIS_URL: URLs directas (no templates `${{...}}`)
- `jest.config.js` tiene `modulePaths: ['<rootDir>/node_modules']` — no eliminar
- Prisma 7: `prisma-client-js`, cliente generado en `src/generated/prisma/`
- Discrepancia pendiente: brief dice "-500 kcal/dia", codigo implementa "80% TDEE"
- Mocks en `backend/src/__mocks__/` — tests funcionan sin infraestructura local
- Endpoints de debug auth SOLO en staging/dev: /auth/dev/code, /auth/dev/auto-verify, /health/ai

---

## Instrucciones para el orquestador

### Al INICIAR sesion
1. Leer este archivo para conocer el estado actual del proyecto
2. Preguntar a Antonio qué tareas manuales ha completado desde la ultima sesion
3. Actualizar los estados correspondientes en este archivo
4. Proponer el plan de trabajo para la sesion basandose en las tareas pendientes

### Al FINALIZAR sesion
1. Actualizar el estado de cada tarea trabajada (Pendiente → En curso / Completada)
2. Actualizar la seccion "Estado general" con la fecha y sesion actuales
3. Anotar cualquier nuevo bloqueante o deuda tecnica descubierta
4. Actualizar tambien `C:\Users\Antonio\.claude\projects\c--Users-Antonio-Documents-ai-studio\memory\current_status.md`
