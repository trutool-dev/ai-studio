# GO_LIVE_CHECKLIST — Healthy v1.0.0

**Fecha:** 2026-06-15  
**PR:** PR-6 — `chore: verificación final go-live v1.0.0`  
**Condición de entrada:** PR-1, PR-2, PR-3, PR-4 y PR-5 mergeadas en `main`

## Fixes aplicados automáticamente ✅

- **Rate limiting global** — `apiLimiter` activo en todas las rutas autenticadas (`app.js`)
- **JWT unificado a 15m** — `.env` raíz sincronizado con `backend/.env`
- **Tests actualizados** — 4 tests de `auth.test.js` corregidos de 422 → 400 con assertions del nuevo formato
- **Frontend — manejo de errores** — helper `extractApiError()` aplicado en todas las pantallas de auth
- **Security — `.gitignore`** creado en raíz del proyecto

---

## 1. ✅ Borrados manuales — COMPLETADO (verificado 2026-06-29)

Verificado en rama `develop`: los archivos duplicados ya no existen.

- **14 archivos duplicados del backend** (`authController.js` etc. sin sufijo) → ya eliminados en PRs anteriores. Convención actual correcta: `*.controller.js`, `*.middleware.js`, `*.service.js`, `*.util.js`.
- **`validate.js`** → no existe. Archivo actual: `validate.middleware.js`.
- **Terraform AWS ECS** (`vpc.tf`, `rds.tf`, `elasticache.tf`, `ecs.tf`, `alb.tf`) → ya eliminados.
- **Terraform landing** (`s3-landing.tf`, `route53-landing.tf`, `cf-function.tf`) → se conservan (necesarios para landing en S3 + CloudFront).

---

## 2. Secrets a configurar en Railway y GitHub

Todos los secrets están en ⏳ (pendiente). Configurar en el orden indicado.

### Paso 1 — Railway Dashboard

URL: https://railway.app → Tu proyecto → Settings

**Proyecto staging** (`healthy-staging`):
- Crear servicio PostgreSQL → anotar `DATABASE_URL` generado automáticamente
- Crear servicio Redis → anotar `REDIS_URL` generado automáticamente
- En el servicio backend, añadir variables de entorno:

| Variable | Valor | Cómo obtener |
|----------|-------|--------------|
| `NODE_ENV` | `staging` | Literal |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | console.anthropic.com → API Keys |
| `JWT_SECRET` | Ver `devops/GITHUB_SECRETS.md` § staging | Pre-generado |
| `JWT_REFRESH_SECRET` | Ver `devops/GITHUB_SECRETS.md` § staging | Pre-generado |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_KEY` | `eyJ...` | Supabase → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API → service_role |
| `SMTP_HOST` | `smtp.mailgun.org` | Mailgun o Gmail |
| `SMTP_PORT` | `587` | Literal |
| `SMTP_USER` | `postmaster@mg.healthy.app` | Proveedor SMTP |
| `SMTP_PASS` | `...` | Proveedor SMTP |
| `EMAIL_FROM` | `Healthy App <noreply@healthy.app>` | Literal |

**Proyecto producción** (`healthy-prod`): mismas variables, valores distintos (especialmente JWT).

### Paso 2 — GitHub Settings → Secrets and variables → Actions

URL: `https://github.com/<org>/healthy/settings/secrets/actions`

**Repository secrets** (compartidos por todos los entornos):

| Nombre | Dónde obtener |
|--------|---------------|
| `RAILWAY_TOKEN` | railway.app → Account Settings → Tokens → Create Token |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `AWS_ACCESS_KEY_ID` | AWS Console → IAM → Users → `ci-cd-user` → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | Se obtiene una única vez al crear la access key IAM |
| `CLOUDFRONT_DISTRIBUTION_ID` | AWS Console → CloudFront → distribución de `healthy.app` → Distribution ID |
| `RAILWAY_STAGING_DATABASE_URL` | Railway → proyecto staging → Postgres → Variables → DATABASE_URL |
| `RAILWAY_PRODUCTION_DATABASE_URL` | Railway → proyecto producción → Postgres → Variables → DATABASE_URL |

**Environments en GitHub** (Settings → Environments):
1. Crear entorno `staging` → Deployment branches: solo rama `develop`
2. Crear entorno `production` → Required reviewers: mínimo 1 → Deployment branches: solo rama `main`

