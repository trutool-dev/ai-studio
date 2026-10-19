# Auditoría de Seguridad — Healthy — 2026-10-19

> **Nota del orquestador (2026-10-19):** los IDs provisionales SA-xx / JB-xx de este informe se han consolidado como **SEC-25..SEC-72** en `SECURITY_TASKS.md` (columna "Origen"). Resumen ejecutivo: `AUDIT_SUMMARY_2026-10-19.md`.

| Campo | Valor |
|---|---|
| **Fecha** | 2026-10-19 |
| **Auditor** | Agente security (ai-studio) — modelo Opus |
| **Alcance** | `projects/healthy/backend` (Express + Prisma + Redis), `projects/healthy/frontend` (Expo/React Native), configuración (Dockerfile, railway.toml, eas.json, workflows), documentación con secretos, dependencias, RGPD/LOPDGDD |
| **Fuera de alcance** | Prompt injection / MITRE ATLAS / OWASP LLM (lo cubre el agente JailBreak). Del componente IA solo se revisa lo clásico: auth, rate limit, exposición de datos, secretos |
| **Método** | Revisión **estática** e independiente del código (no se han dado por buenos los documentos de estado). Únicas peticiones de red: `GET /health` a staging y producción. `npm audit --omit=dev` en solo lectura |
| **Commit auditado** | `4993123ffc8c861bf378489aed174428f11339dc` (rama `develop`) |
| **Auditorías previas verificadas** | `SECURITY_AUDIT.md` (2026-06-07), `SECURITY_AUDIT_FINAL.md` (2026-06-15), `VULNERABILITIES.md` (VUL-2026-001..022), parte clásica de `auditoria_atlas_mitre.md` (SEC-xx) |

> Política de este documento: **no contiene valores de secretos**. Se cita archivo y línea. Los IDs `SA-nn` son provisionales; el orquestador los renumerará al consolidar.

---

## 1. Resumen ejecutivo

| Severidad | Nº | IDs |
|---|---|---|
| 🔴 Crítica | 3 | SA-01, SA-02, SA-03 |
| 🟠 Alta | 5 | SA-04 … SA-08 |
| 🟡 Media | 16 | SA-09 … SA-24 |
| 🟢 Baja | 10 | SA-25 … SA-34 |
| **Total** | **34** | |

**Veredicto: NO APTO para desplegar a producción.** Tres hallazgos críticos lo impiden:

1. **SA-03 — Toma de control de cualquier cuenta sin autenticación.** `POST /auth/set-password` cambia la contraseña de cualquier usuario con email verificado con solo conocer su email. No pide token, OTP ni sesión, y no tiene rate limit. Con eso se accede a todos los datos de salud de la víctima.
2. **SA-02 — Credenciales reales de PostgreSQL (staging y producción) versionadas en git.** Están en 5 archivos rastreados, y los hosts son el proxy TCP público de Railway, accesible desde Internet.
3. **SA-01 — `JWT_SECRET` reales en `devops/GITHUB_SECRETS.md`** desde `414d4c2` (M-21, sin rotar). Si alguno coincide con el configurado en Railway, cualquiera con acceso al repo puede firmar access tokens para cualquier `userId`.

Más conclusiones relevantes:
- **Varias correcciones declaradas como "RESUELTO" no existen en el código.** VUL-2026-003/M-04: el backend no valida `healthConsent`. VUL-2026-011: `apiLimiter` no cubre `/auth`.
- **El rate limiting es ineficaz en Railway.** Falta `trust proxy` y el `apiLimiter` se monta antes de `authenticate` (SA-06).
- **Los endpoints de depuración se bloquean con una lista negra (fail-open):** solo se desactivan si `NODE_ENV === 'production'` exactamente. En staging permiten a cualquiera fijar la contraseña de cualquier cuenta (SA-04).
- **La app de producción (`eas.json`) apunta a `https://api.healthy.app`**, un dominio cuya titularidad no consta en el proyecto (SA-08).

---

## 2. Verificación de vulnerabilidades previas

Leyenda: ✅ verificada · ⚠️ parcial / eludible · ❌ no implementada, regresión o declarada resuelta sin serlo.

### 2.1 `VULNERABILITIES.md` (VUL-2026-001 … 022)

| ID previo | Descripción | Estado | Evidencia (archivo:línea) | Comentario |
|---|---|---|---|---|
| VUL-2026-001 | Derecho al olvido `DELETE /user/me` | ⚠️ | `backend/src/routes/user.routes.js:11`, `backend/src/controllers/user.controller.js:17-95` | Existe, pero el borrado no es transaccional. No pide reautenticación. Deja en Redis `plan:{userId}:{fecha}` y otras sesiones, y el access token sigue siendo válido → **SA-19** |
| VUL-2026-002 | Portabilidad `GET /user/me/export` | ⚠️ | `user.controller.js:103-198` | Faltan comidas, sesiones de entrenamiento, respuestas de onboarding, registro de consentimiento, teléfono, sesiones/IPs y contenido de los planes → **SA-20** |
| VUL-2026-003 | Consentimiento explícito Art. 9 | ❌ (declarado resuelto) | `backend/src/controllers/onboarding.controller.js:115,128-135`; `auth.controller.js:68-70` | `healthConsent` se desestructura pero **nunca se comprueba**. El consentimiento se registra automáticamente en cualquier `PUT /onboarding/health`, incluso con body vacío. En `register` la fecha de consentimiento la fija el cliente → **SA-07** |
| VUL-2026-004 | Edad mínima 16 años | ⚠️ | `auth.controller.js:51-60` (birthdate opcional), `onboarding.controller.js:178-188` | Se elude con `POST /onboarding/complete`: crea el perfil con `profile.age` del body sin comprobar la edad → **SA-18** |
| VUL-2026-005 | Rate limit `/plans/regenerate` | ⚠️ | `backend/src/routes/plans.routes.js:11`, `middleware/rateLimiter.middleware.js:34-41` | Se aplica tras `authenticate` (clave = userId, correcto). El store está en memoria: se resetea en cada deploy/reinicio y no se comparte entre instancias → **SA-06** |
| VUL-2026-006 | Cifrado de columna en `HealthCondition` | ❌ (riesgo aceptado) | `backend/prisma/schema.prisma:244-256` | Sigue sin cifrado a nivel de columna. Se mantiene como riesgo aceptado; conviene revisarlo antes de producción con usuarios reales (Art. 32) |
| VUL-2026-007 | `photo_url` sin control de acceso | ❌ (la justificación ya no vale) | `schema.prisma:596`, `routes/progress.routes.js:21` | Se aceptó porque "Supabase Storage es privado", pero Supabase se eliminó (`25f1359`). Hoy `photo_url` admite cualquier URL externa → **SA-29** |
| VUL-2026-008 | CSP en Helmet | ✅ | `backend/src/app.js:27-38` | Confirmado en la respuesta real de staging. `default-src 'self'` (para una API pura bastaría `'none'`; mejora menor) |
| VUL-2026-009 | CORS con fallback `*` | ✅ | `app.js:45-52` | Sin wildcard. Si `FRONTEND_URL` está vacía se rechazan todos los orígenes de navegador (fail-closed). Admite peticiones sin `Origin` (apps móviles); aceptable con tokens Bearer y sin cookies |
| VUL-2026-010 | OTP con `Math.random` | ✅ | `backend/src/utils/crypto.util.js:26-28` | Usa `crypto.randomInt`. Pero el contador de intentos no funciona → **SA-05** |
| VUL-2026-011 | Rate limit en `set-password` / `reset-password` | ❌ (declarado resuelto) | `app.js:120-130`, `routes/auth.routes.js:24-26,38-40,47-49` | `apiLimiter` **no** se monta en `/auth`. `set-password`, `reset-password`, `refresh` y `dev/*` no tienen limitador → **SA-12** (y SA-03) |
| VUL-2026-012 | Rate limiter en memoria | ❌ | `rateLimiter.middleware.js:17-63` | Ningún limitador usa store Redis → se incluye en **SA-06** |
| VUL-2026-013 | `ai_prompt_used` con datos de salud | ⚠️ | `controllers/plans.controller.js:60,122`; `onboarding.controller.js:302` | Ya no guarda el prompt completo: guarda `reason` (texto libre del usuario, sin límite de longitud) o un literal. Riesgo reducido → límite de longitud en **SA-28** |
| VUL-2026-014 | Algoritmo JWT no fijado | ❌ | `auth.controller.js:17-23`, `middleware/auth.middleware.js:18` | No se pasa `algorithm` a `sign` ni `algorithms` a `verify` → **SA-13** |
| VUL-2026-015 | Nueva contraseña igual a la anterior | ❌ | `auth.controller.js:237-257` | Sigue abierta (Baja). Sin tarea nueva; mantener VUL-2026-015 |
| VUL-2026-016 | Refresh token `uuid.timestamp` | ❌ | `auth.controller.js:25-28` | Igual que antes, y además se guarda en claro en BD → **SA-14** |
| VUL-2026-017 | `/health` expone versión/BD/Redis | ❌ | `app.js:85-113` | Confirmado en vivo en staging y producción (`version`, `db`, `redis`). Sigue abierta (Baja). Además ejecuta `SELECT 1` en cada petición, sin rate limit |
| VUL-2026-018 | Token de reset con validez de 24 h | ❌ | `auth.controller.js:223` | Sigue en 24 h → **SA-14** |
| VUL-2026-019 | HSTS includeSubDomains/preload | ✅ | `app.js:40` | Confirmado en la cabecera real de staging |
| VUL-2026-020 | Middlewares duplicados | ✅ / ⚠️ | `backend/src/middleware/` | Los duplicados de middleware se eliminaron, pero quedan servicios muertos y rotos (`services/authService.js`, `services/cacheService.js`) → **SA-33** |
| VUL-2026-021 | X-Frame-Options DENY | ✅ | `app.js:39` | Confirmado en vivo |
| VUL-2026-022 | `injuries_or_limitations` como dato Art. 9 | ❌ | `schema.prisma:221`, `onboarding.controller.js:83-89` | Sin límite de longitud y sin tratamiento específico → **SA-28** |

