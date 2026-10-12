# PR-5-READY — Pipeline CI/CD y variables de producción

**Fecha:** 2026-06-15  
**Agente:** devops  
**PR:** `chore: pipeline CI/CD y vars producción`  
**Riesgo:** ALTO — configuración de producción. No tocar infraestructura real hasta que PR-2 esté mergeada.

---

## 1. Inventario completo de secretos

Lista canónica de todos los secretos necesarios para el stack completo. Ningún valor real — solo nombres y cómo obtenerlos.

### Secretos de repositorio (todos los entornos)

| Nombre | Usado en | Cómo obtener |
|--------|----------|--------------|
| `RAILWAY_TOKEN` | `deploy-staging.yml` (Railway CLI) | railway.app → Account Settings → Tokens → Create Token |
| `ANTHROPIC_API_KEY` | Backend (runtime, inyectado por Railway) | console.anthropic.com → API Keys → Create Key |
| `AWS_ACCESS_KEY_ID` | `deploy-landing.yml` (S3 sync) | AWS Console → IAM → Users → ci-cd-user → Security credentials |
| `AWS_SECRET_ACCESS_KEY` | `deploy-landing.yml` (S3 sync) | Generado junto con `AWS_ACCESS_KEY_ID` — guardar inmediatamente |
| `CLOUDFRONT_DISTRIBUTION_ID` | `deploy-landing.yml` (invalidación) | AWS Console → CloudFront → distribución → Distribution ID (tras aplicar Terraform) |
| `RAILWAY_STAGING_DATABASE_URL` | `db-backup.yml` (pg_dump) | Railway Dashboard → proyecto staging → Postgres → Variables → DATABASE_URL |
| `RAILWAY_PRODUCTION_DATABASE_URL` | `db-backup.yml` (pg_dump) | Railway Dashboard → proyecto producción → Postgres → Variables → DATABASE_URL |

### Secretos del entorno `staging`

| Nombre | Usado en | Cómo obtener |
|--------|----------|--------------|
| `JWT_SECRET` | Backend — firmar access tokens (15min) | `openssl rand -base64 64` — valor pre-generado en `devops/GITHUB_SECRETS.md` |
| `JWT_REFRESH_SECRET` | Backend — firmar refresh tokens (30d) | `openssl rand -base64 64` — valor pre-generado en `devops/GITHUB_SECRETS.md` |
| `SUPABASE_URL` | Backend (`supabase.service.js`) | Supabase Dashboard → proyecto staging → Settings → API → Project URL |
| `SUPABASE_KEY` | Backend (`process.env.SUPABASE_KEY`) | Supabase Dashboard → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (operaciones admin Supabase) | Supabase Dashboard → Settings → API → service_role key |
| `SMTP_HOST` | Backend (`email.service.js`) | `smtp.mailgun.org` o `smtp.gmail.com` |
| `SMTP_PORT` | Backend (`email.service.js`) | `587` (STARTTLS) |
| `SMTP_USER` | Backend (`email.service.js`) | Cuenta de correo configurada en el proveedor SMTP |
| `SMTP_PASS` | Backend (`email.service.js`) | Password o app-password SMTP |
| `EMAIL_FROM` | Backend (`email.service.js`) | `Healthy App <noreply@healthy.app>` |

> Railway inyecta `DATABASE_URL` y `REDIS_URL` automáticamente — no configurar en GitHub Secrets.

### Secretos del entorno `production`

Los mismos que staging, con valores distintos (especialmente `JWT_SECRET` y `JWT_REFRESH_SECRET`). Ver `devops/GITHUB_SECRETS.md` para los valores pre-generados.

### Secretos Expo EAS

| Nombre | Usado en | Cómo obtener |
|--------|----------|--------------|
| `EXPO_TOKEN` | `eas-build.yml`, `eas-submit.yml` | expo.dev → Account Settings → Access Tokens |
| `APPLE_APP_STORE_CONNECT_API_KEY_ID` | `eas-submit.yml` → `EXPO_ASC_API_KEY_ID` | App Store Connect → Users and Access → Keys → Key ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID` | `eas-submit.yml` → `EXPO_ASC_API_KEY_ISSUER_ID` | App Store Connect → Users and Access → Keys → Issuer ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_CONTENT` | `eas-submit.yml` → `EXPO_ASC_API_KEY_P8_CONTENT` | `base64 < AuthKey_XXXXXXXX.p8` — contenido del archivo .p8 codificado |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | `eas-submit.yml` (escrito a `./google-service-account.json`) | Google Play Console → Setup → API access → Create service account → Download JSON |

---

## 2. Cambios realizados en los workflows

### `deploy-staging.yml` — smoke test corregido

