# PIPELINE_DRYRUN — Resultados del dry-run CI/CD

**Fecha:** 2026-06-15  
**Ejecutado por:** agente devops (PR-5)  
**Nota:** dry-run estático (sin infraestructura real activa). Los resultados reflejan la validación de configuración de los workflows, no una ejecución real en GitHub Actions.

---

## 1. Workflow `deploy-staging.yml` — test → deploy → smoke-test

### Análisis estático del workflow

| Job | Estado | Observaciones |
|-----|--------|---------------|
| `test` (Jest + cobertura ≥ 80%) | ✅ Estructura correcta | Servicios postgres:16-alpine y redis:7-alpine levantados. Variables de entorno para test correctamente aisladas (no usan secretos reales). `--passWithNoTests` evita fallo en CI cuando los tests de integración requieren DB real. |
| `deploy` (Railway CLI) | ✅ Estructura correcta | `railway up --service <ID> --detach` correcto para Railway. El `RAILWAY_SERVICE_ID` hardcodeado en el env del workflow es aceptable (no es un secreto). |
| `smoke-test` (`GET /health`) | ✅ **Corregido en PR-5** | Bug detectado y corregido: la aserción original comprobaba `d.get('status') == 'ok'` pero el endpoint devuelve `{success: bool, data: {status: 'ok'}}`. Corregido a `d.get('success') == True and d.get('data', {}).get('status') == 'ok'`. |

### Bug corregido: smoke test assertion

```python
# ANTES (incorrecto — status no está en raíz):
assert d.get('status') == 'ok'

# DESPUÉS (correcto — coincide con la respuesta real de /health):
assert d.get('success') == True
assert d.get('data', {}).get('status') == 'ok'
```

### Gaps identificados

- **No existe `deploy-production.yml`**: el stack de producción usa AWS ECS (Terraform en `infra/`), pero no hay workflow para desplegarlo. Bloqueante para go-live. Se documenta como deuda para PR-6.
- El `cache: npm` en `actions/setup-node@v4` require `cache-dependency-path` — ✅ ya está presente.

---

## 2. Workflow `deploy-landing.yml` — S3 sync + CloudFront invalidation

### Análisis estático del workflow

| Step | Estado | Observaciones |
|------|--------|---------------|
| `Configure AWS credentials` | ✅ Correcto | Usa `aws-actions/configure-aws-credentials@v4`. Secretos `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID` referenciados correctamente. |
| `Upload index.html (no-cache)` | ✅ Correcto | `--cache-control "no-cache"` para garantizar que siempre sirve la versión más reciente. |
| `Sync static assets` | ✅ Correcto | `--delete` elimina archivos huérfanos. `--exclude "index.html"` evita sobreescribir con cache. |
| `Invalidate CloudFront cache` | ✅ Correcto | `--paths "/*"` invalida todo el árbol de distribución. |
| `environment: production` | ✅ **Añadido en PR-5** | Protección de entorno para que production requiera aprobación manual. |

### Verificación de prerequisitos S3/CloudFront

Los siguientes recursos deben existir antes de que el workflow funcione:

- [ ] Bucket S3 `healthy-landing-prod` creado (ver `infra/s3-landing.tf`)
- [ ] CloudFront distribution creada apuntando al bucket (ver `infra/cloudfront-landing.tf`)
- [ ] IAM user `ci-cd-user` con política de S3+CloudFront mínima
- [ ] Registro DNS en Route 53 apuntando al distribution (ver `infra/route53-landing.tf`)
- [ ] Certificado SSL en ACM (región `us-east-1` — obligatorio para CloudFront)

---

## 3. Workflow `eas-build.yml` — build app móvil

### Análisis estático del workflow

| Step | Estado | Observaciones |
|------|--------|---------------|
| `npm ci` | ✅ Correcto | `cache-dependency-path` apunta a `frontend/package-lock.json`. |
| `eas build --no-wait` | ✅ Intencionado | `--no-wait` envía el build a la cola de EAS sin bloquear el runner. Correcto para builds largos. |
| `EXPO_TOKEN` | ✅ Referenciado correctamente | |
| `eas.json` perfiles | ✅ Verificado | `development`, `preview`, `production` definidos en `frontend/eas.json`. |

### Verificación `eas.json`

```json
// frontend/eas.json — perfiles verificados:
"development": { "developmentClient": true, "distribution": "internal" }  ✅
"preview":     { "distribution": "internal", "android": { "buildType": "apk" } }  ✅
"production":  { "autoIncrement": true }  ✅
```

---

## 4. Workflow `eas-submit.yml` — publicar en tiendas

### Bug crítico corregido: credenciales Apple