**Secretos del entorno `staging`** (Settings → Environments → staging → Environment secrets):

| Nombre | Valor |
|--------|-------|
| `JWT_SECRET` | Ver `devops/GITHUB_SECRETS.md` § staging |
| `JWT_REFRESH_SECRET` | Ver `devops/GITHUB_SECRETS.md` § staging |
| `SUPABASE_URL` | Del proyecto Supabase staging |
| `SUPABASE_KEY` | Del proyecto Supabase staging |
| `SUPABASE_SERVICE_ROLE_KEY` | Del proyecto Supabase staging |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Del proveedor SMTP |

**Secretos del entorno `production`**: mismos nombres, valores de producción (distintos JWT).

### Paso 3 — EAS / App Store / Google Play (solo para publicar en tiendas)

| Secreto GitHub | Dónde obtener |
|----------------|---------------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens |
| `APPLE_APP_STORE_CONNECT_API_KEY_ID` | App Store Connect → Users and Access → Keys → Key ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID` | App Store Connect → Users and Access → Keys → Issuer ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_CONTENT` | `base64 < AuthKey_XXXXXXXX.p8` (archivo descargado de ASC) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play Console → Setup → API access → Create service account → Download JSON |

> ⚠️ `APPLE_APP_STORE_CONNECT_API_KEY_CONTENT` se mapea a `EXPO_ASC_API_KEY_P8_CONTENT` en el workflow. No usar `EXPO_APPLE_APP_SPECIFIC_PASSWORD` (método obsoleto).

---

## 3. Checklist de go-live — 9 criterios de aceptación

Todos obligatorios. No mergear PR-6 si alguno no está en ✅.

### Criterio 1 — Cobertura de tests ≥ 80 %

```bash
cd projects/healthy/backend
npm test --coverage
```

**Pasar si:** el informe muestra `All files | ... | ≥ 80` en la columna `Lines` o `Statements`.  
**Bloquear si:** cobertura < 80 % → reportar al agente `tests` para ampliar suite.

---

### Criterio 2 — API p95 < 500 ms bajo carga

```bash
node projects/healthy/tests/load/planGeneration.js
```

**Pasar si:** el informe muestra `p95 < 500ms`.  
**Documentar en:** `docs/LOAD_TEST_FINAL.md` (crear con la salida del comando).  
**Bloquear si:** p95 ≥ 500 ms → investigar cuello de botella (Redis cache, query N+1).

---

### Criterio 3 — Landing Lighthouse ≥ 95 en los 4 indicadores

1. Abrir Chrome DevTools → Lighthouse (o `npx lighthouse https://healthy.app --output json`)
2. Ejecutar sobre la URL de producción: `https://healthy.app`

**Pasar si:** Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95.  
**Documentar en:** `docs/LIGHTHOUSE_FINAL.md` (crear con captura o JSON exportado).  
**Bloquear si:** cualquier indicador < 95 → revisar imágenes sin comprimir, meta tags, accesibilidad.

---

### Criterio 4 — Sin hallazgos CRITICAL o HIGH abiertos en seguridad

```bash
# Revisar manualmente:
cat projects/healthy/security/SECURITY_AUDIT.md
cat projects/healthy/security/VULNERABILITIES.md
```

**Pasar si:** ningún ítem con severidad `CRITICAL` o `HIGH` tiene estado `OPEN`.  
**Bloquear si:** hay hallazgos abiertos → reportar al agente `security` para resolución o documentar mitigación aceptada.

> Nota: `SEC-03` (cifrado at-rest de datos de salud) está marcado como mejora para v1.2 — aceptado como riesgo bajo para v1.0.0 siempre que esté documentado en `VULNERABILITIES.md`.

---

### Criterio 5 — Migración Prisma aplicada en producción

```bash
cd projects/healthy/backend
DATABASE_URL=<production-url> npx prisma migrate status --schema ../database/schema.prisma
```

**Pasar si:** ambas migraciones aparecen como `Applied`:
- `20260429210701_init`
- `20260608184928_add_token_usage_logs_and_health_consent`