### 2.2 `SECURITY_AUDIT_FINAL.md` (M-01..M-04, B-01..B-04) y `SECURITY_AUDIT.md`

| ID previo | Descripción | Estado | Evidencia | Comentario |
|---|---|---|---|---|
| M-01 | `apiLimiter` global | ⚠️ | `app.js:120-128`; `rateLimiter.middleware.js:30` | Se aplica, pero **antes** de `authenticate`: `req.user` aún no existe y la clave es siempre `req.ip`, que sin `trust proxy` es la IP del proxy de Railway → **SA-06** |
| M-02 | `JWT_EXPIRES_IN=7d` en Docker | ✅ | `projects/healthy/.env` y `backend/.env` (ambos `15m`, no versionados) | Alineado. Falta validar el valor al arrancar (**SA-16**) |
| M-03 | Falta `.gitignore` en la raíz del proyecto | ✅ | `projects/healthy/.gitignore:1` | `.env` ignorado (`git check-ignore` lo confirma) |
| M-04 | Consentimiento Art. 9 implícito | ❌ | `onboarding.controller.js:115-135` | El frontend envía `healthConsent: true` (`frontend/src/screens/onboarding/OnboardingHealth.tsx:53`), pero el backend lo ignora → **SA-07** |
| B-01 | Body de 10 MB | ✅ | `app.js:54` | 50 kb |
| B-02 | `/health` sin auth | ❌ | `app.js:85-113` | Igual que VUL-2026-017 |
| B-03 | `health_consent_version` fijo en `'1.0'` | ❌ | `onboarding.controller.js:132`, `auth.controller.js:69` | → **SA-17** |
| B-04 | Morgan y datos en query string | ⚠️ | `app.js:53`, `routes/auth.routes.js:52` | Ahora **sí** hay un endpoint con email en query (`GET /auth/dev/code?email=`), que queda en los logs de morgan → **SA-22** |
| ENV-02 | Sin validación de `JWT_SECRET` al arrancar | ❌ | `server.js:1-8` | Sin validación de entorno → **SA-16** |
| HDR-06 / ENV-06 | CORS `*` | ✅ | `app.js:45-52` | Ver VUL-2026-009 |
| RL-02 | Limiter en set/reset-password | ❌ | `auth.routes.js:24-26,38-40` | → **SA-12** |
| RL-04 | Store en memoria | ❌ | — | → **SA-06** |
| RGPD-05 | Derecho de acceso completo | ⚠️ | `user.controller.js:103-198` | → **SA-20** |
| JWT-02 | Formato del refresh token | ❌ | `auth.controller.js:25-28` | → **SA-14** |
| MISC-04 | Reset de 24 h | ❌ | `auth.controller.js:223` | → **SA-14** |

### 2.3 Tareas SEC-xx de `auditoria_atlas_mitre.md` (solo la parte clásica; el resto, al JailBreak)

| ID previo | Descripción | Estado | Evidencia | Comentario |
|---|---|---|---|---|
| SEC-04 | `userId` siempre del JWT | ✅ | `plans.controller.js:59`; todos los controladores usan `req.user.userId` | Sin IDOR por body |
| SEC-05 | `registrationLimiter` 3/h por IP | ⚠️ | `auth.routes.js:14`, `rateLimiter.middleware.js:44-51` | Clave `req.ip` = IP del proxy de Railway, y sin `trust proxy` el contador es compartido → **SA-06** |
| SEC-06 | `planGenerationLimiter` | ⚠️ | `onboarding.routes.js:91`, `rateLimiter.middleware.js:54-62` | Clave correcta (userId, montado tras `authenticate`), pero el store está en memoria |
| SEC-10 | Caché IA cifrada con AES-256-GCM | ⚠️ | `services/aiService.js:423-435`; `utils/crypto.util.js:43-44` | **Fail-open**: si falta `REDIS_ENCRYPTION_KEY` se guarda en claro sin aviso. Con claves de 32-63 caracteres hex, `createCipheriv` lanza error y no se cachea → **SA-16** |
| SEC-12 | `express.json` 50 kb | ✅ | `app.js:54` | — |
| SEC-13 | `npm audit` en CI + Dependabot | ⚠️ | `.github/workflows/security-audit.yml` | El job (`--audit-level=high`) falla con las dependencias actuales; probable causa común del rojo de las PRs → **SA-24** |
| SEC-14 | `.gitignore` de docs internos | ⚠️ | `.gitignore` (raíz) | Los patrones se añadieron, pero `.gitignore` no deja de rastrear archivos ya versionados: `PR-*-READY.md`, `ORCHESTRATOR_STATUS.log`, `auditoria_atlas_mitre.md`, `SECRETS_STATUS.md`, `.claude/settings.local.json`… siguen en git → **SA-11** |
| SEC-16 | HMAC de la caché | ⚠️ | `aiService.js:463-475` | Fail-open si falta `REDIS_HMAC_SECRET`. Comparación no constante (impacto menor) → **SA-16** |
| SEC-19 | `/health/ai` con token de admin | ⚠️ | `app.js:62-83` | El token es **opcional** (`if (adminToken && …)`): sin `ADMIN_TOKEN` el endpoint queda abierto. Bloqueo solo por `NODE_ENV === 'production'` → **SA-15** |
| SEC-21 | `X-Powered-By` desactivado | ✅ | Cabeceras reales de staging y producción | No aparece |
| SEC-22 | TTL de JWT 15 min | ✅ | `auth.controller.js:21` | Depende de la variable `JWT_EXPIRES_IN`, que no se valida (SA-16) |
| SEC-24 | Política de secretos + pre-commit | ⚠️ | `.husky/pre-commit` | Solo detecta `sk-ant-` y **excluye `*.md`** y rutas con `test`/`example`. No detectó las URLs de PostgreSQL ni los JWT_SECRET de los `.md` → **SA-11** |
| SEC-09, 11, 15, 17, 18, 20, 23 | Prompt / salida IA | — | — | Fuera de mi ámbito: los verifica el JailBreak |

---

## 3. Hallazgos nuevos

### SA-01 — Secretos JWT reales en `devops/GITHUB_SECRETS.md` (M-21, sin rotar)
- **Severidad:** 🔴 Crítica
- **Categoría:** OWASP A02 Cryptographic Failures / A07; RGPD Art. 32
- **Archivo:** `projects/healthy/devops/GITHUB_SECRETS.md:43,44` (staging) y `:61,62` (producción). En el historial desde `414d4c2`; también en `46588ed`, `25f1359` y `9f5b847` (`git log --all -- projects/healthy/devops/GITHUB_SECRETS.md`). `PR-5-READY.md:27,42`, `devops/SECRETS_STATUS.md:35,51` y `GO_LIVE_CHECKLIST.md:43,77` indican cargarlos "tal cual".
- **Descripción:** hay cuatro valores reales de 512 bits (base64), presentados como "pre-generados" para cargarlos en Railway y GitHub. Siguen en el HEAD actual. `JWT_REFRESH_SECRET` no se usa en el código (los refresh tokens son opacos); el que importa es `JWT_SECRET`, que firma y verifica los access tokens (`auth.controller.js:20`, `auth.middleware.js:18`).
- **Impacto:** si el `JWT_SECRET` de Railway coincide con el del documento, cualquiera con lectura del repositorio (colaboradores, forks, filtraciones, el repo si se hace público) puede fabricar un token con el `userId` de otro usuario y leer o borrar todos sus datos de salud. El payload no se contrasta con ninguna sesión (SA-13).
- **Vector:** lectura del archivo o del historial git → firma HS256 de un payload con `userId` arbitrario.
- **Mitigación:** (1) Antonio genera secretos nuevos (`openssl rand -base64 64`) solo en Railway y GitHub Secrets, nunca en archivos. (2) Sustituir los valores del documento por `<generar en Railway>`. (3) Valorar purgar el historial (`git filter-repo`) y forzar la invalidación de sesiones. (4) Comprobar en GitHub la visibilidad del repo y los colaboradores.
- **Responsable:** Antonio-manual (rotación) + devops (limpieza del doc)
- **¿Bloquea deploy a producción?:** **Sí**

