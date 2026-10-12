# SECRETS_STATUS — Estado de los secretos GitHub Actions

**Fecha de auditoría:** 2026-06-15  
**Auditor:** agente devops (PR-5)

> Este documento es el registro oficial del estado de cada secreto necesario para que los pipelines de CI/CD funcionen. Actualizar cada vez que se configure o rote un secreto.

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Configurado y verificado |
| ⏳ | Pendiente de configurar |
| ⚠️ | Requiere atención (valor de ejemplo / por rotar) |

---

## Secretos de repositorio (Repository secrets)

| Secreto | Estado | Notas |
|---------|--------|-------|
| `RAILWAY_TOKEN` | ⏳ | Crear en railway.app → Account Settings → Tokens |
| `ANTHROPIC_API_KEY` | ⏳ | Obtener en console.anthropic.com → API Keys |
| `AWS_ACCESS_KEY_ID` | ⏳ | IAM user `ci-cd-user` con política S3+CloudFront mínima |
| `AWS_SECRET_ACCESS_KEY` | ⏳ | Generado junto con `AWS_ACCESS_KEY_ID` |
| `CLOUDFRONT_DISTRIBUTION_ID` | ⏳ | Disponible tras aplicar Terraform (`infra/cloudfront-landing.tf`) |
| `RAILWAY_STAGING_DATABASE_URL` | ⏳ | Railway Dashboard → proyecto staging → Postgres → DATABASE_URL |
| `RAILWAY_PRODUCTION_DATABASE_URL` | ⏳ | Railway Dashboard → proyecto producción → Postgres → DATABASE_URL |

---

## Secretos del entorno `staging`

| Secreto | Estado | Notas |
|---------|--------|-------|
| `JWT_SECRET` | ⚠️ | Valor pre-generado en GITHUB_SECRETS.md — cargar tal cual |
| `JWT_REFRESH_SECRET` | ⚠️ | Valor pre-generado en GITHUB_SECRETS.md — cargar tal cual |
| `SMTP_HOST` | ⏳ | `smtp.mailgun.org` o `smtp.gmail.com` |
| `SMTP_PORT` | ⏳ | `587` (STARTTLS) |
| `SMTP_USER` | ⏳ | Cuenta SMTP para envíos de verificación |
| `SMTP_PASS` | ⏳ | Password o app-password SMTP |
| `EMAIL_FROM` | ⏳ | `Healthy App <noreply@healthy.app>` |

> Railway inyecta `DATABASE_URL` y `REDIS_URL` automáticamente — no añadir aquí.

---

## Secretos del entorno `production`

| Secreto | Estado | Notas |
|---------|--------|-------|
| `JWT_SECRET` | ⚠️ | Valor pre-generado en GITHUB_SECRETS.md — **distinto** del de staging |
| `JWT_REFRESH_SECRET` | ⚠️ | Valor pre-generado en GITHUB_SECRETS.md — **distinto** del de staging |
| `SMTP_HOST` | ⏳ | SMTP producción |
| `SMTP_PORT` | ⏳ | `587` |
| `SMTP_USER` | ⏳ | SMTP producción |
| `SMTP_PASS` | ⏳ | SMTP producción |
| `EMAIL_FROM` | ⏳ | `Healthy App <noreply@healthy.app>` |

---

## Secretos Expo EAS (app móvil)

| Secreto | Estado | Notas |
|---------|--------|-------|
| `EXPO_TOKEN` | ⏳ | expo.dev → Account Settings → Access Tokens |
| `APPLE_APP_STORE_CONNECT_API_KEY_ID` | ⏳ | App Store Connect → Users and Access → Keys → Key ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID` | ⏳ | App Store Connect → Users and Access → Keys → Issuer ID |
| `APPLE_APP_STORE_CONNECT_API_KEY_CONTENT` | ⏳ | Contenido del `.p8` en base64: `base64 < AuthKey_XXXX.p8` |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | ⏳ | Google Play Console → Setup → API access → JSON completo |

---

## Configuración de entornos GitHub

Para que los environments `staging` y `production` existan en GitHub:

1. **Crear entornos:** Settings → Environments → New environment → `staging` y `production`
2. **Protection rules en `production`:**
   - ✅ Required reviewers: añadir al menos 1 revisor
   - ✅ Restrict pushes that create matching branches (solo rama `main`)
3. **Deployment branches:**
   - `staging`: permitir rama `develop`
   - `production`: solo rama `main`

---

## Orden de configuración recomendado

```
Paso 1 — Railway
  [ ] Crear proyecto Railway staging
  [ ] Añadir servicio PostgreSQL
  [ ] Añadir servicio Redis
  [ ] Obtener RAILWAY_TOKEN, RAILWAY_STAGING_DATABASE_URL

Paso 2 — AWS (solo landing)
  [ ] Crear IAM user ci-cd-user con política S3+CloudFront
  [ ] Obtener AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  [ ] Tras aplicar Terraform: obtener CLOUDFRONT_DISTRIBUTION_ID

Paso 4 — Email
  [ ] Crear cuenta Mailgun (o usar Gmail con app password)
  [ ] Configurar SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

Paso 5 — Anthropic
  [ ] Obtener ANTHROPIC_API_KEY

Paso 6 — EAS/Apple/Google (solo antes de publicar)
  [ ] Crear cuenta Apple Developer + App Store Connect API Key
  [ ] Crear cuenta Google Play + Service Account
  [ ] Obtener EXPO_TOKEN
```

---

## Verificación post-configuración

Ejecutar este workflow manual para confirmar que los secretos de Railway están bien:

```bash
# Trigger manual del workflow de backup (modo staging)
gh workflow run db-backup.yml -f environment=staging
```

Si el job `backup` termina con éxito, Railway + RAILWAY_STAGING_DATABASE_URL están correctamente configurados.
