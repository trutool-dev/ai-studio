# Tareas de seguridad — Healthy — Auditoría 2026-10-19

> Lista consolidada y deduplicada por el orquestador a partir de:
> - `SECURITY_AUDIT_2026-10-19.md` (agente security, hallazgos provisionales `SA-01..SA-34`)
> - `ATLAS_AUDIT.md` / `LLM_THREATS.md` / `PROMPT_REVIEW.md` (agente JailBreak, hallazgos provisionales `JB-01..JB-20`)
>
> Numeración definitiva: **SEC-25 .. SEC-72** (continúa la de `auditoria_atlas_mitre.md`). Cada tarea tiene un único ID; la columna "Origen" indica los hallazgos provisionales que agrupa (8 hallazgos aparecían en ambos informes y se han fusionado). Los informes de los agentes conservan sus IDs provisionales: esta tabla es la correspondencia oficial.
>
> Leyenda de prioridad: 🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja. "Bloquea" = bloquea el deploy a producción.
> Ningún valor de secreto aparece en este documento.

## 1. Tareas nuevas (SEC-25 .. SEC-72)

| ID | Prio | Origen | Tarea | Agente | Archivo afectado | Bloquea |
|---|---|---|---|---|---|---|
| SEC-25 | 🔴 | SA-01 | Rotar `JWT_SECRET`/`JWT_REFRESH_SECRET` expuestos (M-21) y sustituir los valores del doc por placeholders | Antonio (manual) + devops | `devops/GITHUB_SECRETS.md` | Sí |
| SEC-26 | 🔴 | SA-02 | Rotar credenciales PostgreSQL versionadas (staging y producción), cerrar proxy TCP público; quitar credenciales de archivos versionados | Antonio (manual) + devops | `check-db.js`, `prisma-migrate*.bat`, `GO_LIVE_CHECKLIST.md`, `.claude/settings.local.json` | Sí |
| SEC-27 | 🔴 | SA-03 | `POST /auth/set-password` sin prueba de posesión → toma de control de cuentas. Exigir token de un solo uso caducable | backend | `backend/src/controllers/auth.controller.js` | Sí |
| SEC-28 | 🔴 | JB-01 | Alergias/lesiones/condiciones del onboarding no llegan al prompt (desajuste frontend↔backend); fallback con alérgenos fijos; 500 en dieta keto/other | backend + ai | `onboarding.controller.js`, `routes/onboarding.routes.js`, `aiService.js` | Sí |
| SEC-29 | 🔴 | JB-02 + SA-18 | Edad mínima 16 y rangos fisiológicos eludibles vía `/onboarding/complete` (reabre SEC-20) | backend | `onboarding.controller.js` | Sí |
| SEC-30 | 🟠 | SA-04 | Endpoints dev (`/auth/dev/code`, `/auth/dev/auto-verify`) fail-open (`NODE_ENV !== 'production'`) → allowlist explícita por variable + token | backend | `auth.controller.js`, `auth.routes.js` | Sí |
| SEC-31 | 🟠 | SA-05 | OTP con fuerza bruta: el contador de intentos no se incrementa | backend | `auth.controller.js` | Sí |
| SEC-32 | 🟠 | SA-06 + JB-07 | Rate limiting ineficaz: `trust proxy`, `apiLimiter` después de `authenticate`, keyGenerator, store Redis (reabre SEC-05/SEC-06) | backend | `app.js`, `middleware/rateLimiter.middleware.js` | Sí |
| SEC-33 | 🟠 | SA-07 + JB-09 | Consentimiento Art. 9 no validado en servidor; IA llamada sin consentimiento; DPA/SCC con Anthropic (parte legal → Antonio) | backend + Antonio | `onboarding.controller.js`, `auth.controller.js` | Sí |
| SEC-34 | 🟠 | SA-08 | Build de producción apunta a `api.healthy.app` sin titularidad verificada | Antonio (manual) + frontend | `frontend/eas.json` | Sí |
| SEC-35 | 🟠 | JB-03 | El frontend ignora errores de guardado del onboarding y envía `healthConsent: true` fijo | frontend | `frontend/src/screens/onboarding/*.tsx` | No |
| SEC-36 | 🟠 | JB-04 | Validación de esquema y rangos de la salida del LLM (zod) antes de guardar/iterar; transacción (reabre SEC-07/SEC-11) | ai + backend | `aiService.js`, `onboarding.controller.js`, `plans.controller.js` | No (muy recomendado) |
| SEC-37 | 🟠 | JB-05 | Salvaguardas clínicas en prompt y salida (mínimo calórico, IMC bajo, menores, TCA) | ai | `aiService.js` | No (recomendado) |
| SEC-38 | 🟠 | JB-06 | Endurecer `sanitizeTextField`: NFKC, Cf/Cc, escape de delimitadores, presupuesto por prioridad (reabre SEC-01/17/18) | ai | `aiService.js` | No |
| SEC-39 | 🟠 | SA-15 + JB-08 | `/health/ai`: bloqueo fail-open, token opcional, sin rate limit, llama a Anthropic, filtra `err.message` (reabre SEC-08/SEC-19) | backend | `app.js` | No |
| SEC-40 | 🟡 | SA-09 | `.claude/settings.local.json` versionado con tokens/URLs de BD → `git rm --cached` + `.gitignore` | Antonio (decisión) | `.claude/settings.local.json` | No |
| SEC-41 | 🟡 | SA-10 | Credenciales del usuario de staging en texto plano en la memoria del orquestador | orquestador + Antonio | `memory/current_status.md` | No |
| SEC-42 | 🟡 | SA-11 + JB-20 | Escaneo de secretos insuficiente (hook excluye `*.md`) y docs internos versionados; `.gitignore` ignora entregables de seguridad (reabre SEC-14/SEC-24) | devops | `.husky/pre-commit`, `.gitignore`, CI | No |
| SEC-43 | 🟡 | SA-12 | Sin limitador en `reset-password`, `refresh` y rutas dev (VUL-2026-011 reabierta) | backend | `routes/auth.routes.js` | Sí |
| SEC-44 | 🟡 | SA-13 | JWT sin algoritmo fijado ni revocación por sesión (VUL-2026-014) | backend | `middleware/auth.middleware.js`, `auth.controller.js` | No |
| SEC-45 | 🟡 | SA-14 | Refresh/OTP/reset guardados en claro, sin detección de reutilización, reset 24 h (VUL-2026-016/018) | backend + database | `schema.prisma`, `auth.controller.js` | No |
| SEC-46 | 🟡 | SA-16 + JB-14 | Validación de entorno al arrancar; cifrado/HMAC de caché fail-open; comparación no constante (reabre SEC-10/SEC-16) | backend | `server.js`, `utils/crypto.util.js`, `aiService.js` | Sí |
| SEC-47 | 🟡 | SA-17 | Consentimiento sin versionado real ni retirada (B-03) | backend + frontend + docs | `onboarding.controller.js` | No |
| SEC-48 | 🟡 | SA-19 | `DELETE /user/me` no transaccional, sin reautenticación, no purga Redis (VUL-2026-001) | backend | `user.controller.js` | No |
| SEC-49 | 🟡 | SA-20 | Export Art. 15/20 incompleto (VUL-2026-002) | backend | `user.controller.js` | No |
| SEC-50 | 🟡 | SA-21 | Sin política de retención aplicada (sesiones, OTP, tokens, IPs) | backend + devops | `schema.prisma`, job | No |
| SEC-51 | 🟡 | SA-22 + JB-19 | PII, OTP y enlaces de reset en logs; errores de Prisma/SDK completos | backend | `email.service.js`, `auth.controller.js`, `errorHandler.middleware.js` | No |
| SEC-52 | 🟡 | SA-23 | Validación de entrada incompleta (N-1 `quantity_g`/`food_id`, `completeSession`, query params) | backend | `nutrition.controller.js`, `training.controller.js` | No |
| SEC-53 | 🟡 | SA-24 | Dependencias backend vulnerables alcanzables (nodemailer, morgan, express/qs, prisma) | backend + devops | `backend/package.json` | No |
| SEC-54 | 🟡 | JB-10 | Catálogo de ejercicios pasado como `extraContext` y truncado a 500 chars; `id` ausente del esquema (reabre SEC-03/SEC-23) | ai | `aiService.js`, `onboarding.controller.js` | No |
| SEC-55 | 🟡 | JB-11 | Cliente Anthropic sin timeout/maxRetries propios; `stop_reason` no tratado | ai | `aiService.js` | No |
| SEC-56 | 🟡 | JB-12 | Sin medición de tokens/coste por usuario (`TokenUsageLog` nunca se escribe); sin prompt caching | ai | `aiService.js` | No |
| SEC-57 | 🟡 | JB-13 | Plan de respaldo cacheado 24 h; caché no invalidada al cambiar el perfil | ai | `aiService.js` | No |
| SEC-58 | 🟡 | JB-15 | Exclusión de ejercicios por lesión no funciona (claves frontend↔selector no coinciden) (reabre SEC-15) | backend | `exerciseSelector.service.js` | No |
| SEC-59 | 🟡 | JB-16 | `@anthropic-ai/sdk` 0.52.0 desactualizado; PR dependabot a 0.133 con CI en rojo | backend | `backend/package.json` | No |
| SEC-60 | 🟢 | SA-25 | Enumeración de usuarios | backend | `auth.controller.js` | No |
| SEC-61 | 🟢 | SA-26 | Asignación masiva con spread en `createMany` | backend | `onboarding.controller.js` | No |
| SEC-62 | 🟢 | SA-27 | `/exercises` crea Pool/PrismaClient por petición | backend | `routes/exercises.routes.js` | No |
| SEC-63 | 🟢 | SA-28 | Texto libre de salud sin límite de longitud (VUL-2026-013/022) | backend | `routes/onboarding.routes.js` | No |
| SEC-64 | 🟢 | SA-29 | `photo_url` admite URLs arbitrarias (VUL-2026-007) | backend | `routes/progress.routes.js` | No |
| SEC-65 | 🟢 | SA-30 | Frontend: fallback HTTP y sin certificate pinning | frontend | `frontend/src/services/api.ts` | No |
| SEC-66 | 🟢 | SA-31 | Dependencias del frontend (axios, cadena de build) | frontend | `frontend/package.json` | No |
| SEC-67 | 🟢 | SA-32 | El contenedor arranca aunque falle `prisma migrate deploy` | devops | `backend/Dockerfile` | No |
| SEC-68 | 🟢 | SA-33 + JB-18 | Código muerto (`authService.js`, `cacheService.js`, `ai/`, `src/`) con `require` roto y prompts sin sanitizar | backend + orquestador | `backend/src/services/`, `ai/`, `src/` | No |
| SEC-69 | 🟢 | SA-34 | RAT (`DATA_REGISTER.md`) no refleja el sistema real | docs | `security/DATA_REGISTER.md` | No |
| SEC-70 | 🟢 | JB-17 | `AI_SYSTEM_PROMPT` sustituye el bloque de seguridad; `ANTHROPIC_MODEL` sin uso | ai | `aiService.js` | No |
| SEC-71 | 🟢 | VUL-2026-017 / B-02 (reabierta) | `/health` expone versión y estado de BD/Redis sin rate limit | backend | `app.js` | No |
| SEC-72 | 🟢 | VUL-2026-015 (reabierta) | Se permite nueva contraseña igual a la anterior | backend | `auth.controller.js` | No |