| Paso | Antes (incorrecto) | Después (correcto) |
|------|-------------------|--------------------|
| iOS submit env vars | `EXPO_APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_STORE_CONNECT_API_KEY_CONTENT }}` | `EXPO_ASC_API_KEY_ID`, `EXPO_ASC_API_KEY_ISSUER_ID`, `EXPO_ASC_API_KEY_P8_CONTENT` |
| Google Play JSON path | `/tmp/google-service-account.json` (no coincide con `eas.json`) | `./google-service-account.json` en el working directory |

**Motivo del bug Apple:** `EXPO_APPLE_APP_SPECIFIC_PASSWORD` es la contraseña de app de Apple ID (método legacy), mientras que `EXPO_ASC_API_KEY_*` son las variables para la App Store Connect API (método actual recomendado por EAS). Mezclarlos causa un error de autenticación silencioso.

**Motivo del bug Google Play:** `eas.json` tiene `serviceAccountKeyPath: "./google-service-account.json"` (relativa al working directory `frontend/`), pero el workflow escribía el JSON en `/tmp/`. EAS no encontraba el archivo y fallaba.

---

## 5. Workflow `db-backup.yml` — backup semanal

### Análisis estático del workflow

| Step | Estado | Observaciones |
|------|--------|---------------|
| `pg_dump` | ✅ Correcto | Formato `--format=custom` para restauración eficiente. `--no-owner --no-acl` para portabilidad. |
| `upload-artifact@v4` | ✅ Correcto | Retención 30 días. Accesible en Actions → Artifacts. |
| `DATABASE_URL` selection | ✅ Correcto | Expresión ternaria selecciona staging o production según input. |
| Secretos referenciados | ⏳ Pendientes | `RAILWAY_STAGING_DATABASE_URL`, `RAILWAY_PRODUCTION_DATABASE_URL` — añadidos a `GITHUB_SECRETS.md`. |

---

## Snapshot RDS pre-go-live

> ⚠️ No ejecutado — no hay instancia RDS real activa aún. La infraestructura Terraform (`infra/rds.tf`) está definida pero no aplicada.

**Comando a ejecutar cuando RDS esté disponible:**

```bash
aws rds create-db-snapshot \
  --db-instance-identifier healthy-prod \
  --db-snapshot-identifier "healthy-prod-pre-deploy-$(date +%Y%m%d)" \
  --region eu-west-1

# Verificar que el snapshot se creó:
aws rds describe-db-snapshots \
  --db-instance-identifier healthy-prod \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,Status:Status}' \
  --output table \
  --region eu-west-1
```

**ARN del snapshot:** PENDIENTE — documentar aquí tras go-live:  
`arn:aws:rds:eu-west-1:<account-id>:snapshot:healthy-prod-pre-deploy-<fecha>`

---

## Resumen de hallazgos y acciones tomadas

| # | Hallazgo | Severidad | Acción |
|---|----------|-----------|--------|
| 1 | Smoke test comprueba campo incorrecto en respuesta `/health` | 🔴 Alta | **Corregido** en `deploy-staging.yml` |
| 2 | Credenciales Apple mapeadas incorrectamente en `eas-submit.yml` | 🔴 Alta | **Corregido** en `eas-submit.yml` |
| 3 | Google Play JSON escrito en `/tmp/` (no coincide con `eas.json`) | 🔴 Alta | **Corregido** en `eas-submit.yml` |
| 4 | `deploy-landing.yml` sin `environment: production` | 🟡 Media | **Corregido** en `deploy-landing.yml` |
| 5 | `SUPABASE_ANON_KEY` en GITHUB_SECRETS.md vs `SUPABASE_KEY` en backend | 🟡 Media | **Corregido** en `GITHUB_SECRETS.md` |
| 6 | `SUPABASE_SERVICE_ROLE_KEY` no documentado en GITHUB_SECRETS.md | 🟡 Media | **Añadido** a `GITHUB_SECRETS.md` |
| 7 | `RAILWAY_*_DATABASE_URL` no documentados en GITHUB_SECRETS.md | 🟡 Media | **Añadidos** a `GITHUB_SECRETS.md` |
| 8 | No existe `deploy-production.yml` para AWS ECS | 🟠 Pendiente | Gap documentado — crear antes de PR-6 |
| 9 | Snapshot RDS pre-go-live pendiente de ejecutar | 🟠 Pendiente | Ejecutar cuando RDS esté disponible |

---

## Estado final del pipeline

```
deploy-staging.yml   → ✅ Corregido y listo para prueba real
deploy-landing.yml   → ✅ Corregido y listo (prerequisito: infra S3/CF aplicada)
eas-build.yml        → ✅ Sin cambios — correcto
eas-submit.yml       → ✅ Corregido (credenciales Apple + Google Play path)
db-backup.yml        → ✅ Correcto (secretos DB pendientes de configurar)
deploy-production.yml → ⏳ PENDIENTE — crear antes de go-live
```
