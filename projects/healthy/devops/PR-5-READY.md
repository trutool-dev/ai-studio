# PR-5 — Corrección de inconsistencias Railway / Infraestructura

**Fecha:** 2026-06-15
**Agente:** devops
**Plataforma:** toda la infraestructura va a Railway.

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

Reescrito completamente para Railway:

- Diagrama de arquitectura Railway (Service → PostgreSQL plugin + Redis plugin)
- Tabla de servicios Railway con URLs
- Variables de entorno que Railway inyecta automáticamente
- Tabla de sizing y coste real (~$0–5/mes staging, ~$20/mes producción)
- Checklist de primer deploy a staging

### 3. Actualizado: `GITHUB_SECRETS.md`

- **Eliminado:** secretos de la plataforma cloud anterior
- **Añadido:** `RAILWAY_PRODUCTION_SERVICE_ID` como nuevo secret de repositorio requerido
- **Actualizado:** tabla de resumen "qué configurar ahora" incluye `RAILWAY_PRODUCTION_SERVICE_ID`

### 4. Actualizado: `README.md`

- Tabla de entornos actualizada: staging y producción apuntan a Railway
- Nota de decisión de infraestructura añadida
- Diagrama de arquitectura Railway
- Tabla de servicios Railway
- Secrets y variables de entorno actualizados a Railway

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
- [x] `infrastructure/staging.md` y `GITHUB_SECRETS.md` documentan solo Railway
- [x] Ningún secreto hardcodeado en los workflows
