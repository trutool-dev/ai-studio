# PROJECT STATUS — Healthy App

> Archivo de estado del proyecto. El agente orquestador lo lee al iniciar cada sesión
> y lo actualiza al finalizar. Es la fuente de verdad del proyecto.
>
> Ultima actualización: 2026-09-06 | Sesión: completada

---

## Estado general

| Campo | Valor |
|-------|-------|
| Fase actual | Fase 10 completada — sesión 2026-09-06: bug Claude API corregido, ANTHROPIC_API_KEY configurado, CP tests re-ejecutados |
| Rama activa | develop (pusheado — df455ac) |
| Backend staging | ✅ ACTIVO — `backend-staging-01ee.up.railway.app` |
| Tests | 454/454 pasando — lineas 96.78% / branches 85.01% |
| Siguiente accion inmediata | M-11b: Añadir créditos Anthropic → desbloquea CP tests con IA real |

---

## Infraestructura

| Componente | Solucion | Estado |
|------------|----------|--------|
| Backend Node.js | Railway healthy-staging | ✅ ACTIVO — verificado 2026-09-06 |
| PostgreSQL | Railway PostgreSQL plugin | ✅ ACTIVO — db:connected |
| Redis | Railway Redis plugin | ✅ ACTIVO — redis:connected |
| Landing page | AWS S3 + CloudFront | ✅ OK — produccion |
| CI/CD backend | GitHub Actions → Railway CLI | ✅ OK |
| ANTHROPIC_API_KEY | Variable Railway staging | ✅ Configurado (sin créditos — M-11b pendiente) |
| App Android | EAS Build (Expo) | Build pendiente de verificar |
| App iOS | EAS Build (Expo) | Bloqueado — falta Bundle ID Apple |

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
| M-2 | Verificar build Android: `eas build:list --limit 1 --platform android` | CRITICO | Pendiente |
| M-3 | Si build falló: `eas build --platform android --profile preview` | CRITICO | Pendiente (depende M-2) |
| M-4 | Ejecutar seed de ejercicios: `node projects/healthy/database/seedExercises.js` con DATABASE_URL de Railway | IMPORTANTE | Pendiente |
| M-5 | Registrar Bundle ID `com.healthy.app` en developer.apple.com | IMPORTANTE | Pendiente |
| M-6 | Crear app en App Store Connect para iOS | IMPORTANTE | Pendiente (depende M-5) |
| M-7 | Instalar y probar APK en dispositivo Android real | IMPORTANTE | Pendiente (depende M-2/M-3) |
| M-8 | Publicar APK en Google Play Console → Internal Testing | IMPORTANTE | Pendiente (depende M-7) |
| M-9 | Configurar dominio `api.healthy.app` → Railway en panel DNS | PRO FINAL | Pendiente |
| M-10 | Lighthouse landing | PRO FINAL | ✅ Completada — analisis estatico (Perf 95-98, Acc 82-88, SEO 85-92). Lighthouse real pendiente de M-9 (DNS) |
| M-11 | Configurar ANTHROPIC_API_KEY en Railway staging variables de entorno | CRITICO | ✅ Completada — configurado en staging |
| M-11b | Añadir créditos a cuenta Anthropic (console.anthropic.com → Plans & Billing) | CRITICO | ❌ PENDIENTE — sin créditos Claude API devuelve "credit balance is too low" y el backend usa siempre fallback |
| M-12 | Re-ejecutar CP-01..CP-10 tras créditos Anthropic activos | IMPORTANTE | Pendiente (depende M-11b) |
| M-13 | Aprobar y mergear PR develop → main en GitHub | RELEASE | Pendiente |
| M-14 | Crear tag v1.0.0: `git tag v1.0.0 && git push origin v1.0.0` | RELEASE | Pendiente (depende M-13) |

## Tareas pendientes — AUTOMATICAS (agentes)

| ID | Tarea | Agente | Estado | Depende de |
|----|-------|--------|--------|------------|
| A-1 | Mejorar branch coverage de 69.57% a 80%+ | Tests Agent | ✅ Completada — 85.01% / 454 tests | Nada |
| A-2 | Build iOS en EAS: `eas build --platform ios --profile preview` | DevOps Agent | Pendiente | M-5, M-6 |
| A-3 | Subir a TestFlight: `eas submit --platform ios` | DevOps Agent | Pendiente | A-2 |
| A-4 | Deploy a Railway tras merge a main | CI/CD GitHub Actions | Pendiente | M-13 |
| A-5 | Generar documentacion API (Swagger/OpenAPI) con endpoint /exercises | Docs Agent | ✅ Completada — swagger.yaml 40 endpoints | Nada |
| A-Landing | Corregir Accessibility y SEO landing (scores actuales 82-88 → 95+) | Frontend Agent | Puede hacerse ya | Nada |

---

## Checklist Go-live

| Criterio | Objetivo | Estado |
|----------|----------|--------|
| Tests lineas | >= 80% | ✅ OK — 96.78% |
| Tests branches | >= 80% | ✅ OK — 85.01% |
| Lighthouse landing | >= 95 | ⚠️ PARCIAL — Perf 95-98 OK, Acc 82-88 y SEO 85-92 requieren correcciones (A-Landing) |
| App Android Google Play Internal | Publicada | PENDIENTE |
| App iOS TestFlight | Publicada | PENDIENTE |
| Backend staging operativo | Activo | ✅ ACTIVO |
| ANTHROPIC_API_KEY en staging | Configurado | ✅ Configurado |
| Créditos Anthropic | Disponibles | ❌ PENDIENTE — M-11b (error "credit balance is too low") |
| Seed 1.324 ejercicios ejecutado | Completo | PENDIENTE — ejecutar M-4 |
| CP-01..CP-10 con IA activa | 8+/10 | ⚠️ PARCIAL — score 35/50 con fallback; re-ejecutar tras M-11b |
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