**Bloquean el deploy a producción (12):** SEC-25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 43, 46.

## 2. Tareas previas SEC-01..SEC-24 reabiertas

Resultado de la verificación en código (detalle en `ATLAS_AUDIT.md` §"Tabla de verificación" y `SECURITY_AUDIT_2026-10-19.md` §2.3):

| Estado | IDs | Cubierta ahora por |
|---|---|---|
| ✅ Verificada (7) | SEC-02, 04, 09, 12, 13, 21, 22 | — |
| ⚠️ Parcial / eludible (13) | SEC-01, 05, 06, 07, 08, 10, 11, 14, 15, 16, 17, 18, 19 | SEC-38 (01/17/18), SEC-32 (05/06), SEC-36 (07/11), SEC-39 (08/19), SEC-46 (10/16), SEC-42 (14), SEC-58 (15) |
| ❌ No efectiva / regresión (4) | SEC-03, 20, 23, 24 | SEC-54 (03/23), SEC-29 (20), SEC-42 (24) |

## 3. Orden de ejecución propuesto

1. **Fase 1 (explotable hoy / salud):** SEC-27 → SEC-30 → SEC-28 → SEC-29.
2. **Fase 2 (resto 🔴/🟠 corregibles en código):** SEC-31, SEC-32, SEC-33, SEC-35, SEC-36, SEC-37, SEC-38, SEC-39, SEC-43, SEC-46.
3. **Fase 3 (🟡/🟢 sin decisión de producto).**
4. **Manual Antonio:** SEC-25, SEC-26 (rotación), SEC-34 (dominio), SEC-33 parte legal (DPA/SCC), SEC-40 (`git rm --cached`), SEC-41 (limpiar memoria).

## 4. Estado de ejecución

Se actualiza en `projects/healthy/PROJECT_STATUS.md`, sección "Auditoría de seguridad 2026-10-19 (Opus)".
