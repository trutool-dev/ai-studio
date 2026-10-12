# Infraestructura — Healthy App

## Entornos

| Entorno     | Rama      | Infraestructura               |
|-------------|-----------|-------------------------------|
| development | cualquiera| Docker Compose local          |
| staging     | develop   | Railway (backend + PG + Redis)|
| production  | main      | Railway (backend + PG + Redis)|

> **Decisión de infraestructura:** AWS descartado por coste. Toda la infraestructura de backend usa Railway (~$20/mes en producción frente a ~$188/mes en AWS).
> La landing page sigue usando AWS S3 + CloudFront (coste mínimo, sin cambios).

---

## Desarrollo local

### Requisitos previos
- Docker Desktop ≥ 4.x
- Copiar `.env.example` → `.env` en la raíz del proyecto y rellenar los valores

### Arrancar el stack completo

```bash
# Desde la raíz del proyecto
cp .env.example .env

docker compose -f devops/docker-compose.yml up -d
```

El backend queda disponible en `http://localhost:3000`.  
Health check: `GET http://localhost:3000/health`

### Comandos útiles

```bash
# Ver logs del backend en tiempo real
docker compose -f devops/docker-compose.yml logs -f backend

# Reiniciar solo el backend
docker compose -f devops/docker-compose.yml restart backend

# Parar todo y eliminar volúmenes (reset completo)
docker compose -f devops/docker-compose.yml down -v

# Acceder a psql dentro del contenedor
docker exec -it healthy-postgres psql -U healthy -d healthy_db
```

---

## ⚠️ Archivos Terraform deprecados

Los archivos en `infra/` (vpc.tf, ecs.tf, rds.tf, elasticache.tf, alb.tf, etc.) están **deprecados**
y no se deben usar. Railway fue elegido como plataforma de despliegue por razones de coste.
El borrado físico de estos archivos se hará manualmente cuando se confirme que no se necesitan como referencia.

---

## Arquitectura Railway (activa)

```
Internet
   │
   ▼
Railway Proxy (HTTPS automático)
   │
   ▼
Railway Service — healthy-backend (Node.js)
   ├── Railway PostgreSQL 16 (plugin)
   └── Railway Redis 7 (plugin)

Landing page
   └── AWS CloudFront CDN
          └── AWS S3 — archivos estáticos
```

### Servicios utilizados

| Servicio | Proveedor | Uso |
|----------|-----------|-----|
| Railway Service | Railway | Backend Node.js (staging y producción) |
| PostgreSQL 16 plugin | Railway | Base de datos principal |
| Redis 7 plugin | Railway | Caché y sesiones |
| S3 + CloudFront | AWS | Landing page estática únicamente |

---

## CI/CD — GitHub Actions

### Pipeline CI (`ci.yml`)

Se ejecuta en cada Pull Request hacia `main` o `develop`.

```
PR abierto
  ├── backend: lint + tests + cobertura (con Postgres y Redis reales)
  ├── docker-build: verifica que la imagen construye correctamente
  └── ai: lint + tests del módulo IA
```

El PR no puede mergearse si algún job falla.

### Pipeline Deploy (`deploy.yml`)

Se ejecuta al hacer push a `main` o `develop`.

```
Push a develop
  └── build-push (ECR) → deploy-staging (ECS staging, automático)

Push a main
  └── build-push (ECR) → deploy-production (ECS production, requiere aprobación)
```

El deploy a producción usa un **GitHub Environment** con protección de rama:
un revisor debe aprobar manualmente antes de que el job ejecute.

---

## Secrets de GitHub requeridos

Ver `GITHUB_SECRETS.md` para la guía completa. Resumen de los más importantes:

| Secret | Descripción |
|--------|-------------|
| `RAILWAY_TOKEN` | Token Railway CLI (staging y producción) |
| `RAILWAY_PRODUCTION_SERVICE_ID` | ID del servicio Railway de producción |
| `RAILWAY_PRODUCTION_DATABASE_URL` | URL de PostgreSQL de producción (para backups) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Solo para la landing (S3 + CloudFront) |

Los secretos de aplicación (Supabase, Anthropic, JWT, SMTP, etc.) se configuran
directamente en el panel de Railway como variables de entorno del servicio,
y también en los GitHub Environments (`staging` / `production`) para que el pipeline
de migraciones pueda acceder a `DATABASE_URL`.

---

## Dockerfiles

### `backend/Dockerfile`
- Build multi-stage: instala dependencias en una etapa separada
- Imagen final basada en `node:20-alpine` (~180 MB)
- Ejecuta como usuario sin privilegios (`appuser`)
- `dumb-init` como PID 1 para manejo correcto de señales
- Health check integrado vía `/health`

### `database/Dockerfile`
- Extiende `postgres:16-alpine`
- Copia scripts de `database/init/` para inicialización automática
- Solo usado en desarrollo local; en staging/producción se usa el plugin PostgreSQL de Railway directamente

---

## Variables de entorno

Ver `.env.example` en la raíz del proyecto para la lista completa.  
En staging y producción las variables sensibles se configuran en el panel de Railway
(Settings → Variables del servicio) y en los GitHub Environments para el pipeline de migraciones.