### SA-02 — Credenciales de PostgreSQL de staging y producción versionadas en git
- **Severidad:** 🔴 Crítica
- **Categoría:** OWASP A02 / A05; RGPD Art. 32 y 33
- **Archivos (rastreados en git):**
  - `check-db.js:2` (raíz del repo, BD de producción, puerto 25732)
  - `prisma-migrate-prod.bat:9` (producción)
  - `prisma-migrate.bat:4` (staging, puerto 44480)
  - `projects/healthy/GO_LIVE_CHECKLIST.md:418` (staging) y `:450` (producción)
  - `.claude/settings.local.json:108-111` (staging)
  - En el historial desde `414d4c2` / `46588ed`.
- **Descripción:** son cadenas `postgresql://postgres:<contraseña de 32 caracteres>@thomas.proxy.rlwy.net:<puerto>/railway` con contraseña real y usuario superusuario `postgres`. El host es el **proxy TCP público** de Railway, accesible desde Internet.
- **Impacto:** acceso directo de lectura y escritura a todas las tablas: datos de salud Art. 9, hashes, refresh tokens en claro (SA-14), OTP. Si se ha leído, sería una brecha notificable a la AEPD en 72 h (Art. 33). La BD de producción parece caída o eliminada (prod responde `db: error`), pero hay que confirmar si esa credencial sigue viva y si es la que usará la nueva instancia.
- **Vector:** lectura del repo o del historial → conexión directa al proxy público.
- **Mitigación:** (1) Antonio rota ya la contraseña de la BD de staging (y la de prod si existe) en Railway. (2) Desactivar el *TCP Proxy / public networking* de PostgreSQL si no hace falta, o restringirlo. (3) Borrar del árbol `check-db.js`, `prisma-migrate*.bat` y las líneas de `GO_LIVE_CHECKLIST.md`; usar variables de entorno. (4) Sacar `.claude/settings.local.json` del control de versiones (SA-09). (5) Revisar los logs de conexión de Railway para descartar accesos ajenos y documentarlo en `INCIDENT_RESPONSE`. (6) Valorar `git filter-repo`.
- **Responsable:** Antonio-manual (rotación y networking) + devops (limpieza)
- **¿Bloquea deploy?:** **Sí**

### SA-03 — Toma de control de cuentas: `POST /auth/set-password` sin prueba de posesión
- **Severidad:** 🔴 Crítica
- **Categoría:** OWASP A07 Identification & Authentication Failures / A01; RGPD Art. 32
- **Archivo:** `backend/src/routes/auth.routes.js:24-26`; `backend/src/controllers/auth.controller.js:130-145`
- **Descripción:** el endpoint recibe `{email, password}` y, si el usuario existe y tiene `email_verified = true`, sobrescribe `password_hash` y pone `status = 'active'`. No exige token de verificación, OTP, sesión ni contraseña actual. Tampoco tiene rate limit (no pasa por `authRateLimiter` ni por `apiLimiter`) ni invalida sesiones. Todas las cuentas activas tienen `email_verified = true`, así que todas son vulnerables.
- **Impacto:** toma de control total de cualquier cuenta conociendo solo su email. Acceso a todos los datos de salud, exportación (`/user/me/export`) y borrado de la cuenta.
- **Vector:** petición no autenticada a `set-password` con el email de la víctima y una contraseña elegida, seguida de `login`.
- **Mitigación:** (1) `verify-email` debe devolver un token de un solo uso, de corta duración (≤ 15 min), guardado con hash y ligado al `user_id`; `set-password` debe exigirlo. (2) Rechazar `set-password` si el usuario ya tiene `password_hash` (para cambios, usar reset-password o un endpoint autenticado con la contraseña actual). (3) Aplicar `authRateLimiter`. (4) Invalidar sesiones al cambiar la contraseña. (5) Test de regresión.
- **Responsable:** backend (+ frontend para pasar el token del paso verify → set-password)
- **¿Bloquea deploy?:** **Sí**

### SA-04 — Endpoints de depuración con bloqueo fail-open; toma de control en staging
- **Severidad:** 🟠 Alta
- **Categoría:** OWASP A05 Security Misconfiguration / A07
- **Archivo:** `auth.routes.js:52-53`; `auth.controller.js:328-346` (`getDevCode`, comprobación en `:329`) y `:352-381` (`devAutoVerify`, comprobación en `:353`, contraseña por defecto fija en `:357`); `app.js:63` (`/health/ai`)
- **Cómo se bloquean exactamente:** solo con `if (process.env.NODE_ENV === 'production') return 404`. No hay header, host, token ni flag adicional, y las rutas se montan siempre.
  - Es **fail-open**: cualquier valor distinto de la cadena exacta `production` los activa (`NODE_ENV` sin definir, `prod`, `Production`, `staging`, espacios, etc.). Railway no fija `NODE_ENV` por defecto, y `GO_LIVE_CHECKLIST.md:41,370` documenta `NODE_ENV=staging` para staging.
  - Es manipulable por mala configuración, no por el cliente.
- **Descripción:**
  - `POST /auth/dev/auto-verify` marca el email como verificado y **fija una contraseña** (la del body o una por defecto, que también está en `tests/run_cp_tests*.py`) a **cualquier** usuario existente.
  - `GET /auth/dev/code?email=` devuelve el OTP vigente.
  - Ninguno de los dos tiene rate limit.
  - En staging están activos y expuestos a Internet. La memoria del orquestador documenta su uso sobre la cuenta real de Antonio (SA-10).
- **Impacto:** en staging, cualquiera puede tomar cualquier cuenta y leer sus datos (staging tiene datos reales de Antonio y de pruebas). En producción bastaría un `NODE_ENV` mal escrito o ausente para tener toma de control masiva.
- **Vector:** petición no autenticada a `dev/auto-verify` con el email de la víctima.
- **Mitigación:** (1) Pasar a lista blanca: montar las rutas `dev/*` **solo** si `NODE_ENV ∈ {development, test}` **y** `ENABLE_DEV_ENDPOINTS === 'true'`; en cualquier otro caso no registrarlas. (2) En staging, como mínimo, exigir `X-Admin-Token` obligatorio con comparación de tiempo constante, limitar a cuentas de un dominio de pruebas y quitar la contraseña por defecto. (3) Validar al arrancar que en producción `NODE_ENV === 'production'` (SA-16). (4) Rotar la contraseña de las cuentas de staging creadas con la contraseña por defecto.
- **Responsable:** backend (+ devops para las variables)
- **¿Bloquea deploy?:** **Sí** (el bloqueo depende de una variable sin validar)

### SA-05 — OTP de verificación con fuerza bruta posible (el contador de intentos no funciona)
- **Severidad:** 🟠 Alta
- **Categoría:** OWASP A07
- **Archivo:** `auth.controller.js:110-116` (`verifyEmail`), `:196-211` (`resendCode`), `schema.prisma:65`
- **Descripción:** `verifyEmail` busca el código con `where: { user_id, code, … }`. Si el código es incorrecto devuelve `INVALID_CODE` **sin incrementar `attempts`**, y la comprobación `attempts >= 3` solo se alcanza con el código correcto, así que nunca limita. `resendCode` crea códigos nuevos sin invalidar los anteriores, por lo que hay varios OTP válidos a la vez. El único freno es `authRateLimiter` (5/15 min por `req.ip`), roto tras el proxy (SA-06).
- **Impacto:** verificar emails ajenos; combinado con SA-03 (antes de corregirlo), crear o tomar cuentas. Tras corregir SA-03, el token de set-password dependerá de este OTP, así que se vuelve crítico.
- **Vector:** enumerar códigos de 6 dígitos con varias IPs, ampliando la probabilidad con reenvíos.
- **Mitigación:** buscar el último código pendiente por `user_id` y comparar en tiempo constante. Incrementar `attempts` en cada fallo e invalidar al tercero. Invalidar los códigos previos al reenviar. Limitar por email además de por IP. Guardar el OTP con hash (SA-14).
- **Responsable:** backend
- **¿Bloquea deploy?:** **Sí**