**Bug:** El smoke test verificaba `d.get('status') == 'ok'` pero el endpoint `GET /health` del backend devuelve `{success: bool, data: {status: 'ok'|'degraded', ...}}`. El campo `status` está anidado bajo `data`, no en la raíz.

**Fix aplicado:**
```python
# Antes (fallaba silenciosamente si status era 'ok' pero en data.status):
assert d.get('status') == 'ok'

# Después (correcto):
assert d.get('success') == True
assert d.get('data', {}).get('status') == 'ok'
```

### `deploy-landing.yml` — environment protection añadido

**Cambio:** Añadido `environment: production` al job `deploy`. Esto activa las protection rules configuradas en GitHub → Settings → Environments → production (required reviewers, deployment branches).

### `eas-submit.yml` — credenciales Apple y Google Play corregidas

**Bug Apple:** Se usaba `EXPO_APPLE_APP_SPECIFIC_PASSWORD` (para autenticación con Apple ID, método legacy) y se le asignaba el contenido del `.p8` de la API key de App Store Connect. Son dos sistemas de autenticación distintos e incompatibles.

**Fix Apple:** Usar las tres variables de la ASC API (método actual recomendado):
- `EXPO_ASC_API_KEY_ID` ← `secrets.APPLE_APP_STORE_CONNECT_API_KEY_ID`
- `EXPO_ASC_API_KEY_ISSUER_ID` ← `secrets.APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID`
- `EXPO_ASC_API_KEY_P8_CONTENT` ← `secrets.APPLE_APP_STORE_CONNECT_API_KEY_CONTENT`

**Bug Google Play:** El JSON de la service account se escribía en `/tmp/google-service-account.json` pero `eas.json` tiene `serviceAccountKeyPath: "./google-service-account.json"` (relativo al working directory `frontend/`). EAS no encontraba el archivo.

**Fix Google Play:** Escribir el JSON en el working directory (`projects/healthy/frontend/google-service-account.json`) y limpiar tras el submit.

### `GITHUB_SECRETS.md` — correcciones y adiciones

- **Corregido:** `SUPABASE_ANON_KEY` → `SUPABASE_KEY` (para coincidir con `process.env.SUPABASE_KEY` en el backend)
- **Añadido:** `SUPABASE_SERVICE_ROLE_KEY` (faltaba, usado en backend)
- **Añadidos:** `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` (faltaban, documentados en `ENV_VARS.md`)
- **Añadidos:** `RAILWAY_STAGING_DATABASE_URL`, `RAILWAY_PRODUCTION_DATABASE_URL` (referenciados en `db-backup.yml` pero no documentados)

---

## 3. Checklist pre-go-live

Completar en orden antes de mergear PR-6.

### Prerequisito: PR-2 mergeada

- [ ] **PR-2 mergeada** — la migración Prisma (`TokenUsageLog` + `health_consent_given_at`) debe estar aplicada antes de configurar producción. Sin esto, ECS apuntaría a un schema desactualizado.

### Infraestructura AWS

- [ ] Terraform `init` + `plan` + `apply` ejecutado en `devops/infra/` — crea VPC, RDS, ElastiCache, ECS cluster, ALB, S3 bucket, CloudFront, Route 53
- [ ] Verificar que el certificado SSL en ACM (`us-east-1`) está validado para `healthy.app`
- [ ] Verificar que la CloudFront distribution está en estado `Deployed`
- [ ] Verificar que el bucket S3 `healthy-landing-prod` existe y tiene static website hosting activo
- [ ] Verificar que el registro DNS en Route 53 apunta a la CloudFront distribution

### Secretos GitHub Actions

- [ ] Todos los secretos de repositorio configurados (ver `devops/SECRETS_STATUS.md`)
- [ ] Secretos del entorno `staging` configurados
- [ ] Secretos del entorno `production` configurados
- [ ] Environments `staging` y `production` creados en GitHub con protection rules
- [ ] `production` environment tiene required reviewers configurado

### Pipeline staging (Railway)

- [ ] Proyecto Railway staging creado con servicios: backend, PostgreSQL, Redis
- [ ] Variables de entorno inyectadas en Railway Dashboard (o como Railway Variables)
- [ ] Push a rama `develop` con cambios en `backend/` dispara `deploy-staging.yml`
- [ ] Job `test` pasa con cobertura ≥ 80%
- [ ] Job `deploy` completa sin errores
- [ ] Job `smoke-test` devuelve `{"success": true, "data": {"status": "ok"}}`

### Pipeline landing (S3 + CloudFront)

- [ ] Push a `main` con cambios en `landing/` dispara `deploy-landing.yml`
- [ ] Job aprobado en GitHub Environments (production reviewers)
- [ ] `aws s3 sync` sube los archivos correctamente
- [ ] Invalidación CloudFront completada
- [ ] Landing carga en `https://healthy.app` con SSL válido y sin errores de consola
- [ ] Lighthouse score ≥ 95 en Performance, Accessibility, Best Practices, SEO

