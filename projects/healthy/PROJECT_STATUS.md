# PROJECT STATUS — Healthy App

> Archivo de estado del proyecto. El agente orquestador lo lee al iniciar cada sesión
> y lo actualiza al finalizar. Es la fuente de verdad del proyecto.
>
> Ultima actualización: 2026-10-20 | Sesión: auditoría de seguridad renovada con Opus (security + JailBreak) y corrección de 48 tareas SEC-25..SEC-72 en la rama `fix/security-audit-2026-10-19` (sin push). Tests en verde.

---

## Estado general

| Campo | Valor |
|-------|-------|
| Fase actual | Post-release v1.0.0 (main `f51a01c`/`aaf4a90`, tag `v1.0.0`). **Correcciones de seguridad listas en `fix/security-audit-2026-10-19`** (sin push, pendiente de OK de Antonio). Staging operativo; **producción NO operativa** (A-25). |
| Rama activa | `fix/security-audit-2026-10-19` — 43 commits sobre develop `4993123`, **sin push**. develop sin cambios. 10 PRs de dependabot abiertas (#8–#17) |
| Backend staging | ✅ ACTIVO — `backend-staging-01ee.up.railway.app` (`/health`: db y redis connected, verificado 2026-10-18) |
| Backend producción | ❌ DEGRADADO — `ai-studio-production-1835.up.railway.app/health` → 503 `db: error, redis: error` (verificado 2026-10-18). Ver A-25 |
| Tests | ✅ Backend **901/901** (38 suites) — branches **86,03 %**, líneas 97,03 % · Raíz **721/721** (29 suites). Guardia de red global: ningún test puede llamar a red real ni a Anthropic. Verificado 2026-10-20 en `fix/security-audit-2026-10-19` |
| APK Android | ✅ Build `96aedf25` (último, con todos los fixes) · `fb35f492` (probado en emulador 2026-10-17) |
| Icono app | ✅ Completado — hoja estilizada + ECG blanco. Aplicado en app y en `landing/index4.html` (A-21 completada) |
| Landing | ✅ ACTIVA en staging — https://healthy-landing-staging.up.railway.app · Lighthouse 2026-10-18: móvil 75/96/100/100, escritorio 79/96/100/100 (Perf/Acc/BP/SEO) |
| Siguiente accion inmediata | 👤 **Rotar secretos** (SEC-25/26: JWT ×4 + PostgreSQL staging/prod) y **crear variables nuevas en Railway** → OK para **push** de `fix/security-audit-2026-10-19` + PR a develop → aplicar 2 migraciones (fuerzan re-login) → **A-25** (PostgreSQL/Redis en production) → **A-4** → **M-19** |

---

## Infraestructura

| Componente | Solucion | Estado |
|------------|----------|--------|
| Backend Node.js (staging) | Railway `healthy-staging` / env staging, servicio `backend` | ✅ ACTIVO — verificado 2026-10-18 |
| PostgreSQL | Railway PostgreSQL plugin | ✅ staging: connected · ❌ production: plugin sin deploy (verificado 2026-10-18) |
| Redis | Railway Redis plugin | ✅ staging: connected · ❌ production: plugin sin deploy (verificado 2026-10-18) |
| Backend Node.js (production) | Railway env production, servicio `ai-studio` | ❌ DEGRADADO — último deploy SUCCESS pero `/health` 503 (db/redis error) |
| Landing page | Railway — servicio `healthy-landing` (nginx sirve `landing/index4.html`, ver `docs/landing-deploy.md`) | ✅ ACTIVA en staging — https://healthy-landing-staging.up.railway.app (primer deploy 2026-10-14 vía `railway up`, sin auto-deploy GitHub aún) |
| CI/CD backend | GitHub Actions → Railway CLI | ✅ OK |
| ANTHROPIC_API_KEY | Variable Railway staging | ✅ Configurado — créditos activos (M-11b completada) |
| App Android | EAS Build (Expo) | ✅ APK disponible — Build `96aedf25` (icono nuevo + rediseño Apple Design + todos los fixes, lanzado 2026-10-12) |
| App iOS | EAS Build (Expo) | ❌ APLAZADO indefinidamente |

**IDs Railway:**
- Proyecto: `a01d9f3d-510b-4529-b75a-d9d7198cbcb5`
- Service staging: `fa137c98-5210-4057-a531-f1c7fbf39743`
- Env staging: `1bc84954-5618-44fd-98fc-5b4190523cf0`
- Service landing (staging): `a3d40d42-1122-439b-99fd-6e8f9d174a7a` (`healthy-landing`)

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
| M-4 | Ejecutar seed de ejercicios: `node projects/healthy/database/seedExercises.js` con DATABASE_URL de Railway | IMPORTANTE | ✅ Completada — 1.324 ejercicios insertados en staging (sesión 2026-10-12) |
| M-5 | Registrar Bundle ID `com.healthy.app` en developer.apple.com | APLAZADO | ❌ APLAZADO indefinidamente — sin publicación iOS |
| M-6 | Crear app en App Store Connect para iOS | APLAZADO | ❌ APLAZADO indefinidamente — sin publicación iOS |
| M-7 | Instalar y probar APK en dispositivo Android real | IMPORTANTE | ✅ Completada — APK `fb35f492` instalado y funcionando en emulador Android (sesión 2026-10-17) |
| M-8 | Publicar APK en Google Play Console → Internal Testing | IMPORTANTE | 🔁 Sustituida por **M-19** (misma tarea; APK ya probado en emulador 2026-10-17, subida a Play Console pendiente) |
| M-9 | Configurar dominio `api.healthy.app` → Railway en panel DNS | PRO FINAL | Pendiente — `api.healthy.app` no resuelve en DNS (verificado 2026-10-18) |
| M-10 | Lighthouse landing ≥ 95 | PRO FINAL | ⚠️ Re-ejecutado 2026-10-18 contra staging (código `e5f32c2`, verificado mismo `index4.html` que develop): Móvil Perf 75 · Acc 96 · BP 100 · SEO 100; Escritorio Perf 79 · Acc 96 · BP 100 · SEO 100. Antes (2026-10-14): móvil 34/90/100/92, escritorio 74/90/100/92. Rendimiento aún < 95: vídeos sin comprimir (`fitness_workout.mp4` 38,9 MB, `runners.mp4` 12,8 MB, `healthy_food.mp4` 11,8 MB) y `portada.jpg` 1,6 MB; Accesibilidad: 1 texto con `rgba(255,255,255,0.45)` (contraste 4,47). Nota: `/robots.txt` devuelve 404 (el `alias` de nginx apunta a `/public/robots.txt`, que no existe en la imagen) |
| M-11 | Configurar ANTHROPIC_API_KEY en Railway staging variables de entorno | CRITICO | ✅ Completada — configurado en staging |
| M-11b | Añadir créditos a cuenta Anthropic (console.anthropic.com → Plans & Billing) | CRITICO | ✅ Completada — verificado via /health/ai → success:true |
| M-12 | Re-ejecutar CP-01..CP-10 con IA activa | IMPORTANTE | ✅ Completada — score 23/50 (2 CPs con IA real: CP-07, CP-08; ver detalle sesión 2026-10-09) |
| M-13 | Aprobar y mergear PR develop → main en GitHub | RELEASE | ✅ Completada — PR #7 mergeado, commit `f51a01c` en main (2026-10-17) |
| M-14 | Crear tag v1.0.0: `git tag v1.0.0 && git push origin v1.0.0` | RELEASE | ✅ Completada — tag v1.0.0 creado y pusheado (2026-10-17) |
| M-15 | Diseñar e implementar icono de la app | IMPORTANTE | ✅ Completada — icono hoja estilizada + ECG blanco (1024×1024px). Aplicado en `frontend/assets/icon.png`, `adaptive-icon.png` y `landing/public/images/app-icon.png`. Landing actualizada (navbar, footer, sección descarga, favicon). Commit `f4dc665` (sesión 2026-10-12c) |
| M-16 | Poblar tabla foods en Railway staging con 3 scripts: `seed-foods.js` (128 alimentos base) + `import-usda.js` (200+ USDA) + `import-openfoodfacts.js` (700+ Open Food Facts, requiere servicio activo). Objetivo: ~1.000 alimentos. | CRITICO | ✅ Completada — `/foods/search?q=pollo` devuelve 6 resultados verificados (sesión 2026-10-12) |
| M-17 | Confirmar M-16 completada: `GET /foods/search?q=pollo` debe devolver resultados (no `{ foods: [], total: 0 }`) | CRITICO | ✅ Completada — verificado 2026-10-12: 6 alimentos con macros completos |
| M-18 | Instalar nuevo APK y probar: icono nuevo, ejercicios reales en entrenamiento, regenerar plan funciona, input sueño | IMPORTANTE | ✅ Completada — APK instalado y publicado en emulador Android (sesión 2026-10-17). APK `fb35f492` verificado funcionando. |
| M-19 | Publicar APK en Google Play Console → Internal Testing | IMPORTANTE | **Pendiente** — primera subida debe ser manual en play.google.com/console. Requiere: cuenta Play Console activa ($25), capturas de pantalla, URL pública de política de privacidad. APK a subir: `96aedf25` |
| M-20 | Dominio propio de la landing: elegir dominio, añadirlo en Railway (Settings → Networking → Custom Domain) y crear el CNAME en el proveedor DNS | PRO FINAL | Pendiente — `healthy-landing` solo tiene el dominio `*.up.railway.app`, sin dominio propio (verificado 2026-10-18) |
| M-21 | Rotar `JWT_SECRET` y `JWT_REFRESH_SECRET`: hay valores reales en `devops/GITHUB_SECRETS.md` desde el commit `414d4c2`. Generar nuevos, actualizarlos en Railway/GitHub Secrets y quitar los valores del documento | CRITICO | **Pendiente** — los 2 valores siguen en `devops/GITHUB_SECRETS.md` (verificado 2026-10-18) |
| M-22 | Confirmar región del proyecto Railway y DPA de Railway (y de Gmail SMTP) — los documentos RGPD (`rgpd-compliance.md`, `DATA_REGISTER.md`, `PRIVACY_POLICY.md`) los marcan como "pendiente de confirmar" | IMPORTANTE | Pendiente — 6 menciones "pendiente de confirmar" siguen en los 3 documentos RGPD (verificado 2026-10-18) |

## Tareas pendientes — AUTOMATICAS (agentes)

| ID | Tarea | Agente | Estado | Depende de |
|----|-------|--------|--------|------------|
| A-1 | Mejorar branch coverage de 69.57% a 80%+ | Tests Agent | ✅ Completada en su día — 85.01% / 454 tests (2026-08-31). ⚠️ Regresión a 66,34 % el 2026-10-18 → ver A-24 | Nada |
| A-2 | Build iOS en EAS: `eas build --platform ios --profile preview` | DevOps Agent | ❌ APLAZADO | Sin publicación iOS por ahora |
| A-3 | Subir a TestFlight: `eas submit --platform ios` | DevOps Agent | ❌ APLAZADO | Sin publicación iOS por ahora |
| A-4 | Deploy a Railway tras merge a main | CI/CD GitHub Actions | ⏳ Run de `deploy.yml` sobre `f51a01c` esperando aprobación manual en GitHub Actions (environment: production) — verificado 2026-10-18. Aunque se apruebe, producción no funcionará sin A-25 | M-13 ✅, A-25 |
| A-5 | Generar documentacion API (Swagger/OpenAPI) con endpoint /exercises | Docs Agent | ✅ Completada — swagger.yaml 40 endpoints | Nada |
| A-Landing | Corregir Accessibility y SEO landing (scores actuales 82-88 → 95+) | Frontend Agent | ✅ Completada — Acc/SEO corregidos (sesión 2026-10-10) | Nada |
| A-6 | **Expansión de micronutrientes completos**: (1) Ampliar modelo Prisma `Food` con fiber, sugar, saturated_fat, sodium, potassium, calcium, iron, vitamin_c, vitamin_d, vitamin_b12 + migración; (2) Actualizar `import-usda.js` para capturar todos los nutrientes USDA disponibles; (3) Actualizar `foods.controller.js` para devolver nuevos campos; (4) Modificar frontend `NutritionScreen` y `FoodDetailScreen` para mostrar tabla de micronutrientes (calorías, macros, fibra, azúcares, grasas saturadas, sodio, calcio, hierro, vitaminas). Referencia commits: seed 61a3729, import 93e470a | Backend + Database + Frontend Agents | ✅ Completada — commits `8b0a7a7` (DB schema + migración), `43db3ae` (backend import-usda + foods.controller FOOD_SELECT), `601a80a` (frontend NutritionTable). **PENDIENTE: ejecutar `npx prisma migrate deploy` en Railway staging.** (sesión 2026-10-15) | M-16 |
| **A-7** | **Rediseño Apple Design** — Ver sección detallada abajo | Apple-Design Agent | ✅ **COMPLETADA** — 39 tareas en 7 fases, 454/454 tests, APK build 94110d29 | Nada |
| **A-8** | **Bug: primer día del plan siempre descanso** — Fix: conversión ISO→JS weekday + cálculo de próxima ocurrencia real del `day_of_week`. Aplicado en `onboarding.controller.js` y `plans.controller.js`. | Backend Agent | ✅ **COMPLETADA** — commit `9441d66` (sesión 2026-10-12) | Nada |
| **A-9** | **Bug: ProfileScreen muestra `—` en edad/altura/peso** — Fix: nuevo endpoint `GET /user/me/profile` + ProfileScreen fetches API al montar. | Backend + Frontend Agents | ✅ **COMPLETADA** — backend `aa4679d`, frontend `20719e2` (sesión 2026-10-12) | Nada |
| **A-10** | **Bug: DailyLogWidget sin inputs editables para agua/pasos/peso** — Fix: `InputModal` con `TextInput` numérico para agua (ml), pasos y peso (kg). Peso guarda en `POST /progress`. | Frontend Agent | ✅ **COMPLETADA** — commit `b90074a` (sesión 2026-10-12) | Nada |
| **A-11** | **Bug: buscador de alimentos no muestra resultados** — Fix: parsing respuesta API (`data.data.foods`) + empty state "No se encontraron alimentos para '{query}'". Resultados reales requieren M-16. | Backend + Frontend Agents | ✅ **COMPLETADA** (frontend fix) — commit `a4b1d65` (sesión 2026-10-12) | M-16 para datos reales |
| **A-12** | **Bug: TrainingScreen muestra "Día de descanso" aunque hay sesión** — Tres causas: (1) `daysOffset <= 0` empujaba sesión de hoy 7 días al futuro → fix `< 0`; (2) `training/today` no filtraba por plan activo, devolvía sesión del plan pausado → fix `plan: { status: 'active' }`; (3) `EQUIPMENT_MAP`/`GOAL_TO_CATEGORIES` usaban title case pero BD tiene minúsculas → 0 ejercicios asignados → fix valores a minúsculas. | Backend Agent | ✅ **COMPLETADA** — commits `44bdf57`, `ce9204c`, `69da1c8` (sesión 2026-10-12) | Nada |
| **A-13** | **Mejora: DailyLogWidget sin input para horas de sueño** — Fix: añadir modal numérico igual que agua/pasos/peso. Guarda en `PUT /logs/today { sleep_hours }`. | Frontend Agent | ✅ **COMPLETADA** — commit `18552bf` (sesión 2026-10-12) | Nada |
| **A-14** | **Bug: regeneratePlan falla con timeout** — El plan con IA puede tardar >20s. Axios timeout global era 20s. Fix: timeout específico 90s en la llamada `POST /plans/regenerate`. | Frontend Agent | ✅ **COMPLETADA** — commit `831b223` (sesión 2026-10-12) | Nada |
| **A-15** | **Bug: login redirige siempre a onboarding** — `POST /auth/login` y `GET /auth/me` no devuelven `has_plan`. Fix: en `login()` y `getMe()` hacer `prisma.plan.findFirst({ where: { user_id, status: 'active' } })` e incluir `has_plan: !!activePlan` en el objeto `user` de la respuesta. Archivo: `backend/src/controllers/auth.controller.js` | Backend Agent | ✅ Completada — ya implementado en sesiones anteriores, verificado 2026-10-15 | Nada |
| **A-16** | **Bug: has_plan siempre undefined al arrancar app** — `loadStoredAuth()` no refresca el usuario contra la API. Fix: tras cargar tokens de SecureStore y setear `isAuthenticated: true`, llamar a `GET /auth/me`, actualizar el store y re-guardar en SecureStore. Si la llamada falla (sin red), usar el usuario guardado como fallback. Archivo: `frontend/src/stores/authStore.ts` | Frontend Agent | ✅ Completada — `loadStoredAuth` ya llama `/auth/me`; añadido `SecureStore.setItemAsync` para persistir `freshUser` con `has_plan` (sesión 2026-10-15) | A-15 |
| **A-17** | **Auditoría de seguridad MITRE ATLAS** — Agente JailBreak completó la auditoría de las 16 tácticas ATLAS v4.5. Ver `auditoria_atlas_mitre.md`. 30 hallazgos, 24 tareas SEC-01..SEC-24 para el orquestador. | JailBreak Agent | ✅ **COMPLETADA** — `CLAUDE.jailbreak.md` + `auditoria_atlas_mitre.md`. Commit `1ad08bc` (sesión 2026-10-12e) | Nada |
| **N-1** | **Backend: endpoint `POST /nutrition/meals/:mealId/foods`** — Cuerpo: `{ food_id, quantity_g }` (default 100g). Acción: crear registro en `meal_foods`, recalcular y actualizar `meals.calories`, `meals.protein_g`, `meals.carbs_g`, `meals.fat_g` basándose en `foods.calories_per_100g` × (quantity_g / 100). Respuesta: comida actualizada con `meal_foods` y macros. Archivos: `backend/src/controllers/nutrition.controller.js` + `nutrition.routes.js` | Backend Agent | ✅ Completada — verificado en `nutrition.controller.js` (sesión 2026-10-15) | Nada |
| **N-2** | **Frontend: resultados buscador seleccionables + modal de asignación** — En `FoodSearchBar` (`NutritionScreen.tsx`): cambiar `<View style={srStyles.resultRow}>` por `<TouchableOpacity>` con `onPress`. Al pulsar: modal con nombre del alimento, input cantidad en gramos (default 100), lista de comidas del día (`todayMeals`) para seleccionar, botón "Añadir". Al confirmar: llamar `POST /nutrition/meals/:mealId/foods`. `FoodSearchBar` recibe `todayMeals` como prop desde `NutritionScreen`. | Frontend Agent | ✅ Completada — verificado en `NutritionScreen.tsx` (sesión 2026-10-15) | N-1 |
| **A-18** | **Landing: Lighthouse ≥ 95** — Causas detectadas (2026-10-14): peso total ~91 MB (vídeos + 151 frames del canvas cargados de golpe), Tailwind por CDN bloqueante y compilando en runtime (TBT 2,3 s en móvil), JS inline ~1 s, LCP 13,4 s en móvil; contraste insuficiente en textos `rgba(255,255,255,0.45)` y etiquetas de 12px; `aria-label` en `<div>` de estrellas sin rol; falta `robots.txt` (nginx devuelve el HTML). | Frontend + DevOps Agents | ✅ Completada — commit `e5f32c2`: defer Tailwind, IntersectionObserver frames, critical CSS, robots.txt, OG/canonical, role=img, contraste 0.60-0.72 (sesión 2026-10-15). Verificado 2026-10-18 en staging: móvil 75/96/100/100, escritorio 79/96/100/100 — Rendimiento y Accesibilidad aún < 95 (ver M-10). | A-26 (robots.txt) |
| **A-19** | **Landing: auto-deploy desde GitHub** — `railway service source connect --repo trutool-dev/ai-studio --branch develop --service healthy-landing` y Root Directory `projects/healthy/landing` en Settings | DevOps Agent | ✅ Completada — `.github/workflows/deploy-landing.yml` creado: dispara en push a `develop` con `paths: projects/healthy/landing/**`, deploya al servicio `a3d40d42` via `railway up` (sesión 2026-10-15) | Nada |
| **A-20** | **Landing: servicio en el entorno production** de Railway cuando la landing llegue a `main` | DevOps Agent | Pendiente — en el entorno production de Railway no existe servicio de landing (verificado 2026-10-18) | M-13 ✅ |
| **A-21** | **Landing: aplicar el icono nuevo en `index4.html`** (sigue usando `logo-icon.svg`) y actualizar `docs/landing-content.md`, que aún describe `index.html` | Frontend + Docs Agents | ✅ Completada — favicon y 2 img sustituidas por `app-icon.png` con border-radius (sesión 2026-10-15) | Nada |
| **A-22** | **Resolver discrepancia de calorías**: el brief dice "-500 kcal/día" y el código implementa "80 % TDEE" | AI + Backend Agents | ✅ Resuelta — Antonio confirma mantener **80% TDEE** (déficit relativo, adapta a cualquier perfil). Sin cambio de código. (sesión 2026-10-15) | Nada |
| **A-23** | **CI: `deploy.yml` redespliega el backend de staging en cualquier push a `develop`** (sin filtro de rutas). Añadir `paths: projects/healthy/backend/**` para no redesplegar con cambios de docs/landing | DevOps Agent | ✅ Completada — `paths: projects/healthy/backend/**` añadido en trigger `on.push` (sesión 2026-10-15) | Nada |
| **N-3** | **Frontend: refrescar macros de la comida tras añadir alimento** — Tras la llamada exitosa de N-2, llamar `fetchTodayNutrition()` para refrescar `todayMeals` en el store. Los `MacroCard` y el resumen calórico se actualizarán automáticamente al cambiar el store. | Frontend Agent | ✅ Completada — verificado en `NutritionScreen.tsx` (sesión 2026-10-15) | N-2 |
| **A-24** | **Tests rotos y cobertura de branches < 80 %** | Tests Agent | ✅ Completada en `fix/security-audit-2026-10-19` (commits `c82610c`, `946bb70` y los de cada SEC) — backend 901/901, branches 86,03 %; raíz 721/721 (2026-10-20). Pendiente de merge | Nada |
| **A-25** | **Producción caída: PostgreSQL y Redis del entorno production sin desplegar** — `ai-studio` (production) responde 503 `db: error, redis: error`. Desplegar los plugins, configurar `DATABASE_URL`/`REDIS_URL` en el servicio, ejecutar `prisma migrate deploy` y seeds (ejercicios + alimentos) antes de abrir a usuarios | DevOps + Database Agents | Pendiente — requiere OK de Antonio (toca producción) | Nada |
| **A-26** | **Landing: `/robots.txt` devuelve 404** — en `nginx.conf.template` el `alias` apunta a `/usr/share/nginx/html/public/robots.txt`, pero el Dockerfile copia `public/` a la raíz (el fichero está en `/usr/share/nginx/html/robots.txt`). Además `robots.txt` declara un `sitemap.xml` que no existe | DevOps Agent | Pendiente | Nada |
| **A-27** | **Revisar las 10 PRs de dependabot (#8–#17)** — todas con CI/tests/security-audit en rojo. Varias son saltos mayores con riesgo: `@anthropic-ai/sdk` 0.52→0.133, `expo-secure-store` 15→58, `tailwindcss` 3→4, `dotenv` 16→18. Mergear solo las menores tras CI verde; cerrar o planificar las mayores | DevOps Agent | ⏳ Parcial — SEC-53 (`9821a70`) sube express/morgan/prisma/proxy-addr (backend: de 15 a 2 vulnerabilidades); axios ^1.20.0 en frontend (SEC-66). Siguen abiertas las PRs; mayores pendientes: nodemailer 6→10, uuid 10→14, `@anthropic-ai/sdk` 0.52→0.133 (SEC-59), `expo-secure-store` (va con el SDK de Expo) | A-24 |

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

## Auditoría de seguridad 2026-10-19 (Opus) — correcciones

Auditoría renovada con **Claude Opus** (el proyecto se implementó con Sonnet 4.6): agente **security** (OWASP Top 10, RGPD, secretos, dependencias) y agente **JailBreak** (MITRE ATLAS v4.5 + OWASP LLM Top 10). Informes en `security/`: `SECURITY_AUDIT_2026-10-19.md`, `ATLAS_AUDIT.md`, `LLM_THREATS.md`, `PROMPT_REVIEW.md`, `SECURITY_TASKS.md`, `AUDIT_SUMMARY_2026-10-19.md`, `FIX_PROGRESS.md`.

- **Resultado de la auditoría:** security 34 hallazgos (🔴 3 · 🟠 5 · 🟡 16 · 🟢 10); JailBreak 20 (🔴 2 · 🟠 7 · 🟡 7 · 🟢 4). De SEC-01..SEC-24 (Sonnet): 7 ✅, 13 ⚠️, 4 ❌ — reabiertas y absorbidas en SEC-25..SEC-72.
- **Correcciones:** rama `fix/security-audit-2026-10-19`, 43 commits, **sin push**. Tests: backend 901/901 (branches 86,03 %), raíz 721/721.
- **Incidente:** durante el desarrollo, un test hizo **una llamada real a la API de Anthropic** (mock resuelto a otra copia del SDK; respuesta 401 con clave falsa, sin coste ni datos reales). Corregido con una guardia de red global en ambas suites (`c82610c`).
- **Migraciones creadas sin aplicar:** `20261019120000_auth_password_setup_hashed_otp` (anula OTP pendientes en claro) y `20261019130000_auth_hashed_tokens_rotation` (revoca sesiones y enlaces de reset existentes → **todos los usuarios deberán volver a iniciar sesión**).
- **Variables de entorno** (lista completa en `backend/.env.example`, `cdb4dbf`). **Obligatorias en staging/producción o el servidor no arranca:** `NODE_ENV` exacto (`staging`/`production`), `JWT_SECRET` y `JWT_REFRESH_SECRET` (≥ 32, distintos), `DATABASE_URL`, `REDIS_ENCRYPTION_KEY` (64 hex), `REDIS_HMAC_SECRET` (≥ 32); SMTP en producción. **Nuevas opcionales:** `TRUST_PROXY`, `ENABLE_DEV_ENDPOINTS`, `ADMIN_TOKEN`, `DEV_ENDPOINTS_TOKEN`, `DEV_ENDPOINTS_EMAIL_DOMAINS`, `PHOTO_URL_ALLOWED_HOSTS`, `OTP_HASH_SECRET`, `HEALTH_CONSENT_VERSION`, `AI_DAILY_TOKEN_LIMIT`, `ANTHROPIC_TIMEOUT_MS`, `ANTHROPIC_MAX_RETRIES`, `ANTHROPIC_MODEL` (lista blanca), `RETENTION_*_DAYS`.

Leyenda: ✅ hecho (commit en la rama, pendiente de merge) · ⏳ pendiente (agente) · 👤 manual o decisión de Antonio.

| ID | Sev | Origen | Problema | Estado |
|----|-----|--------|----------|--------|
| SEC-25 | 🔴 | SA-01 | JWT expuestos en `GITHUB_SECRETS.md` | ✅ archivos `7cce351` · 👤 **rotar** los 4 secretos JWT |
| SEC-26 | 🔴 | SA-02 | Credenciales PostgreSQL versionadas | ✅ archivos `7cce351` · 👤 **rotar** contraseñas staging/prod, cerrar TCP público, valorar notificación AEPD (art. 33) |
| SEC-27 | 🔴 | SA-03 | `set-password` sin prueba de posesión (toma de cuentas) | ✅ `f321aa6` |
| SEC-28 | 🔴 | JB-01 | Alergias/lesiones/condiciones no llegaban al prompt; fallback con alérgenos; 500 keto/other | ✅ `c59bb38` · 👤 decidir si keto/other entran en el enum (migración) |
| SEC-29 | 🔴 | JB-02 + SA-18 | Edad mínima 16 y rangos eludibles | ✅ `c59bb38` |
| SEC-30 | 🟠 | SA-04 | Endpoints dev abiertos en staging | ✅ `1080d1e` (+ `fe0cb29` scripts CP) |
| SEC-31 | 🟠 | SA-05 | OTP con fuerza bruta | ✅ `f321aa6` |
| SEC-32 | 🟠 | SA-06 + JB-07 | Rate limiting ineficaz tras el proxy | ✅ `1661a42`, `5b4c2cb`, `b72b521` |
| SEC-33 | 🟠 | SA-07 + JB-09 | Consentimiento Art. 9 no validado en servidor | ✅ `c59bb38`, `2c0ff41`, `946bb70` · 👤 DPA/SCC con Anthropic |
| SEC-34 | 🟠 | SA-08 | Build de producción apunta a `api.healthy.app` sin titularidad | 👤 decidir dominio (bloquea producción y pinning) |
| SEC-35 | 🟠 | JB-03 | Frontend ignoraba errores y enviaba consentimiento fijo | ✅ `ebe8e8f` |
| SEC-36 | 🟠 | JB-04 | Salida del LLM sin validar; persistencia no transaccional | ✅ `c59bb38`, `d128869` |
| SEC-37 | 🟠 | JB-05 | Salvaguardas clínicas | ✅ `c59bb38` · 👤 **validar umbrales clínicos y listas de alérgenos** (`clinicalSafety.js`) |
| SEC-38 | 🟠 | JB-06 | Sanitizador de prompt eludible | ✅ `c59bb38`, `d128869` |
| SEC-39 | 🟠 | SA-15 + JB-08 | `/health/ai` fail-open y con coste | ✅ `910ba8f` |
| SEC-40 | 🟡 | SA-09 | `.claude/settings.local.json` versionado con secretos | 👤 aprobar `git rm --cached` + `.gitignore` (lista en informe devops) |
| SEC-41 | 🟡 | SA-10 | Credenciales de staging en la memoria del orquestador | ✅ valores retirados de la memoria (2026-10-20) · 👤 rotar la contraseña del usuario de staging |
| SEC-42 | 🟡 | SA-11 + JB-20 | Escaneo de secretos insuficiente | ✅ `71cc5ff`, `5383a38` · 👤 activar Secret scanning + Push protection en GitHub; verificar versión/checksum de gitleaks y SHA de checkout en el 1.er run |
| SEC-43 | 🟡 | SA-12 | Sin limitador en reset/refresh/dev | ✅ `5b4c2cb` |
| SEC-44 | 🟡 | SA-13 | JWT sin algoritmo fijado ni revocación | ✅ `bfea7f1` |
| SEC-45 | 🟡 | SA-14 | Tokens en claro, sin detección de reutilización | ✅ `6b21337` (migración sin aplicar) |
| SEC-46 | 🟡 | SA-16 + JB-14 | Validación de entorno; cifrado de caché fail-open | ✅ `e845a85`, `fa885c9`, `c59bb38` |
| SEC-47 | 🟡 | SA-17 | Consentimiento sin versión ni retirada | ✅ backend `c59bb38` (`DELETE /onboarding/health-consent`) · ⏳ pantalla en la app · 👤 historial de consentimientos (migración) |
| SEC-48 | 🟡 | SA-19 | Borrado de cuenta incompleto | ✅ `ffcb134`, `8ccfcaf` · ⏳ la app no tiene pantalla de borrado (art. 17) |
| SEC-49 | 🟡 | SA-20 | Export RGPD incompleto | ✅ `ffcb134` |
| SEC-50 | 🟡 | SA-21 | Sin retención de datos caducados | ✅ job `1a8d003` · ⏳ programar el cron diario (devops) |
| SEC-51 | 🟡 | SA-22 + JB-19 | PII, OTP y enlaces en logs | ✅ `30ecdf8` |
| SEC-52 | 🟡 | SA-23 | Validación de entrada incompleta | ✅ `8f5a960` |
| SEC-53 | 🟡 | SA-24 | Dependencias backend vulnerables | ✅ `9821a70` (15→2) · ⏳ nodemailer 6→10 y uuid 10→14 (mayores) |
| SEC-54 | 🟡 | JB-10 | Catálogo de ejercicios mal pasado al modelo | ✅ `c59bb38`, `d128869` |
| SEC-55 | 🟡 | JB-11 | Cliente Anthropic sin timeout ni `stop_reason` | ✅ `c59bb38`, `d128869` |
| SEC-56 | 🟡 | JB-12 | Sin medición de tokens ni prompt caching | ✅ `c59bb38`, `d128869` |
| SEC-57 | 🟡 | JB-13 | Fallback cacheado; caché sin invalidar | ✅ `c59bb38`, `d128869` |
| SEC-58 | 🟡 | JB-15 | Exclusión por lesión no funcionaba | ✅ `ccfb3f7` |
| SEC-59 | 🟡 | JB-16 | SDK de Anthropic 0.52 desactualizado | ⏳ subir a la versión actual con tests simulados antes; no mergear la PR de dependabot con CI en rojo |
| SEC-60 | 🟢 | SA-25 | Enumeración de usuarios | ✅ `aff62d9` |
| SEC-61 | 🟢 | SA-26 | Asignación masiva | ✅ `c59bb38` |
| SEC-62 | 🟢 | SA-27 | `/exercises` creaba conexiones por petición | ✅ `7dc407b` |
| SEC-63 | 🟢 | SA-28 | Texto libre de salud sin límite | ✅ `c59bb38` |
| SEC-64 | 🟢 | SA-29 | `photo_url` arbitraria | ✅ `d03781c` (rechaza todo hasta configurar `PHOTO_URL_ALLOWED_HOSTS`) |
| SEC-65 | 🟢 | SA-30 | HTTP por defecto y sin pinning en la app | ✅ https obligatorio `7fdad85` · ⏳ certificate pinning (depende de SEC-34 y build EAS) |
| SEC-66 | 🟢 | SA-31 | Dependencias del frontend | ✅ axios `30d673a` · ⏳ resto ligado a Expo SDK/React Native (mayores) |
| SEC-67 | 🟢 | SA-32 | Contenedor arrancaba aunque fallase la migración | ✅ `1b35acf` |
| SEC-68 | 🟢 | SA-33 + JB-18 | Código muerto con `require` roto | ✅ `a190ebd` |
| SEC-69 | 🟢 | SA-34 | RAT desactualizado | ✅ `587798b` · 👤 DPA Railway (región) y Anthropic, SMTP, responsable/DPO, revalidar EIPD |
| SEC-70 | 🟢 | JB-17 | `AI_SYSTEM_PROMPT` sustituía las reglas de seguridad | ✅ `c59bb38` |
| SEC-71 | 🟢 | VUL-017 / B-02 | `/health` exponía detalle sin límite | ✅ `80b88dd`, `b27763d` |
| SEC-72 | 🟢 | VUL-015 | Nueva contraseña igual a la actual | ✅ `2636da9` |

**Acciones de Antonio, en orden:** (1) rotar JWT ×4 y contraseñas de PostgreSQL (`security/SECRETS_POLICY.md`) y la contraseña del usuario de staging; valorar notificación a la AEPD; (2) crear en Railway las variables obligatorias y nuevas; (3) OK para push de la rama y PR a develop; (4) aplicar las 2 migraciones (re-login forzado); (5) Secret scanning + Push protection en GitHub; (6) `git rm --cached` de SEC-40; (7) decisiones: dominio (SEC-34), umbrales clínicos (SEC-37), keto/other (SEC-28), historial de consentimientos (SEC-47), DPA Railway/Anthropic (SEC-33/69).

**Pendientes de agentes:** pantalla de borrado de cuenta y de retirada del consentimiento en la app (SEC-47/48), cron de retención (SEC-50), nodemailer/uuid (SEC-53), SDK Anthropic (SEC-59), certificate pinning (SEC-65), dependencias Expo (SEC-66), robots.txt (A-26).

---

## Checklist Go-live

| Criterio | Objetivo | Estado |
|----------|----------|--------|
| Tests lineas | >= 80% | ✅ OK — 97,03 % backend (2026-10-20) |
| Tests branches | >= 80% | ✅ OK en `fix/security-audit-2026-10-19` — 86,03 % backend, 901/901 (2026-10-20); pendiente de merge |
| Lighthouse landing | >= 95 | ⚠️ PARCIAL — 2026-10-18: SEO y Best Practices 100; Accesibilidad 96; Rendimiento 75 móvil / 79 escritorio (ver M-10) |
| Landing publicada | Activa | ⚠️ Activa en Railway staging; falta producción (A-20) y dominio propio (M-20) |
| App Android Google Play Internal | Publicada | ⚠️ APK funcionando en emulador (M-18 ✅) — pendiente subida manual a Play Console (M-19) |
| App iOS TestFlight | Publicada | ❌ APLAZADO indefinidamente — sin publicación iOS |
| Backend staging operativo | Activo | ✅ ACTIVO (verificado 2026-10-18) |
| Backend producción operativo | Activo | ❌ NO — db/redis error (A-25) |
| Auditoría de seguridad sin 🔴 abiertos | 0 críticos | ⚠️ Código corregido en `fix/security-audit-2026-10-19`; quedan 👤 rotación de secretos (SEC-25/26) y dominio (SEC-34) — bloquean producción |
| ANTHROPIC_API_KEY en staging | Configurado | ✅ Configurado |
| Créditos Anthropic | Disponibles | ✅ ACTIVO — M-11b completada, /health/ai confirma success:true |
| Seed 1.324 ejercicios ejecutado | Completo | ✅ COMPLETADO — M-4 ejecutada sesión 2026-10-12 |
| CP-01..CP-10 con IA activa | 8+/10 | ⚠️ PARCIAL — score 23/50; IA real en 2/10 CPs; 7 CPs con caché Redis fallback; ver sesión 2026-10-09 |
| Tag v1.0.0 | Creado | ✅ CREADO — tag `v1.0.0` sobre main `f51a01c` (2026-10-17) |

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
| Sesion 2026-10-12b | **A-8** ✅ Fix scheduled_date: ISO→JS weekday + próxima ocurrencia real (`9441d66`). **A-9** ✅ Nuevo `GET /user/me/profile` + ProfileScreen fetch API (`aa4679d`, `20719e2`). **A-10** ✅ DailyLogWidget con InputModal numérico para agua/pasos/peso + `POST /progress` (`b90074a`). **A-11** ✅ NutritionScreen: fix parsing `data.data.foods` + empty state (`a4b1d65`). **M-4** ✅ Seed 1.324 ejercicios completado en staging. Frontend worktree mergeado a develop + push Railway (`e601547`). Nuevo build EAS pendiente para incorporar todos estos fixes. | e601547 | 2026-10-12 |
| Sesion 2026-10-12d | **M-16/M-17** ✅ Verificados: `GET /foods/search?q=pollo` devuelve 6 resultados. **A-12** ✅ TrainingScreen "Día de descanso" resuelto: fix `daysOffset < 0` (`44bdf57`), `training/today` filtra plan activo (`ce9204c`), `EQUIPMENT_MAP`/`GOAL_TO_CATEGORIES` en minúsculas para match con BD (`69da1c8`). **A-13** ✅ Input sueño en DailyLogWidget (`18552bf`). **A-14** ✅ Timeout regeneratePlan 90s (`831b223`). **Go-live checklist** revisada: 4 criterios ✅, 1 aplazado (iOS), 2 pendientes (Google Play + tag). **APK `96aedf25`** ✅ con icono nuevo + todos los fixes. | 69da1c8 | 2026-10-12 |
| Sesion 2026-10-12e | **JailBreak Agent** ✅ `CLAUDE.jailbreak.md` creado en raíz (auditor de seguridad basado en MITRE ATLAS v4.5). **auditoria_atlas_mitre.md** ✅ generada: 16 tácticas auditadas, 30 hallazgos, 24 tareas SEC-01..SEC-24 — 5 🔴 críticas (prompt injection en buildUserContextPrompt, extraContext libre, indirect injection, cross-user userId, DoS via API key), 8 🟠 altas, 7 🟡 medias, 4 🟢 bajas. | 1ad08bc | 2026-10-12 |
| Sesion 2026-10-12f | **Orquestador**: Tareas **N-1/N-2/N-3** registradas — flujo completo "food search asignable a comidas": N-1 backend endpoint `POST /nutrition/meals/:mealId/foods` (crear `meal_foods` + recalcular macros), N-2 frontend `<TouchableOpacity>` en resultados + modal de asignación (cantidad g + selección comida), N-3 frontend `fetchTodayNutrition()` tras confirmar para refrescar macros en pantalla. Contexto técnico: `NutritionScreen.tsx` línea 98 (`<View>` no presionable), tabla `meal_foods` ya existe en schema, tabla `meals` tiene columnas de macros a actualizar. | pendiente | 2026-10-12 |
| Sesion 2026-10-12c | **DOC-01..DOC-08** ✅ Verificadas y marcadas como completadas en tasks.md — todos los documentos existían con contenido completo (api-reference, deployment-guide, ai-architecture, rgpd-compliance, README, architecture-web, landing-deploy, landing-content). Commit `e0dde65`. **M-15** ✅ Icono app diseñado: hoja estilizada + ECG blanco (1024×1024px). Aplicado en `frontend/assets/icon.png`, `adaptive-icon.png` y `landing/public/images/app-icon.png`. Landing actualizada: navbar, footer, sección descarga y favicon usan icono real. Commit `f4dc665`. | f4dc665 | 2026-10-12 |
| Sesión 2026-10-17 | **Orquestación masiva tareas automáticas**: N-1/N-2/N-3 verificadas completadas. A-15/A-16 verificadas. A-16 fix: SecureStore persiste `has_plan` (`ce0bb6f`). A-18/A-21: landing Lighthouse — defer Tailwind, IntersectionObserver frames, robots.txt, OG/canonical, contraste, icono app (`e5f32c2`). A-19/A-23: deploy-landing.yml + paths filter CI (`f604533`). A-6: micronutrientes DB schema + migración + backend FOOD_SELECT + frontend NutritionTable (`8b0a7a7`, `43db3ae`, `601a80a`). A-22: mantenemos 80% TDEE. **Migración A-6** ejecutada en Railway staging con DATABASE_PUBLIC_URL. **M-7/M-18**: APK `fb35f492` instalado y funcionando en emulador Android. **TODOS_LOS_AGENTES.txt**: 13 agentes fusionados en un solo archivo. | e749094 | 2026-10-17 |
| Sesión 2026-10-19/20 | **Auditoría de seguridad renovada con Opus** (security + JailBreak): 54 hallazgos; SEC-01..24 de Sonnet re-verificadas (7 ✅ · 13 ⚠️ · 4 ❌). **Corrección** por 5 agentes (auth, onboarding+IA, plataforma, frontend, devops+docs) coordinados por el orquestador, con puntos de control en `security/FIX_PROGRESS.md` y vigilante automático ante cortes por límite de uso: SEC-25..SEC-72 resueltas en código salvo las manuales. Incluye SA-03 (toma de cuentas), SA-04 (endpoints dev), JB-01 (datos de salud fuera del prompt) y JB-02 (menores). Tests backend 901/901 (branches 86,03 %), raíz 721/721. Incidente: 1 llamada real a Anthropic en un test (401, sin coste), blindado. Rama `fix/security-audit-2026-10-19`, sin push. | `4d905af` | 2026-10-20 |
| Sesión 2026-10-18b | **Auditoría de estado real** contra código, Railway, GitHub y DNS: los 16 commits citados como hechos están en develop; A-19 (workflow `deploy-landing.yml`) y A-23 (filtro de rutas) verificados. **Discrepancias**: tests backend 451/454 con branches 66,34 % (documento decía 454/454 y 85,01 %); producción degradada sin PostgreSQL/Redis; `/robots.txt` 404; M-21 sin hacer (JWT siguen en el documento); A-4 aún esperando aprobación; 10 PRs de dependabot en rojo. Nuevas tareas A-24..A-27. | — | 2026-10-18 |
| Sesión 2026-10-18 | **Coherencia de PROJECT_STATUS**: M-13/M-14 y tag v1.0.0 reflejados como hechos (camino crítico, checklist); M-8 marcada como sustituida por M-19; nota de calorías alineada con A-22. **Lighthouse staging** (verificado que sirve el `index4.html` de develop): móvil 75/96/100/100, escritorio 79/96/100/100 (antes 34/90/100/92 y 74/90/100/92). Detectado `/robots.txt` 404 en staging. | — | 2026-10-18 |
| Sesion 2026-10-13/14 | **Revisión de estado** del proyecto (agentes, PROJECT_STATUS, git). **Landing**: confirmado que la landing publicada es `landing/index4.html` (HTML + Tailwind CDN, sin build); nuevos `landing/Dockerfile` + `nginx.conf.template` + `.dockerignore` (nginx sirve `index4.html` en `/` con `public/` images/videos/frames, puerto `${PORT}`), probado en local con Docker. **Limpieza**: eliminados `devops/infra/` (Terraform S3/CloudFront/Route 53), `devops/.github/workflows/deploy-landing.yml`, `devops/cloudrun/` y `landing/Dockerfile.txt`; ~50 documentos actualizados de AWS a Railway (`landing-deploy`, `MONITORING`, `BACKUP_STRATEGY` reescritos). Commit `9f5b847` en develop con `[skip ci]` (para no redesplegar el backend de staging). **Railway**: servicio `healthy-landing` creado en `healthy-staging` / entorno staging, primer deploy OK, dominio https://healthy-landing-staging.up.railway.app — verificados 200 en `/`, vídeos y frames + cabeceras de seguridad. **Lighthouse** (M-10) móvil 34/90/100/92, escritorio 74/90/100/92 → A-18. Nuevas tareas M-20..M-22 y A-18..A-23. | 9f5b847 | 2026-10-14 |
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
- Calorías: se mantiene **80% TDEE** (decisión de Antonio, A-22 resuelta 2026-10-15) — el brief original decía "-500 kcal/dia"
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

---

## Tareas pendientes — SEGURIDAD IA (MITRE ATLAS) — generadas por agente JailBreak

> Origen: `auditoria_atlas_mitre.md` — MITRE ATLAS v4.5 — Sesión 2026-10-12e  
> Ver archivo completo para descripción detallada de cada hallazgo, vector de ataque y mitigación.

### 🔴 CRÍTICAS — Resolver antes del go-live

| ID | Componente | Descripción | Agente | Estado |
|----|-----------|-------------|--------|--------|
| **SEC-01** | `aiService.js` → `buildUserContextPrompt()` | Sanitización anti-prompt-injection: truncar campos a 500 chars, strip de patrones de inyección, encapsular datos en `<user_data>`, añadir instrucción defensiva al SYSTEM_PROMPT | Security Agent | ✅ `cb66d48` |
| **SEC-02** | `POST /plans/generate` endpoint | `extraContext` solo generado internamente — confirmado que el cliente nunca lo pasa directamente | Security Agent | ✅ `cb66d48` |
| **SEC-03** | `aiService.js` → `formatExercisesForPrompt()` | `sanitizeExerciseForPrompt()` creada y aplicada: name≤100, instructions≤300, strip patrones | Security Agent | ✅ `cb66d48` |
| **SEC-04** | Controller de planes | `userId` siempre del JWT — comentario explícito añadido. Confirmado: onboarding.controller y plans.controller solo usan `req.user.userId` | Security Agent | ✅ `3930265` |
| **SEC-05** | Registro de usuarios | `registrationLimiter` (3 cuentas/hora por IP) aplicado en `POST /auth/register` | Security Agent | ✅ `dd9e9f7` |

### 🟠 ALTAS — Resolver en sprint post-lanzamiento

| ID | Componente | Descripción | Agente | Estado |
|----|-----------|-------------|--------|--------|
| **SEC-06** | `onboarding.routes.js` | `planGenerationLimiter` (1 plan nuevo/día) aplicado en `POST /onboarding/complete` | Security Agent | ✅ `dd9e9f7` |
| **SEC-07** | SYSTEM_PROMPT | Instrucciones anti-jailbreak + refusal de roles alternativos añadidas al SYSTEM_PROMPT | Security Agent | ✅ `cb66d48` |
| **SEC-08** | Error handling | `err.error` eliminado del log (no expone detalles internos de Claude API) | Security Agent | ✅ `cb66d48` |
| **SEC-09** | SYSTEM_PROMPT | Instrucción de confidencialidad añadida. `EFFECTIVE_SYSTEM_PROMPT` lee desde `AI_SYSTEM_PROMPT` env var | Security Agent | ✅ `cb66d48` |
| **SEC-10** | Redis | Cifrado AES-256-GCM con `REDIS_ENCRYPTION_KEY`. `encryptAES256`/`decryptAES256` en `crypto.util.js` | Security Agent | ✅ `cb66d48` |
| **SEC-11** | Output processing | `notes`≤1000 chars, `generated_at` validado ISO8601, `model_version` validado contra allowlist | Security Agent | ✅ `cb66d48` |
| **SEC-12** | `app.js` | `express.json` reducido de 10mb a 50kb | Security Agent | ✅ `3930265` |
| **SEC-13** | CI/CD + npm | `security-audit.yml` creado, `@anthropic-ai/sdk` pineado a `0.52.0`, Dependabot activado | DevOps Agent | ✅ `1281dce` |

### 🟡 MEDIAS — Backlog de mejoras

| ID | Descripción | Estado |
|----|-------------|--------|
| **SEC-14** | `.gitignore` actualizado con patrones de docs internos (`CLAUDE.*.md`, `PR-*.md`, `*_STATUS.md`, etc.) | ✅ `1281dce` |
| **SEC-15** | `sanitizeCatalogExercise()` en `exerciseSelector.service.js`: longitud de campos + strip Unicode override | ✅ `1281dce` |
| **SEC-16** | HMAC-SHA256 con `REDIS_HMAC_SECRET` en caché Redis — verificación de integridad antes de usar el plan | ✅ `cb66d48` |
| **SEC-17** | Normalización Unicode NFC + strip chars de control/RTL (U+202A-202E, U+2066-2069) en `sanitizeTextField` | ✅ `cb66d48` |
| **SEC-18** | Separadores `---SECCIÓN: X---` + presupuesto de 2000 chars combinados para campos de texto libre | ✅ `cb66d48` |
| **SEC-19** | `/health/ai` protegido con `X-Admin-Token`. `key_prefix` eliminado de la respuesta | ✅ `3930265` |
| **SEC-20** | Clamping fisiológico en `calculateMetabolism()`: age [10,120], weight [20,500], height [50,250] | ✅ `cb66d48` |

### 🟢 BAJAS — Nice to have

| ID | Descripción | Estado |
|----|-------------|--------|
| **SEC-21** | Helmet deshabilita `X-Powered-By` confirmado + comentario explícito en `app.js` | ✅ `3930265` |
| **SEC-22** | JWT TTL confirmado `'15m'` en `auth.controller.js` — no requiere cambio | ✅ `3930265` |
| **SEC-23** | Post-procesado: `exercise.id` del plan validado contra `catalogIds` antes de guardar | ✅ `3930265` |
| **SEC-24** | `SECRETS_POLICY.md` creado. Pre-commit hook `.husky/pre-commit` para detectar `sk-ant-`. `.env.example` actualizado con nuevas vars de seguridad | ✅ `1281dce` |