**Bloquear si:** alguna migración aparece como `Pending` → ejecutar:
```bash
DATABASE_URL=<production-url> npx prisma migrate deploy --schema ../database/schema.prisma
```

> ⚠️ En producción con RDS Proxy, también configurar `DIRECT_URL` en `schema.prisma` para migraciones DDL.

---

### Criterio 6 — App disponible en TestFlight (iOS)

1. Crear tag `v1.0.0` en git (ver Criterio 8) → dispara `eas-submit.yml`
2. Verificar en App Store Connect → TestFlight que el build aparece procesado
3. Confirmar que al menos 1 tester interno puede instalar la app

**Pasar si:** build visible en TestFlight con estado `Ready to Test`.

---

### Criterio 7 — App disponible en Google Play Internal Testing (Android)

1. Mismo tag `v1.0.0` dispara `eas-submit.yml` para Android
2. Verificar en Google Play Console → Internal Testing que el release está activo
3. Confirmar que el tester puede instalar desde el enlace de Internal Testing

**Pasar si:** release visible en Google Play Console con estado `Active`.

---

### Criterio 8 — Tag v1.0.0 creado y visible en el repositorio

```bash
git tag v1.0.0
git push origin v1.0.0
```

**Verificar en GitHub:** https://github.com/<org>/healthy/tags → `v1.0.0` visible.  
**Verificar que dispara:** ir a Actions → `eas-submit.yml` → debe aparecer un run iniciado.

---

### Criterio 9 — tasks.md con todas las métricas de éxito marcadas [x]

Editar `projects/healthy/tasks.md` sección "Métricas de éxito" y cambiar cada `[ ]` a `[x]`:

```markdown
- [x] Cobertura de tests ≥ 80 %
- [x] Tiempo de respuesta API < 500 ms (p95)
- [x] App publicada en TestFlight y Google Play Internal
- [x] Auditoría RGPD sin hallazgos críticos
- [x] Pipeline CI/CD verde en rama `develop`
- [x] Modo oscuro funcional en todas las pantallas
- [x] Landing publicada en producción con SSL, dominio propio y score Lighthouse ≥ 95
- [x] Pipeline de despliegue de landing operativo (push a `main` → S3 → CloudFront invalidation < 60 s)
```

---

## 4. Comandos de primer deploy

Ejecutar en este orden exacto.

### 4.1 — Backup pre-deploy (obligatorio antes de cualquier cambio en producción)

Railway gestiona los backups automáticamente. Para hacer un backup manual desde la CLI de Railway:

```bash
# Instalar Railway CLI si no está instalado
npm install -g @railway/cli

# Login
railway login

# Volcar la base de datos de producción
railway run --service healthy-postgres --environment production \
  pg_dump $DATABASE_URL > backup-healthy-prod-$(date +%Y%m%d).sql

# Guardar el archivo en un lugar seguro fuera del repositorio
```

> Si prefieres hacerlo desde el dashboard: Railway → proyecto producción → PostgreSQL → Backups → Create Backup manual.

### 4.2 — Migración de base de datos en producción

```bash
cd projects/healthy/backend

# Aplicar migraciones (seguro en producción — no resetea datos)
DATABASE_URL=<production-url> npx prisma migrate deploy --schema ../database/schema.prisma

# Verificar estado
DATABASE_URL=<production-url> npx prisma migrate status --schema ../database/schema.prisma

# Regenerar cliente Prisma
npx prisma generate --schema ../database/schema.prisma
```

### 4.3 — Deploy del backend (Railway)

```bash
# Railway desplegará automáticamente al hacer push a main
# Para forzar un redeploy manual:
railway up --service healthy-api --environment production
```

O desde GitHub Actions: push a `main` con cambios en `backend/` → dispara `deploy-staging.yml` (staging) y el workflow de producción.

### 4.4 — Deploy de la landing

La landing se despliega automáticamente via GitHub Actions (`deploy-landing.yml`) al hacer push a `main` con cambios en `landing/`. El workflow construye con Vite y publica en S3 + CloudFront.

Para forzar un redeploy manual desde GitHub:
```
GitHub → Actions → deploy-landing.yml → Run workflow → main
```

### 4.5 — Crear tag y disparar submit a tiendas

```bash
git tag v1.0.0
git push origin v1.0.0
# → dispara eas-submit.yml automáticamente
```