### SA-06 — Rate limiting ineficaz detrás del proxy de Railway (trust proxy, orden, keyGenerator, store)
- **Severidad:** 🟠 Alta
- **Categoría:** OWASP A04 Insecure Design / A05; A07 (protección contra fuerza bruta)
- **Archivo:** `backend/src/app.js` (no hay `app.set('trust proxy', …)`; búsqueda sin resultados), `app.js:120-128` (montaje), `middleware/rateLimiter.middleware.js:17-63`
- **Descripción:**
  1. Sin `trust proxy`, `req.ip` es la IP del edge o proxy de Railway, no la del cliente. Todos los clientes comparten un mismo contador o unos pocos. `express-rate-limit` 7.5.1 además registra el error de validación `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
  2. `apiLimiter` se monta a nivel de app **antes** de los routers que llaman a `authenticate`. `req.user` no existe todavía y `keyGenerator` usa siempre `req.ip`, así que el límite "100/15 min por usuario" es en realidad global.
  3. El store está en memoria: se pierde en cada deploy o reinicio y no se comparte entre réplicas (VUL-2026-012).
- **Impacto:** DoS trivial. Unos pocos intentos de login fallidos (5/15 min) o de registro (3/h) bloquean el login o el registro de **todos** los usuarios, y 100 peticiones agotan la API para todos. Si se corrige poniendo `trust proxy = true` sin más, `X-Forwarded-For` se vuelve falsificable y los límites se eluden.
- **Vector:** ráfaga de peticiones fallidas desde una sola IP.
- **Mitigación:** `app.set('trust proxy', 1)` (número exacto de saltos de Railway, a verificar). Nunca `true`. Ojo con la CVE de `proxy-addr` (SA-24) si se usan subredes. Mover el limitador por usuario dentro de los routers, después de `authenticate`, y mantener uno por IP antes de auth. Usar `rate-limit-redis` con el Redis existente. Añadir límites por email en login, forgot y resend.
- **Responsable:** backend (+ devops para confirmar los saltos del proxy)
- **¿Bloquea deploy?:** **Sí**

### SA-07 — El consentimiento explícito Art. 9 no se valida en el servidor y es falsificable
- **Severidad:** 🟠 Alta
- **Categoría:** RGPD Art. 9.2.a, Art. 7.1 (carga de la prueba), Art. 4.11; OWASP A04
- **Archivo:** `onboarding.controller.js:115` (`healthConsent` sin usar), `:128-135` (registro automático); `auth.controller.js:48,68-70` (fecha de consentimiento recibida del cliente); `routes/onboarding.routes.js:66-78` (sin regla para `healthConsent`)
- **Descripción:** se marca `health_consent_given_at = now()` en cualquier llamada a `PUT /onboarding/health`, aunque el body no traiga `healthConsent` o sea `false`. En `register`, el cliente puede enviar `health_consent_given_at` con cualquier fecha y se persiste. VUL-2026-003 y M-04 figuran como resueltos, pero solo existe el checkbox en el frontend. Los datos de salud se tratan y se envían a Anthropic (EE. UU.) sin un acto positivo verificable.
- **Impacto:** tratamiento de datos de categoría especial sin base jurídica demostrable; el registro de consentimiento no sirve como prueba ante la AEPD.
- **Mitigación:** validar `body('healthConsent').equals(true)` (booleano estricto) y rechazar con 400. No guardar condiciones ni restricciones sin consentimiento. Ignorar `health_consent_given_at` del cliente en `register`. Fijar la marca de tiempo en el servidor junto con la versión de la política (SA-17). Exigir el consentimiento también antes de `onboarding/complete` y `plans/regenerate`.
- **Responsable:** backend
- **¿Bloquea deploy?:** **Sí**

### SA-08 — La build de producción apunta a un dominio sin titularidad verificada
- **Severidad:** 🟠 Alta
- **Categoría:** OWASP A05 / A08; RGPD Art. 32 y 44 (destinatario no controlado)
- **Archivo:** `projects/healthy/frontend/eas.json` (perfil `production`, `EXPO_PUBLIC_API_URL = https://api.healthy.app`)
- **Descripción:** el backend real de producción es `ai-studio-production-1835.up.railway.app`. `VULNERABILITIES.md` habla de `api.healthy-app.es`. En ningún documento consta que `healthy.app` sea propiedad del proyecto ni que exista un DNS apuntando a Railway.
- **Impacto:** si el dominio pertenece a un tercero o caduca, una build de tienda le enviaría credenciales, tokens y todos los datos de salud.
- **Mitigación:** Antonio verifica la titularidad del dominio y su DNS. Si no es propio, cambiarlo por el dominio definitivo controlado. Valorar *certificate pinning* (SA-30). Añadir en CI una comprobación que impida builds de producción con hosts fuera de una lista blanca.
- **Responsable:** Antonio-manual (dominio) + frontend
- **¿Bloquea deploy?:** **Sí** (bloquea la publicación de la app)

### SA-09 — `.claude/settings.local.json` versionado con tokens JWT de staging, datos personales y URLs de BD
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A05; RGPD Art. 5.1.f
- **Archivo:** `.claude/settings.local.json:78-84` (bearer tokens de staging y datos de perfil de prueba en los bodies), `:108-111` (DATABASE_URL, ver SA-02). Rastreado desde `e60b8b6`.
- **Descripción:** el archivo de permisos local de Claude Code se commitea con comandos completos que llevan tokens y datos. Los access tokens probablemente han caducado (15 min), pero el patrón sigue filtrando secretos en cada commit.
- **Mitigación:** `git rm --cached .claude/settings.local.json`, añadirlo a `.gitignore` y reescribir esas entradas con comodines.
- **Responsable:** devops (cuando lo autorice Antonio; el archivo tiene cambios sin commitear de otra sesión)
- **¿Bloquea deploy?:** No

### SA-10 — Credenciales del usuario de staging en texto plano en la memoria del orquestador
- **Severidad:** 🟡 Media
- **Categoría:** Higiene de secretos; OWASP A07
- **Archivo:** `C:\Users\Antonio\.claude\projects\C--Users-Antonio-Documents-ai-studio\memory\current_status.md:43` (usuario y contraseña), `:47-53` (procedimiento `dev/auto-verify` y `dev/code` con el email real). Fuera del repo.
- **Descripción:** la memoria guarda el email real de Antonio y una contraseña en claro, y la carga en el contexto de cada agente. Si la contraseña se reutiliza en otros servicios, el riesgo pasa del proyecto.
- **Mitigación:** cambiar esa contraseña en staging (y en cualquier otro sitio donde se reutilice). Quitarla de la memoria y sustituirla por "credenciales en el gestor de contraseñas". Usar una cuenta de pruebas con un email desechable.
- **Responsable:** orquestador (editar la memoria) + Antonio-manual (cambiar la contraseña)
- **¿Bloquea deploy?:** No

### SA-11 — Detección de secretos insuficiente y documentos internos aún versionados
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A08 Software & Data Integrity / A05
- **Archivo:** `.husky/pre-commit` (excluye `*.md`, `*test*` y `*example*`; solo detecta `sk-ant-`); `.gitignore` (raíz: patrones `PR-*.md`, `*_STATUS.md`, `CLAUDE.*.md`, `auditoria_*.md`)
- **Descripción:** el hook no habría detectado ni SA-01 ni SA-02. Los patrones de `.gitignore` no sacan del control de versiones lo que ya estaba (`git ls-files` sigue mostrando `PR-*-READY.md`, `ORCHESTRATOR_STATUS.log`, `auditoria_atlas_mitre.md`, `devops/SECRETS_STATUS.md`, `CLAUDE.jailbreak.md`). No hay escaneo de secretos en CI.
- **Mitigación:** añadir `gitleaks` o `trufflehog` en pre-commit y en CI (sin excluir `.md`), con reglas para URIs `postgres://`, `redis://`, JWT y base64 largos. Activar GitHub secret scanning y push protection. `git rm --cached` de los documentos internos si se quieren excluir.
- **Responsable:** devops
- **¿Bloquea deploy?:** No

### SA-12 — Rutas de `/auth` sin limitador: reset-password, refresh y dev (VUL-2026-011 declarada resuelta)
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A07 / A04
- **Archivo:** `routes/auth.routes.js:38-40` (reset-password), `:47-49` (refresh), `:52-53` (dev), `:24-26` (set-password, ver SA-03); `app.js:120-130` (`apiLimiter` no se monta en `/auth`)
- **Impacto:** fuerza bruta y consumo de CPU con bcrypt de 12 rondas (DoS) en reset-password; prueba masiva de refresh tokens.
- **Mitigación:** `authRateLimiter` (con la corrección de SA-06) en todas las rutas de `/auth`, más un limitador por email.
- **Responsable:** backend
- **¿Bloquea deploy?:** Sí (se corrige junto con SA-03 y SA-06)

