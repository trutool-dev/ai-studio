# PR-5 — Corrección de inconsistencias Railway / Infraestructura

**Fecha:** 2026-06-15
**Agente:** devops
**Decisión previa:** AWS descartado. Toda la infraestructura de backend va a Railway por coste.

---

## Cambios incluidos en este PR

### 1. Nuevo: `.github/workflows/deploy-production.yml`

Pipeline de deploy a producción en Railway. Sigue el mismo patrón que `deploy-staging.yml` con estas diferencias:

- **Trigger:** push a `main` (paths: `projects/healthy/backend/**`)
- **Environment:** `production` (GitHub Environment con protection rules — revisor requerido)
- **Service:** `${{ secrets.RAILWAY_PRODUCTION_SERVICE_ID }}` (variable en GitHub Secrets)
- **URL producción:** `https://healthy-api.up.railway.app`
- **Jobs:**
  1. `test` — Jest con cobertura ≥80% (igual que staging)
  2. `migrate` — `prisma migrate deploy` contra `RAILWAY_PRODUCTION_DATABASE_URL` (**nuevo**, no existe en staging)
  3. `deploy` — `railway up --service $RAILWAY_PRODUCTION_SERVICE_ID --detach`
  4. `smoke-test` — 18 reintentos × 10s (180s total, más margen que staging) contra `/health`

### 2. Actualizado: `infrastructure/staging.md`

Reescrito completamente. Sustituye toda la documentación AWS/ECS/ALB/RDS/ElastiCache por:

- Diagrama de arquitectura Railway (Service → PostgreSQL plugin + Redis plugin)
- Tabla de servicios Railway con URLs
- Variables de entorno que Railway inyecta automáticamente
- Tabla de sizing y coste real (~$0–5/mes staging, ~$20/mes producción vs. ~$80–188/mes en AWS)
- Checklist de primer deploy a staging

### 3. Actualizado: `GITHUB_SECRETS.md`

- **Eliminado:** referencias a `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` como secrets de backend/ECS
- **Aclarado:** las credenciales AWS son exclusivas de la landing (S3 + CloudFront), sin acceso a ECS/RDS
- **Añadido:** `RAILWAY_PRODUCTION_SERVICE_ID` como nuevo secret de repositorio requerido
- **Añadida:** sección separada "Secretos para la landing page (AWS S3 + CloudFront)" para evitar confusión
- **Actualizado:** tabla de resumen "qué configurar ahora" incluye `RAILWAY_PRODUCTION_SERVICE_ID`

### 4. Actualizado: `README.md`

- Tabla de entornos actualizada: staging y producción apuntan a Railway, no AWS
- Nota de decisión de infraestructura añadida
- **Sección nueva:** "⚠️ Archivos Terraform deprecados" — documenta que `infra/*.tf` están deprecados y serán borrados manualmente; NO se borra el directorio en este PR
- Arquitectura AWS sustituida por diagrama Railway
- Tabla de servicios AWS eliminada, sustituida por tabla Railway + AWS (landing)
- Secrets y variables de entorno actualizados a Railway

### 5. Sin cambios: `infra/` (Terraform)

Los archivos Terraform (`vpc.tf`, `ecs.tf`, `rds.tf`, `elasticache.tf`, `alb.tf`, etc.) **no se eliminan** en este PR. Se documentan como deprecados en `README.md`. El borrado físico se hará manualmente.

---

## Secret nuevo a configurar antes del merge

| Secret | Dónde | Descripción |
|--------|-------|-------------|
| `RAILWAY_PRODUCTION_SERVICE_ID` | GitHub → Settings → Secrets → Repository secrets | ID del servicio Railway de producción |

---

## Checklist de revisión

- [x] `deploy-production.yml` sigue el mismo patrón que `deploy-staging.yml`
- [x] `prisma migrate deploy` ejecuta ANTES del deploy (job `migrate` bloquea `deploy`)
- [x] `environment: production` en jobs `migrate` y `deploy` (activa protection rules)
- [x] Smoke test usa URL de producción (`healthy-api.up.railway.app`)
- [x] `infrastructure/staging.md` no contiene referencias AWS
- [x] `GITHUB_SECRETS.md` distingue claramente Railway (backend) vs AWS (landing)
- [x] `README.md` marca `infra/` como deprecado sin borrar archivos
- [x] Ningún secreto hardcodeado en los workflows