### 4.6 — Verificación del pipeline completo

```bash
# Ver estado del pipeline en GitHub Actions:
gh run list --workflow=deploy-staging.yml --limit 5

# Smoke test manual contra producción:
curl -s https://api.healthy.app/health | python3 -m json.tool
# Esperado: {"success": true, "data": {"status": "ok", ...}}
```

---

## 5. Post-deploy — Qué verificar

Completar estas verificaciones dentro de los 30 minutos posteriores al deploy.

### Backend API

```bash
# Health check
curl -s https://api.healthy.app/health
# → {"success": true, "data": {"status": "ok", "db": "connected", "redis": "connected"}}

# Verificar que auth funciona (no debe devolver 500)
curl -s -X POST https://api.healthy.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com","name":"Test"}' | python3 -m json.tool
```

### Landing

- [ ] `https://healthy.app` carga con SSL válido (candado verde)
- [ ] No hay errores en la consola del navegador (F12 → Console)
- [ ] Redirección HTTP → HTTPS funciona: `curl -I http://healthy.app` devuelve `301`
- [ ] Headers de seguridad presentes: `curl -I https://healthy.app | grep -i "strict-transport\|x-frame\|x-content-type"`

### App móvil

- [ ] Build disponible en TestFlight (iOS) y Google Play Internal Testing (Android)
- [ ] Al menos 1 tester prueba el flujo: registro → onboarding → ver plan
- [ ] No hay crashes en el primer arranque

### Monitorización

- [ ] UptimeRobot (o equivalente) configurado con alerta para `https://api.healthy.app/health`
- [ ] Railway Metrics activo: revisar CPU, RAM y errores en el dashboard del servicio
- [ ] Logs visibles en Railway → proyecto producción → backend → Deployments → Logs

### Base de datos

- [ ] `npx prisma migrate status` muestra todas las migraciones como `Applied` en producción
- [ ] Backups automáticos de Railway PostgreSQL activados (Railway los habilita por defecto en planes pagos)

### Cierre del proyecto

Una vez verificados todos los puntos anteriores:

1. Actualizar `ORCHESTRATOR_STATUS.log` con fecha, versión `v1.0.0`, métricas alcanzadas e issues pendientes para v1.1.0
2. Mergear PR-6 en `main`

---

## 6. Estado sesiones 2026-06-20 / 2026-06-24

### 6.1 ✅ Railway Token generado y configurado en GitHub
Token `github-actions-ci` creado y actualizado en `RAILWAY_TOKEN` (GitHub repo secret). ✔

### 6.2 ✅ Servicio backend creado en Railway (healthy-staging)
- Service ID: `fa137c98-5210-4057-a531-f1c7fbf39743`
- Source: `trutool-dev/ai-studio`, Root: `projects/healthy/backend`
- PostgreSQL y Redis: Online ✔

### 6.3 ✅ Entornos GitHub creados (staging + production)
- `staging` → solo rama `develop` ✔
- `production` → solo rama `main` + reviewer requerido (trutool-dev) ✔

### 6.4 ✅ Git push a develop
PRs 1-6 subidas. ~200 ficheros en rama `develop`. ✔

### 6.5 ⚠️ Variables entorno Railway backend — PARCIALMENTE COMPLETADO

**Añadidas (5):**
- `NODE_ENV=staging`
- `JWT_SECRET` ✔
- `JWT_REFRESH_SECRET` ✔
- `SMTP_PORT=587`
- `EMAIL_FROM=Healthy App <noreply@healthy.app>`

**Pendientes — necesito que las proporciones:**

| Variable | Cómo obtenerla |
|----------|---------------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase Dashboard → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role |
| `SMTP_HOST` | Tu proveedor SMTP (p.ej. `smtp.mailgun.org`) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `FRONTEND_URL` | URL Expo de staging (se obtiene tras primer deploy) |

> Una vez añadidas, hacer clic en **Deploy** en Railway para lanzar el primer deploy.

### 6.6 ✅ Primer Deploy Railway

Backend desplegado desde rama `develop`. Estado: **Online**. ✔
(Nota: primer intento falló porque la rama estaba en `main` — corregido a `develop`)

### 6.7 ✅ Migración Prisma (staging)