### SA-13 — Validación de JWT: sin revocación por sesión y sin algoritmo fijado
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A07 / A02
- **Archivo:** `middleware/auth.middleware.js:15-20`; `auth.controller.js:17-23`, `:260-275` (logout), `:247-251` (reset); `user.controller.js:77-88`
- **Descripción:** `authenticate` solo verifica la firma. No comprueba que `sessionId` siga existiendo en `AuthSession` o en Redis (la clave `session:*` se escribe en `auth.controller.js:176`, pero nunca se lee), ni que el usuario exista o siga `active`. Tras logout, reset de contraseña, cuenta suspendida o borrada, el access token sigue valiendo hasta que expira (`JWT_EXPIRES_IN`, sin validar: SA-16). No se fija `algorithms: ['HS256']` (VUL-2026-014).
- **Mitigación:** comprobar la sesión en Redis (con fallback a BD) en `authenticate`. Fijar `algorithm`/`algorithms`, `issuer` y `audience`. Rechazar si `status !== 'active'`.
- **Responsable:** backend
- **¿Bloquea deploy?:** No (recomendado antes)

### SA-14 — Refresh tokens, OTP y tokens de reset guardados en claro; sin detección de reutilización
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A02 / A07
- **Archivo:** `schema.prisma:104` (`refresh_token`), `:88` (`PasswordResetToken.token`, uuid), `:65` (`code`); `auth.controller.js:25-28` (formato, VUL-2026-016), `:223` (reset de 24 h, VUL-2026-018), `:278-304` (refresh sin detección de reutilización)
- **Impacto:** con un volcado o una lectura de la BD (ver SA-02) se secuestran sesiones durante 30 días y se resetean contraseñas sin acceso al correo.
- **Mitigación:** generar con `crypto.randomBytes(32)` y guardar solo el SHA-256. Rotar con familias de tokens: si se presenta un token ya rotado, revocar toda la familia. Reset válido 1 h e invalidar los anteriores al pedir uno nuevo.
- **Responsable:** backend (+ database para la migración)
- **¿Bloquea deploy?:** No

### SA-15 — `/health/ai`: token de admin opcional, sin rate limit y con coste real de API
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A05 / A04 (consumo de recursos sin control); se solapa con LLM10 (JailBreak)
- **Archivo:** `app.js:62-83` (`NODE_ENV` en `:63`, token opcional en `:65-66`, `err.message` y `err.status` devueltos en `:81`)
- **Descripción:** fuera de producción, si `ADMIN_TOKEN` no está definida, cualquiera puede invocarlo. Cada petición hace una llamada real a la API de Anthropic. No pasa por ningún limitador (está antes de `app.use(apiLimiter)`). Devuelve el mensaje de error del SDK al cliente. La comparación del token no es de tiempo constante.
- **Impacto:** gasto y agotamiento de la cuota de la API key compartida; revela el estado de la clave y detalles del proveedor.
- **Mitigación:** eliminar el endpoint o hacer `ADMIN_TOKEN` obligatorio (si no está definida, 404). Usar `crypto.timingSafeEqual`, rate limit estricto y respuesta sin `err.message`.
- **Responsable:** backend
- **¿Bloquea deploy?:** No (en producción devuelve 404 si `NODE_ENV` es correcto; ver SA-16)

### SA-16 — Configuración fail-open: sin validación de entorno al arrancar
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A05
- **Archivo:** `server.js:1-8`; `utils/crypto.util.js:43-44,56`; `services/aiService.js:426-429,461-462`; `app.js:63-66`; `services/email.service.js:9-12`; `controllers/auth.controller.js:21`
- **Descripción:** ninguna variable crítica se valida. Sin `REDIS_ENCRYPTION_KEY` o `REDIS_HMAC_SECRET` los planes se cachean en claro y sin integridad (SEC-10 y SEC-16 fail-open). Sin `ADMIN_TOKEN`, `/health/ai` queda abierto. Sin `SMTP_USER`, OTP y enlaces de reset se escriben en los logs (SA-22). `NODE_ENV` incorrecto activa los endpoints dev (SA-04). `JWT_EXPIRES_IN` no tiene tope. No se comprueba longitud ni entropía de `JWT_SECRET` (ENV-02). Además, el Dockerfile arranca aunque fallen las migraciones (SA-32).
- **Mitigación:** módulo `config` con `zod` (ya está en dependencias) que, si `NODE_ENV === 'production'`, aborte el arranque cuando falte o sea débil cualquiera de: `JWT_SECRET` (≥ 64 bytes), `REDIS_ENCRYPTION_KEY` (64 hex), `REDIS_HMAC_SECRET`, `FRONTEND_URL`, SMTP, `JWT_EXPIRES_IN ≤ 15m`. Rechazar valores de `NODE_ENV` fuera de una lista blanca.
- **Responsable:** backend (+ devops para las variables de Railway)
- **¿Bloquea deploy?:** Sí

### SA-17 — Consentimiento sin versionado real ni mecanismo de retirada
- **Severidad:** 🟡 Media
- **Categoría:** RGPD Art. 7.3 (retirar el consentimiento tan fácil como darlo), Art. 7.1
- **Archivo:** `onboarding.controller.js:129-133` ("inmutable", versión `'1.0'` fija); `auth.controller.js:69`; `schema.prisma:49-50`; no existe endpoint de retirada en `routes/user.routes.js`
- **Mitigación:** endpoint `POST /user/me/consent/withdraw` que deje de tratar los datos Art. 9 (borrado o bloqueo de condiciones y restricciones, sin envío a la IA). Versión de la política desde la configuración, con re-consentimiento al cambiarla. Tabla de historial de consentimientos (otorgado y retirado, versión, marca de tiempo del servidor).
- **Responsable:** backend (+ frontend, + docs para la política)
- **¿Bloquea deploy?:** No (necesario para cumplir el RGPD antes del lanzamiento comercial)

### SA-18 — La verificación de edad mínima se puede eludir
- **Severidad:** 🟡 Media
- **Categoría:** RGPD Art. 8 / LOPDGDD Art. 7; OWASP A04
- **Archivo:** `onboarding.controller.js:178-188` (`complete` crea el perfil a partir de `profile.age` sin comprobar la edad); `auth.controller.js:51-60` (la fecha de nacimiento es opcional y una fecha no válida da `NaN` y pasa)
- **Vector:** llamar directamente a `POST /onboarding/complete` con `profile.age` menor de 16, sin pasar por `PUT /onboarding/profile`.
- **Mitigación:** centralizar la validación de edad en un helper usado por `saveProfile`, `complete` y `register`. Rechazar edades por debajo de 16 y fechas no válidas o futuras. Que `complete` no cree perfiles desde el body (o que los valide igual que `PUT /profile`).
- **Responsable:** backend
- **¿Bloquea deploy?:** No (recomendado)

### SA-19 — Supresión de cuenta (Art. 17) incompleta y sin reautenticación
- **Severidad:** 🟡 Media
- **Categoría:** RGPD Art. 17; OWASP A04 / A01
- **Archivo:** `controllers/user.controller.js:17-95`; `routes/user.routes.js:11`
- **Descripción:**
  - Son unas 18 operaciones `deleteMany` secuenciales **sin `$transaction`**: un fallo intermedio deja una cuenta a medio borrar. Además son innecesarias, porque `onDelete: Cascade` ya existe en el esquema.
  - No pide contraseña ni confirmación: un access token robado basta para un borrado irreversible.
  - En Redis solo borra `session:{sessionId}` y `user:{userId}`. Quedan `plan:{userId}:{fecha}` (plan derivado de datos de salud, 24 h) y las `session:*` de otros dispositivos.
  - El access token sigue siendo válido (SA-13).
- **Mitigación:** `prisma.user.delete` dentro de una transacción (confiando en las cascadas). Exigir la contraseña actual en el body. Borrar por patrón `plan:{userId}:*` y todas las sesiones del usuario. Revocar los tokens. Documentar la política sobre backups.
- **Responsable:** backend
- **¿Bloquea deploy?:** No (recomendado)

### SA-20 — Exportación de datos (Art. 15/20) incompleta
- **Severidad:** 🟡 Media
- **Categoría:** RGPD Art. 15 y 20
- **Archivo:** `user.controller.js:120-188`
- **Descripción:** faltan `phone_number`, `email_verified`, el consentimiento (`health_consent_given_at` y versión), `HealthCondition.affects_*`, `Meal`/`MealFood`, `TrainingSession`/`SessionExercise`, `OnboardingAnswer`, el contenido de los planes, `AuthSession` (IP y dispositivo), `TokenUsageLog` y `DailyLog.sleep_quality`. Tampoco informa de los destinatarios (Anthropic).
- **Mitigación:** export exhaustivo generado a partir del modelo, con test que falle si se añade un modelo con `user_id` que no se exporte.
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-21 — Sin política de retención aplicada (sesiones, OTP, tokens, IPs)
- **Severidad:** 🟡 Media
- **Categoría:** RGPD Art. 5.1.e (limitación del plazo de conservación)
- **Archivo:** no hay ningún job de limpieza en `backend/src` (sin `cron`, `setInterval` ni borrado de expirados); `schema.prisma:61-114` (`VerificationCode`, `PasswordResetToken` y `AuthSession` con `ip_address`); `security/DATA_REGISTER.md:245` afirma "TTL automático + política de retención — Implementado"
- **Mitigación:** job diario que borre códigos y tokens expirados o usados y sesiones caducadas. Retención definida para logs de Railway. Corregir el RAT (SA-34).
- **Responsable:** backend (+ devops para el cron)
- **¿Bloquea deploy?:** No

