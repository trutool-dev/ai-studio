# Auditoría de Seguridad Final — Pre-Go-Live
**Proyecto:** Healthy  
**Fecha:** 2026-06-15  
**Auditor:** Agente Security (ai-studio)  
**Alcance:** Backend (`src/`), Frontend (`src/`), configuración de entorno  
**Marco:** OWASP Top 10 · RGPD Art. 9 · LOPDGDD · HIPAA (datos de salud)

---

## Veredicto

> **✅ APTO PARA GO-LIVE** — No se han encontrado hallazgos críticos que bloqueen el despliegue.  
> Hay **4 hallazgos medios** que deben corregirse antes o inmediatamente después del lanzamiento,  
> y **4 hallazgos bajos** recomendados para el próximo sprint.

---

## Resumen ejecutivo

| Severidad | Total | Estado |
|-----------|-------|--------|
| 🔴 Crítico | 0 | — |
| 🟡 Medio   | 4 | Requieren acción |
| 🟢 Bajo    | 4 | Recomendados |

---

## Hallazgos medios

---

### M-01 — `apiLimiter` definido pero no aplicado globalmente

**Archivo:** `backend/src/middleware/rateLimiter.middleware.js` → `app.js`  
**Descripción:**  
El middleware exporta `apiRateLimiter` (100 req / 15 min por userId) pero no se aplica en `app.js` ni en ninguna ruta autenticada. Las rutas `/training`, `/nutrition`, `/progress`, `/logs`, `/foods`, `/user` no tienen rate limiting. Un atacante autenticado puede hacer scraping masivo o forzar cálculos pesados sin limitación.

**Evidencia:**
```js
// app.js — no hay referencia a apiRateLimiter en ninguna parte
// Rutas training, nutrition, logs, progress, foods, user: sin limiter
```

**Remediación:**
```js
// En app.js, tras los middlewares de seguridad:
const { apiRateLimiter } = require('./middleware/rateLimiter.middleware');
app.use(apiRateLimiter); // aplica a todas las rutas autenticadas
```

---

### M-02 — Inconsistencia JWT entre entornos: acceso token de 7 días en Docker

**Archivos:** `backend/.env` vs `.env` (raíz) + `devops/docker-compose.yml`  
**Descripción:**  
`server.js` carga `dotenv` desde `backend/.env` donde `JWT_EXPIRES_IN=15m`. Sin embargo, `docker-compose.yml` usa `env_file: ../.env` (raíz del proyecto) donde `JWT_EXPIRES_IN=7d`. En despliegue Docker, los access tokens son válidos **7 días en lugar de 15 minutos**, eliminando el mecanismo de rotación rápida.

**Evidencia:**
```yaml
# devops/docker-compose.yml
env_file:
  - ../.env   # root .env sobreescribe backend/.env → JWT_EXPIRES_IN=7d
```
```
# .env (raíz)
JWT_EXPIRES_IN=7d           # ← PROBLEMA en Docker
JWT_SECRET=supersecretkey_development_only
```

**Remediación:**  
Alinear ambos archivos `.env` con `JWT_EXPIRES_IN=15m`. En producción, inyectar el secret vía variables de entorno del orquestador (no via archivo).

---

### M-03 — Directorio raíz del proyecto sin `.gitignore`

**Archivo:** `projects/healthy/` (sin `.gitignore`)  
**Descripción:**  
El directorio raíz del proyecto contiene un `.env` con credenciales de base de datos y JWT secrets de desarrollo, pero no hay `.gitignore` que lo proteja. Solo `backend/.gitignore` ignora su propio `.env`. Un `git add .` desde la raíz del proyecto commiteará el `.env` raíz.

**Remediación:** Crear `projects/healthy/.gitignore`:
```
.env
*.env.local
node_modules/
```

---

### M-04 — Consentimiento RGPD Art. 9 implícito (sin acto positivo verificable)

**Archivo:** `backend/src/controllers/onboarding.controller.js:127`  
**Descripción:**  
El consentimiento para datos de salud (categoría especial, RGPD Art. 9.2.a) se registra automáticamente cuando el usuario envía datos al endpoint `PUT /onboarding/health`, sin que el frontend transmita un campo explícito `health_consent: true`. El banner de privacidad existe en UI pero el backend no verifica que el usuario haya afirmado activamente el consentimiento — solo que ha enviado datos.