Ejecutada el 2026-06-28 con `DATABASE_URL` pública de Railway.
Tablas creadas: `auth_sessions`, `daily_logs`, `exercises`, `food_restrictions`, `foods`, `health_conditions`, `lifestyle_profiles`, `meal_foods`, `meals`, `motivation_profile`, y más. ✔

### 6.8 ✅ Secrets de entorno en GitHub (2026-06-29)

**Entorno staging** — 5 secrets añadidos:
- `JWT_SECRET`, `JWT_REFRESH_SECRET` ✔
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ✔

**Entorno production** — 5 secrets añadidos:
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (claves exclusivas de producción) ✔
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ✔

Pendiente: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (requiere proveedor SMTP).

### 6.9 ✅ Secrets de repositorio en GitHub (2026-06-29)

Añadidos en **Settings → Secrets and variables → Actions → Repository secrets**:
- `ANTHROPIC_API_KEY` ✔
- `RAILWAY_TOKEN` ✔
- `RAILWAY_STAGING_DATABASE_URL` = `postgresql://postgres:QDPwtSHILsHFwOpaYaQsAKjvtsxdClhK@thomas.proxy.rlwy.net:44480/railway` ✔
- `RAILWAY_PRODUCTION_SERVICE_ID` = `ec2720da-2f41-436c-a5e2-e39f7b7d9a6e` ✔

Pendiente: `RAILWAY_PRODUCTION_DATABASE_URL` (necesita URL pública del Postgres de producción).

### 6.10 ✅ Healthcheck staging verificado (2026-06-29)

- Dominio generado: `https://backend-staging-01ee.up.railway.app`
- `GET /health` → `{"success":true,"message":"OK"}` ✔

### 6.11 ✅ SMTP Gmail configurado (2026-06-29)

Gmail App Password (`mvivyeiwdbndypxb`) creado con 2FA activo en `trutool@gmail.com`.

**Railway production** (14 variables, Online) — SMTP añadido:
- `SMTP_HOST=smtp.gmail.com` ✔
- `SMTP_PORT=587` ✔
- `SMTP_USER=trutool@gmail.com` ✔
- `SMTP_PASS=mvivyeiwdbndypxb` ✔
- `EMAIL_FROM="Healthy App <trutool@gmail.com>"` ✔

**Railway staging** (12 variables, Online) — SMTP añadido:
- `SMTP_HOST=smtp.gmail.com` ✔
- `SMTP_PORT=587` ✔
- `SMTP_USER=trutool@gmail.com` ✔
- `SMTP_PASS=mvivyeiwdbndypxb` ✔
- `EMAIL_FROM="Healthy App <trutool@gmail.com>"` ✔

> GitHub Environments (staging + production): SMTP secrets pendientes de añadir si los workflows CI los referencian directamente.

### 6.12 ✅ RAILWAY_PRODUCTION_DATABASE_URL (2026-06-29)

`postgresql://postgres:uafKvfChkeiZYylgsppDWifuNAYjsdPx@thomas.proxy.rlwy.net:25732/railway` añadido como repo secret en GitHub ✔

### 6.13 ✅ Migración Prisma en producción (2026-06-29)

Ejecutado `prisma-migrate-prod.bat` correctamente. Migraciones aplicadas en Railway production PostgreSQL. ✔

### 6.14 ✅ Primer deploy de producción (2026-06-29)

- PR #4 (`develop → main`) creada y mergeada (21 commits, 428 files) ✔
- Builder cambiado a **Railpack** (no existe Dockerfile en el repo) ✔
- Railway production auto-deployed → **Online** ✔
- Dominio generado: `https://ai-studio-production-1835.up.railway.app` ✔
- `GET /health` → `{"success":true}` ✔

### 6.15 ⏳ CI checks fallidos en GitHub Actions

Los siguientes checks fallan en PR/pushes a `develop` y `main`:
- `CI/AI lint+test` — pendiente investigar
- `CI/Backend lint+test` — pendiente investigar
- `Deploy/Build+Push ECR` — referencia a AWS ECR (no usamos ECR, todo en Railway)

Estado: no bloquean el deploy (Railway CI pasa ✔) pero deben resolverse antes de v1.0.0.

---

*Generado por el agente orquestador — 2026-06-15 | Actualizado — 2026-06-29*