### SA-22 — Datos personales y secretos de un solo uso en los logs
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A09 Logging Failures; RGPD Art. 5.1.c y 32
- **Archivo:**
  - `auth.controller.js:158` (email en login fallido)
  - `services/email.service.js:33` (**OTP en el log**), `:72` (**enlace de reset con token en el log**) cuando falta `SMTP_USER`; `:54,57,94,97` (email del destinatario)
  - `middleware/errorHandler.middleware.js:10` (`err.message` de Prisma, que en errores de validación incluye los argumentos de la consulta, es decir, datos del body como condiciones de salud o notas)
  - `app.js:53` (morgan registra la URL con `?email=` en `/auth/dev/code`)
  - `routes/exercises.routes.js:91,136` (`console.error` del objeto de error completo)
- **Descripción:** según la memoria del orquestador (`current_status.md:42`), SMTP no está configurado en staging, así que los OTP y tokens de reset ya están en los logs de Railway. Quien tenga acceso a esos logs puede tomar cuentas.
- **Mitigación:** registrar `userId` o un hash del email, nunca el email. No registrar nunca OTP ni enlaces de reset: en entornos sin SMTP, fallar de forma visible. Sanear `err.message` de Prisma (registrar solo `err.code` y `meta.target`). Formato de morgan sin query string.
- **Responsable:** backend
- **¿Bloquea deploy?:** No (sí exigir SMTP en producción: SA-16)

### SA-23 — Validación de entrada incompleta en endpoints de escritura y query params (incluye N-1)
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A03 / A04
- **Archivo:**
  - `routes/nutrition.routes.js:19` + `controllers/nutrition.controller.js:62,74`: `POST /nutrition/meals/:mealId/foods` sin reglas. `quantity_g` admite negativos, `NaN` (que acaba en 500) y valores enormes que desbordan el `Decimal` (500 o macros negativas); `food_id` no se valida como UUID.
  - `controllers/training.controller.js:106,114`: `completeSession` sin validar `duration_minutes`, `calories_burned` ni `notes`.
  - `controllers/progress.controller.js:30` (`notes` sin límite), `:14-15` (`limit`/`offset` con `NaN` o negativos → 500).
  - `controllers/foods.controller.js:41-42` (`q` como array → TypeError).
  - `training.controller.js:59-62` y `exercises.routes.js:33-40`: con el parser `extended` de Express 4, los query params pueden ser objetos y llegan como operadores a Prisma. El impacto está acotado por el filtro `user_id` o al catálogo público.
- **Nota sobre IDOR:** **no** se han encontrado IDOR. `addFoodToMeal` comprueba `meal.user_id` (`nutrition.controller.js:66`). `plans/:id`, `plans/:id/pause`, `training/sessions/:id`, `…/exercises/:exerciseId` y `meals/:id/complete` filtran por `user_id`. `foods` y `exercises` son catálogos globales.
- **Mitigación:** reglas `express-validator` en todas las rutas de escritura (`isUUID`, `isFloat({min:1,max:5000})`, `isLength({max:…})`, `isString()`) y tipado estricto de los query params (o `app.set('query parser','simple')`).
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-24 — Dependencias del backend con vulnerabilidades alcanzables
- **Severidad:** 🟡 Media
- **Categoría:** OWASP A06 Vulnerable Components
- **Archivo:** `backend/package.json`, `backend/package-lock.json`. Detalle en la sección 4.
- **Descripción:** son alcanzables `nodemailer` 6.10.1 (directa, alta; una de sus advisories es entrega a un dominio no previsto), `morgan` 1.10.1 (directa, falsificación de logs) y `qs` 6.14.2 (vía Express, DoS). El job `security-audit.yml` falla con el umbral `high`.
- **Mitigación:** ver la sección 4.
- **Responsable:** backend / devops
- **¿Bloquea deploy?:** No (prioridad alta tras las críticas)

### SA-25 — Enumeración de usuarios
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A07
- **Archivo:** `auth.controller.js:64` (409 si el email ya existe), `:108` (404 en verify), `:135` (404 en set-password), `:153-154` (403 `ACCOUNT_INACTIVE` frente a 401), `:336` (dev/code)
- **Mitigación:** respuestas uniformes ("si la cuenta existe…") en register, verify y set-password; 401 genérico en login.
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-26 — Asignación masiva con spread en `createMany`
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A04 / A01 (Mass Assignment)
- **Archivo:** `onboarding.controller.js:119` (`{...c, user_id}`), `:123` (`{...r, user_id}`), `:215` (`{...a, user_id}`)
- **Descripción:** el cliente puede fijar `id`, `created_at` u otros campos. Fijar el `id` de un registro ajeno no lo sobrescribe (provoca P2002), pero sirve de oráculo de existencia y antes se ejecuta un `deleteMany` sobre los datos propios.
- **Mitigación:** construir los objetos con una lista blanca de campos.
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-27 — `/exercises` crea un pool de PostgreSQL por petición
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A04 (consumo de recursos)
- **Archivo:** `routes/exercises.routes.js:46-48`, `:110-112`
- **Descripción:** cada petición crea `new Pool` + `new PrismaClient`. Peticiones concurrentes agotan las conexiones de PostgreSQL (DoS), sobre todo con el limitador global roto (SA-06).
- **Mitigación:** usar el singleton `src/prisma/client.js` (y mockearlo en tests).
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-28 — Campos de texto libre con datos de salud sin límite de longitud (minimización)
- **Severidad:** 🟢 Baja
- **Categoría:** RGPD Art. 5.1.c y Art. 9; OWASP A04
- **Archivo:** `routes/onboarding.routes.js` (sin `isLength` en `profession`, `injuries_or_limitations`, `previous_attempts_notes`, `conditions.*.notes`); `schema.prisma:221,251,334,393,595`; `plans.controller.js:60` (`reason`)
- **Mitigación:** `isLength({max: 300/1000})` en todos los campos libres. Avisar en la UI de que no se introduzcan datos de terceros. Clasificar `injuries_or_limitations` como Art. 9 en el RAT (VUL-2026-022).
- **Responsable:** backend (+ docs)
- **¿Bloquea deploy?:** No

### SA-29 — `photo_url` admite cualquier URL externa (la aceptación de VUL-2026-007 ya no vale)
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A04 / A10 (cliente); RGPD Art. 32
- **Archivo:** `routes/progress.routes.js:21` (`isURL()` sin restricciones), `progress.controller.js:49`
- **Descripción:** sin almacenamiento propio (Supabase eliminado), el campo guarda URLs arbitrarias (http incluido, cualquier host) que el cliente cargaría, lo que permite seguimiento por píxel, contenido no deseado o mezcla de HTTP y HTTPS.
- **Mitigación:** desactivar el campo hasta tener almacenamiento privado con URLs firmadas, o restringirlo a `https` y a una lista blanca de hosts.
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-30 — Frontend: fallback HTTP y sin certificate pinning
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP M5/M3 móvil; A02
- **Archivo:** `frontend/src/services/api.ts:9` (fallback `http://localhost:3000`); `eas.json` (perfil development)
- **Descripción:** si una build se genera sin `EXPO_PUBLIC_API_URL`, la app usa HTTP en claro. No hay pinning. **Verificado:** los tokens se guardan en `expo-secure-store` (`stores/authStore.ts:52-110`, `services/api.ts:36-108`); no se usa AsyncStorage.
- **Mitigación:** en builds no-dev, fallar si la URL no es `https`. Valorar pinning (p. ej. `react-native-ssl-public-key-pinning`) cuando el dominio sea definitivo.
- **Responsable:** frontend
- **¿Bloquea deploy?:** No

### SA-31 — Dependencias del frontend (sobre todo de build)
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A06
- **Archivo:** `frontend/package.json`. Detalle en la sección 4.
- **Responsable:** frontend
- **¿Bloquea deploy?:** No

### SA-32 — El contenedor arranca aunque falle `prisma migrate deploy`
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A05 / A08
- **Archivo:** `backend/Dockerfile` (última línea `CMD`: `… || echo '[WARN] …' && node server.js`)
- **Descripción:** si una migración falla, se sirve tráfico con un esquema desfasado (errores 500 o datos inconsistentes) y el healthcheck puede dar 200.
- **Mitigación:** abortar el arranque si la migración falla, o hacer la migración en un paso separado del deploy.
- **Responsable:** devops
- **¿Bloquea deploy?:** No