Para cumplimiento estricto, el consentimiento debe ser "libre, específico, informado e inequívoco" (Art. 4.11). El envío implícito de datos no es un acto positivo verificable en una auditoría.

**Remediación:**  
1. Frontend: añadir un checkbox explícito en `OnboardingHealth.tsx` y enviar `health_consent: true` en el body.
2. Backend: validar `body('health_consent').equals('true')` y rechazar con 400 si no viene.
3. Persistir `health_consent_version` dinámica (no hardcodeada a `'1.0'`).

---

## Hallazgos bajos

---

### B-01 — Body size limit de 10MB excesivo

**Archivo:** `backend/src/app.js:53`  
```js
app.use(express.json({ limit: '10mb' }));
```
Para una API de salud que no recibe imágenes ni binarios, 10MB facilita ataques de payload inflado. Recomendado: `1mb`.

---

### B-02 — Endpoint `/health` sin autenticación expone info de infraestructura

**Archivo:** `backend/src/app.js`  
El endpoint `GET /health` devuelve versión del software, estado de DB y Redis sin requerir autenticación. En producción, un atacante puede usar esto para reconocimiento. Opciones: proteger con IP allowlist, token secreto en header, o reducir la información devuelta en producción.

---

### B-03 — `health_consent_version` hardcodeada a `'1.0'`

**Archivo:** `backend/src/controllers/onboarding.controller.js:130`  
```js
data: { health_consent_given_at: new Date(), health_consent_version: '1.0' }
```
Cuando la Política de Privacidad cambie no hay mecanismo que invalide consentimientos viejos ni solicite re-consentimiento. Debe cargarse desde variable de entorno o config con un mecanismo de versioning.

---

### B-04 — Morgan en modo `dev` puede loggear datos sensibles en path

**Archivo:** `backend/src/app.js:51`  
Morgan en `dev` loggea método, ruta y tiempo. Si algún cliente pasa tokens o emails en query params (error del cliente), quedarán en logs. Mitigación: confirmar que no hay endpoints que acepten datos sensibles vía query string (verificado: no los hay actualmente), y documentarlo como invariante.

---

## Verificaciones superadas ✅

| Control | Resultado |
|---------|-----------|
| Secrets hardcodeados en código fuente | ✅ Ninguno encontrado |
| Helmet (CSP, HSTS, X-Frame-Options DENY) | ✅ Correctamente configurado |
| CORS sin wildcard `*` | ✅ Solo orígenes explícitos de `FRONTEND_URL` |
| Rate limiting en `/auth/*` (5 req / 15 min / IP) | ✅ `authRateLimiter` activo |
| Rate limiting en `/plans/regenerate` (3 / 24h) | ✅ `planRegenerateLimiter` activo |
| JWT secret en variable de entorno | ✅ `process.env.JWT_SECRET` |
| JWT access token expiración corta | ✅ `15m` en backend `.env` |
| JWT refresh token expiración | ✅ `30d` razonable |
| bcrypt rounds | ✅ 12 rounds (mínimo requerido) |
| `health_consent_given_at` en BD | ✅ Implementado en `saveHealth` |
| Consentimiento inmutable (no sobreescribe) | ✅ `if (!user.health_consent_given_at)` |
| Validación edad mínima 16 años (LOPDGDD Art. 7) | ✅ `saveProfile` línea ~40 |
| Error handler sin stacktrace al cliente | ✅ Solo en logs internos |
| `.env` ignorado en `backend/.gitignore` | ✅ |
| Inyección SQL vía Prisma ORM | ✅ No hay `queryRaw` con interpolación |
| Passwords loggeados | ✅ No encontrado |
| Datos personales en logs | ✅ Logger solo registra `userId`, paths, errores |

---

## Acciones requeridas antes de go-live

| # | Hallazgo | Acción | Responsable |
|---|----------|--------|-------------|
| 1 | M-01 | Aplicar `apiRateLimiter` globalmente en `app.js` | Backend |
| 2 | M-02 | Alinear `JWT_EXPIRES_IN=15m` en root `.env` + verificar docker-compose | DevOps |
| 3 | M-03 | Crear `.gitignore` en `projects/healthy/` | DevOps |
| 4 | M-04 | Añadir checkbox de consentimiento explícito en `OnboardingHealth` | Frontend + Backend |

---

*Auditoría realizada por el agente security del ai-studio — OWASP Top 10 + RGPD + LOPDGDD*