### App móvil (EAS)

- [ ] `eas-build.yml` dispara en push a `develop` con cambios en `frontend/`
- [ ] Build perfil `preview` completado en EAS sin errores
- [ ] Build disponible para instalar vía Expo Go (interno)

### Backup RDS

- [ ] Snapshot manual pre-go-live ejecutado (comando abajo)
- [ ] ARN del snapshot documentado en `devops/PIPELINE_DRYRUN.md`
- [ ] Procedimiento de restauración verificado en entorno staging (test trimestral)

---

## 4. Comando de backup RDS pre-go-live

Ejecutar este comando manualmente desde una máquina con AWS CLI configurado **antes** de cualquier deploy a producción:

```bash
# Crear snapshot manual pre-deploy
SNAPSHOT_ID="healthy-prod-pre-deploy-$(date +%Y%m%d)"

aws rds create-db-snapshot \
  --db-instance-identifier healthy-prod \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --region eu-west-1

echo "Snapshot iniciado: $SNAPSHOT_ID"

# Esperar a que el snapshot esté disponible (5-15 min)
aws rds wait db-snapshot-completed \
  --db-instance-identifier healthy-prod \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --region eu-west-1

# Obtener el ARN del snapshot
aws rds describe-db-snapshots \
  --db-snapshot-identifier "$SNAPSHOT_ID" \
  --query 'DBSnapshots[0].DBSnapshotArn' \
  --output text \
  --region eu-west-1
```

Documentar el ARN resultante en `devops/PIPELINE_DRYRUN.md` bajo "ARN del snapshot".

Para restauración de emergencia, ver el procedimiento completo de 5 pasos en `devops/BACKUP_STRATEGY.md`.

---

## 5. Dependencias con PR-2 (migración)

PR-5 **no puede completarse** sin PR-2 mergeada. Razones concretas:

**Razón 1 — Schema de BD en estado final:**  
PR-2 añade `TokenUsageLog` y `health_consent_given_at` al schema Prisma. Si el entorno de producción se configura antes, la imagen Docker del backend incluirá el schema actualizado pero la BD no tendría las tablas — causando errores 500 en el arranque cuando Prisma intenta acceder a `token_usage_logs`.

**Razón 2 — Migración aplicada en staging antes de producción:**  
El workflow `deploy-staging.yml` hace `npm ci` pero no ejecuta `prisma migrate deploy`. Esto debe añadirse como step en el workflow o ejecutarse manualmente en Railway antes del primer deploy. Confirmar con agente database.

**Razón 3 — Seed actualizado:**  
Si el entorno de staging usa el seed (`database/seed.ts`) para datos de prueba, el seed debe ser compatible con el schema final de PR-2.

**Acción recomendada:** Añadir el siguiente step al job `deploy` de `deploy-staging.yml` una vez PR-2 mergeada:

```yaml
- name: Ejecutar migraciones Prisma
  working-directory: projects/healthy/backend
  env:
    DATABASE_URL: ${{ secrets.RAILWAY_STAGING_DATABASE_URL }}
  run: npx prisma migrate deploy
```

---

## 6. Gap pendiente: deploy-production.yml

La infraestructura de producción usa AWS ECS (definida en `devops/infra/ecs.tf`) pero no existe un workflow `deploy-production.yml`. Actualmente el único pipeline de deploy automatizado es para Railway staging.

El workflow de producción debería incluir:
1. Push imagen Docker a ECR (`aws ecr get-login-password | docker login`, `docker build`, `docker push`)
2. Actualizar task definition de ECS con la nueva imagen
3. `aws ecs update-service --force-new-deployment`
4. `aws ecs wait services-stable`
5. Smoke test contra `https://api.healthy.app/health`

Este workflow debe crearse antes de PR-6 (go-live). Se recomienda como tarea adicional entre PR-5 y PR-6.

---

## Archivos modificados en esta PR

```
devops/.github/workflows/deploy-staging.yml   MODIFICADO — smoke test assertion corregida
devops/.github/workflows/deploy-landing.yml   MODIFICADO — environment: production añadido
devops/.github/workflows/eas-submit.yml       MODIFICADO — credenciales Apple y Google Play corregidas
devops/GITHUB_SECRETS.md                      MODIFICADO — SUPABASE_KEY, secrets faltantes añadidos
devops/SECRETS_STATUS.md                      CREADO — inventario de estado de cada secret
devops/PIPELINE_DRYRUN.md                     CREADO — resultados dry-run y hallazgos
projects/healthy/PR-5-READY.md                CREADO — este documento
```