### SA-33 — Código muerto con implementaciones divergentes y `require` roto
- **Severidad:** 🟢 Baja
- **Categoría:** OWASP A04 (mantenibilidad de controles)
- **Archivo:** `services/authService.js:10` y `services/cacheService.js:10` (`require('../utils/logger')`, que no existe; solo hay `logger.util.js`)
- **Descripción:** son implementaciones paralelas de JWT, OTP y caché que nadie importa. Si alguien las reutiliza, la app falla o los controles se desdoblan.
- **Mitigación:** eliminarlas.
- **Responsable:** backend
- **¿Bloquea deploy?:** No

### SA-34 — El Registro de Actividades de Tratamiento (RAT) no refleja el sistema real
- **Severidad:** 🟢 Baja
- **Categoría:** RGPD Art. 30 y 13
- **Archivo:** `security/DATA_REGISTER.md:40-41,263` (Supabase como encargado, ya eliminado), `:266` (Redis Cloud UE; en realidad Redis está en Railway), `:245` (TTL "implementado"), `:264` (DPA de Railway pendiente y ubicación sin confirmar), `:133` (fotos)
- **Mitigación:** actualizar los encargados (Railway con DPA y región, Anthropic, Gmail/SMTP, Expo), eliminar Supabase y Stripe si no se usan, y documentar la retención real. Revisar la `PRIVACY_POLICY.md` en consecuencia.
- **Responsable:** docs (+ security)
- **¿Bloquea deploy?:** No

---

## 4. Dependencias

Ejecutado `npm audit --omit=dev` en solo lectura (sin `fix` ni `install`) el 2026-10-19.

### 4.1 Backend — 15 vulnerabilidades (1 crítica, 7 altas, 6 moderadas, 1 baja)

| Paquete (versión instalada) | Sev. | Vía | ¿Alcanzable en runtime? | Recomendación |
|---|---|---|---|---|
| `proxy-addr` 2.0.7 | Crítica | express | **No hoy**: solo afecta a `trust proxy` con subredes y no hay `trust proxy`. **Pasa a relevante al corregir SA-06** | Actualizar Express (`npm update express`) antes o junto con SA-06; usar `trust proxy` numérico |
| `nodemailer` 6.10.1 | Alta | directa | **Sí**: se envían correos a direcciones introducidas por el usuario. Varias advisories (entrega a dominio no previsto, inyección SMTP vía opciones) | Subir a la versión mayor corregida (10.1.7+); probar el envío |
| `morgan` 1.10.1 | Moderada | directa | **Sí**: falsificación de logs con user-agent o URL en formato `combined` | Merge de la PR dependabot `morgan-1.12.1` |
| `qs` 6.14.2 | Moderada | express | **Parcial**: DoS al parsear query strings (bypass del límite de arrays) | Actualizar Express/qs |
| `body-parser` 1.20.4 | Baja | express | **No**: el `limit` es válido | Arrastrado por Express |
| `prisma` 7.8.0 → `@prisma/config` (`deepmerge-ts`), `@prisma/dev` (`hono`, `@hono/node-server`, `valibot`), `mysql2`, `fast-uri` | Alta/Mod. | prisma CLI (en `dependencies` para `migrate deploy`) | **No**: herramientas CLI y `prisma dev` local, sin superficie de red en el servidor. `mysql2` no se usa (PostgreSQL) | Actualizar a una versión **> 7.10.0**: la PR dependabot `prisma-7.10.0` sigue dentro del rango vulnerable que reporta npm audit. Valorar mover el CLI fuera de la imagen de runtime |
| `uuid` 10.x | Moderada | directa | **No**: solo se usa v4 sin `buf` | Sustituir por `crypto.randomUUID` (ver SA-14) y eliminar la dependencia |

`@anthropic-ai/sdk` 0.52.0: **npm audit no reporta advisories**. El salto a 0.133 es una actualización mayor de API, no de seguridad.

### 4.2 Frontend — 48 vulnerabilidades (1 crítica, 33 altas, 14 moderadas)

- Casi todas están en la cadena de **build y desarrollo** de Expo/Metro/Jest/Tailwind (`metro`, `@expo/cli`, `node-forge`, `micromatch`, `braces`, `postcss`, `js-yaml`, `shell-quote` [crítica, `quote()`], `image-size`, `nanoid`…). **No se incluyen en el bundle** de la app: el riesgo es la integridad de la máquina o CI de build (A08), no los usuarios.
- **`axios`** (directa, alta, < 1.20.0): gadgets de prototype pollution y ReDoS en `fromDataURI`. Solo son explotables con una primitiva de prototype pollution previa o con data-URIs, que la app no usa. Alcanzabilidad baja. **Actualizar a ≥ 1.20.0** (cambio menor).
- `@react-navigation/core` → `query-string` → `decode-uri-component` (DoS con URIs mal formadas, deep links): baja. Actualizar en minor.

### 4.3 PRs de dependabot (#8–#17)

`gh` no está instalado en esta máquina, así que no he podido leer los números de PR ni el estado del CI. Las ramas remotas (`git branch -r`) confirman 10 PRs:

| Rama dependabot | Valoración |
|---|---|
| backend `morgan-1.12.1` | **Merge recomendado** (corrige SA-24 parcialmente) |
| backend `helmet-8.3.0` | Minor, merge cuando el CI esté verde |
| backend `prisma-7.10.0` | **Insuficiente**: npm audit marca vulnerable hasta 7.10.0. Rehacer con la última 7.x y regenerar el cliente |
| backend `anthropic-ai/sdk-0.133.0` | Sin urgencia de seguridad. Mayor: requiere pruebas de `aiService` y `/health/ai`. Coordinar con el JailBreak (pin de versión SEC-13) |
| backend `dotenv-18.0.7` | Mayor, sin advisories; baja prioridad |
| frontend `expo-secure-store-58.0.2` | **No mergear por separado**: está ligado a la versión del SDK de Expo (SDK 54 usa `~15.0.x`). Actualizar solo con `npx expo install` dentro de una subida de SDK. Afecta al almacenamiento de tokens |
| frontend `react-dom-19.3.0` | Debe coincidir con `react` (19.1.0); mergear juntos o no mergear |
| frontend `tailwindcss-4.3.3` | Mayor, incompatible con NativeWind 4 en principio; corrige avisos de build (no runtime). Planificar |
| frontend `nativewind-4.2.7`, `react-native-web-0.21.4` | Minor/patch; merge tras CI verde |

**Causa probable del CI en rojo** (sin verificar): `security-audit.yml` falla siempre con `--audit-level=high` mientras sigan las altas existentes (nodemailer, prisma), y hay tests rotos previos (A-24). En ese caso el rojo no depende de cada PR. Propuesta: arreglar primero la base (nodemailer y prisma) y después rebasar las PRs.

---

## 5. RGPD / LOPDGDD

| Requisito | Artículo | Estado | Evidencia / hallazgo |
|---|---|---|---|
| Base jurídica para datos de salud (consentimiento explícito) | 9.2.a, 7.1 | ❌ | El servidor no lo verifica y el cliente puede falsificar la fecha → SA-07 |
| Retirada del consentimiento | 7.3 | ❌ | No existe → SA-17 |
| Menores (≥ 16 en España para servicios de la sociedad de la información) | 8 RGPD / 7 LOPDGDD | ⚠️ | Se elude → SA-18 |
| Minimización | 5.1.c | ⚠️ | Texto libre sin límites; email en logs → SA-28, SA-22. **Positivo:** el prompt a Anthropic no incluye nombre ni email (`aiService.js`, solo métricas y condiciones) |
| Limitación del plazo de conservación | 5.1.e | ❌ | Sin purgas → SA-21 |
| Acceso y portabilidad | 15, 20 | ⚠️ | Export incompleto → SA-20 |
| Supresión | 17 | ⚠️ | Existe, no es atómico y deja datos en caché → SA-19 |
| Rectificación | 16 | ✅ | Endpoints `PUT /onboarding/*` |
| Seguridad del tratamiento | 32 | ❌ | SA-01, SA-02, SA-03, SA-04 (control de acceso roto y credenciales expuestas); sin cifrado de columna (VUL-2026-006, aceptado) |
| Notificación de brechas | 33, 34 | ⚠️ | **Evaluar si SA-02 y SA-01 constituyen una brecha**: credenciales de BD con datos reales expuestas en git. Si hay indicios de acceso ajeno, activar `INCIDENT_RESPONSE.md` (AEPD en 72 h). Con usuarios solo de prueba, documentar la evaluación |
| Registro de actividades | 30 | ⚠️ | Desactualizado → SA-34 |
| Transferencias internacionales (Anthropic EE. UU.) | 44-46 | ⚠️ | El RAT declara SCC y DPA firmados: **verificar documentalmente**. El envío de datos de salud depende de un consentimiento que hoy no está garantizado (SA-07) |
| Encargados (Railway) | 28 | ⚠️ | DPA de Railway "pendiente" (`DATA_REGISTER.md:264`) |
| EIPD / DPIA | 35 | ❓ | No consta evaluación de impacto; es obligatoria para tratamiento a gran escala de datos de salud y perfilado con IA. Recomendada antes del lanzamiento (docs) |

---

## 6. Pruebas propuestas (dinámicas, pendientes de autorización de Antonio)

Todas contra **staging** o un entorno local, con cuentas de prueba propias. No se han ejecutado.

1. **SA-03:** crear dos cuentas de prueba A y B. Desde un cliente sin autenticar, llamar a `set-password` con el email de B y comprobar si después se puede iniciar sesión como B con la nueva contraseña. Esperado tras el fix: 400/401.
2. **SA-04:** confirmar el valor real de `NODE_ENV` en staging y producción (panel de Railway). Comprobar que `GET /auth/dev/code` y `POST /auth/dev/auto-verify` devuelven 404 en producción. Probar en local con `NODE_ENV` sin definir o mal escrito para demostrar el fail-open.
3. **SA-06:** desde dos IPs públicas distintas, hacer una petición autenticada a `GET /logs/today` y comparar las cabeceras `RateLimit-Remaining`. Si el contador baja de forma compartida, el bucket es global. Revisar en los logs de Railway el aviso `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
4. **SA-05:** en local, enviar 4 códigos erróneos y comprobar que `attempts` no sube en BD.
5. **SA-01:** sin usar el valor, comparar en Railway (Antonio, a mano) si el `JWT_SECRET` desplegado coincide con el del documento. Revisar en GitHub la visibilidad del repo (privado/público) y la lista de colaboradores.
6. **SA-02:** en Railway, comprobar si la BD de staging tiene *public networking* activo y revisar los logs de conexión de los últimos meses en busca de IPs ajenas.
7. **SA-15:** confirmar si `ADMIN_TOKEN` está definida en staging (Railway). No invocar el endpoint.
8. **SA-13:** login, logout y reutilizar el access token antes de 15 min: esperado 401 tras el fix.
9. **SA-19:** borrar una cuenta de prueba y comprobar con `redis-cli --scan --pattern 'plan:<id>:*'` que no queda nada.
10. **SA-08:** `whois` y DNS de `healthy.app` / `api.healthy.app` (Antonio).
11. **SA-23:** en local, `POST /nutrition/meals/:id/foods` con `quantity_g` negativo o no numérico: esperado 400.

---

## 7. Tabla final de tareas

| ID | Sev. | Título | Agente | Archivo principal | Bloquea deploy |
|---|---|---|---|---|---|
| SA-01 | 🔴 | Rotar JWT_SECRET expuesto en GITHUB_SECRETS.md y limpiar el doc (M-21) | Antonio-manual + devops | `devops/GITHUB_SECRETS.md:43-44,61-62` | Sí |
| SA-02 | 🔴 | Rotar credenciales PostgreSQL versionadas y cerrar el proxy público | Antonio-manual + devops | `check-db.js:2`, `prisma-migrate*.bat`, `GO_LIVE_CHECKLIST.md:418,450`, `.claude/settings.local.json:108-111` | Sí |
| SA-03 | 🔴 | `set-password` sin token: toma de control de cuentas | backend | `controllers/auth.controller.js:130-145` | Sí |
| SA-04 | 🟠 | Endpoints dev fail-open (lista blanca + flag) | backend | `auth.controller.js:328-381`, `auth.routes.js:52-53` | Sí |
| SA-05 | 🟠 | OTP con fuerza bruta (attempts sin incrementar) | backend | `auth.controller.js:110-116,196-211` | Sí |
| SA-06 | 🟠 | Rate limiting: trust proxy, orden, keyGenerator, store Redis | backend | `app.js:120-128`, `rateLimiter.middleware.js` | Sí |
| SA-07 | 🟠 | Validar consentimiento Art. 9 en el servidor | backend | `onboarding.controller.js:115-135`, `auth.controller.js:68-70` | Sí |
| SA-08 | 🟠 | Dominio de producción `api.healthy.app` sin titularidad verificada | Antonio-manual + frontend | `frontend/eas.json` | Sí |
| SA-09 | 🟡 | Sacar `.claude/settings.local.json` de git | devops | `.claude/settings.local.json` | No |
| SA-10 | 🟡 | Credenciales de staging en la memoria del orquestador | orquestador + Antonio-manual | `memory/current_status.md:43-53` | No |
| SA-11 | 🟡 | Escaneo de secretos (gitleaks/CI) y desversionar docs internos | devops | `.husky/pre-commit`, `.gitignore` | No |
| SA-12 | 🟡 | Limitador en reset-password, refresh y dev | backend | `routes/auth.routes.js:38-53` | Sí |
| SA-13 | 🟡 | Revocación por sesión y algoritmo fijado en JWT | backend | `middleware/auth.middleware.js:15-20` | No |
| SA-14 | 🟡 | Hash de refresh/OTP/reset, detección de reutilización, reset 1 h | backend + database | `schema.prisma:65,88,104`, `auth.controller.js:25-28,223,278-304` | No |
| SA-15 | 🟡 | `/health/ai`: token obligatorio, rate limit, sin `err.message` | backend | `app.js:62-83` | No |
| SA-16 | 🟡 | Validación de entorno al arrancar (fail-closed) | backend + devops | `server.js`, `crypto.util.js:43-44`, `aiService.js:426-429` | Sí |
| SA-17 | 🟡 | Versionado y retirada del consentimiento | backend + frontend + docs | `onboarding.controller.js:129-133` | No |
| SA-18 | 🟡 | Elusión de la edad mínima vía `/onboarding/complete` | backend | `onboarding.controller.js:178-188` | No |
| SA-19 | 🟡 | `DELETE /user/me`: transacción, reautenticación, purga de Redis | backend | `user.controller.js:17-95` | No |
| SA-20 | 🟡 | Export Art. 15/20 completo | backend | `user.controller.js:120-188` | No |
| SA-21 | 🟡 | Job de retención de sesiones, OTP, tokens e IPs | backend + devops | `schema.prisma:61-114` | No |
| SA-22 | 🟡 | Quitar PII, OTP y enlaces de reset de los logs | backend | `email.service.js:33,72`, `auth.controller.js:158`, `errorHandler.middleware.js:10` | No |
| SA-23 | 🟡 | Validación de entrada (N-1 quantity_g/food_id, completeSession, query params) | backend | `nutrition.controller.js:62,74`, `training.controller.js:106,114` | No |
| SA-24 | 🟡 | Actualizar nodemailer, morgan, express/qs y prisma > 7.10.0 | backend / devops | `backend/package.json` | No |
| SA-25 | 🟢 | Enumeración de usuarios | backend | `auth.controller.js:64,108,135,154` | No |
| SA-26 | 🟢 | Mass assignment por spread en `createMany` | backend | `onboarding.controller.js:119,123,215` | No |
| SA-27 | 🟢 | `/exercises`: Pool y PrismaClient por petición | backend | `routes/exercises.routes.js:46-48,110-112` | No |
| SA-28 | 🟢 | Límites de longitud en texto libre de salud (minimización) | backend + docs | `routes/onboarding.routes.js` | No |
| SA-29 | 🟢 | `photo_url` con URLs arbitrarias | backend | `routes/progress.routes.js:21` | No |
| SA-30 | 🟢 | Frontend: fallback HTTP y pinning | frontend | `frontend/src/services/api.ts:9` | No |
| SA-31 | 🟢 | Dependencias del frontend (axios ≥ 1.20, cadena de build) | frontend | `frontend/package.json` | No |
| SA-32 | 🟢 | Dockerfile arranca aunque falle la migración | devops | `backend/Dockerfile` (CMD) | No |
| SA-33 | 🟢 | Eliminar `authService.js` y `cacheService.js` muertos | backend | `services/authService.js:10`, `services/cacheService.js:10` | No |
| SA-34 | 🟢 | Actualizar el RAT (Supabase, Redis, retención, DPA de Railway) | docs | `security/DATA_REGISTER.md:40-41,245,263-266` | No |

**Vulnerabilidades previas que siguen abiertas sin tarea SA propia:** VUL-2026-006 (riesgo aceptado), VUL-2026-015 y VUL-2026-017/B-02. El orquestador debería reabrirlas en `VULNERABILITIES.md`, igual que VUL-2026-003 y VUL-2026-011, marcadas como resueltas sin serlo.

---
*Auditoría estática realizada por el agente security del ai-studio. No se han ejecutado pruebas de ataque ni llamadas a la API de Anthropic.*
