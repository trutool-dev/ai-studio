# Arquitectura de Staging — Healthy API

Entorno de staging en **Railway** — réplica de producción para pruebas antes de cada release.

> **Decisión de infraestructura:** AWS descartado por coste. Toda la infraestructura usa Railway.
> Staging: ~$0/mes en plan gratuito (con límites). Producción: ~$20/mes en plan Pro.

---

## Diagrama de arquitectura

```
                         Internet
                            │
               ┌────────────▼────────────┐
               │  Railway Proxy (HTTPS)   │
               │  healthy-api-staging.    │
               │  up.railway.app          │
               └────────────┬────────────┘
                            │
               ┌────────────▼────────────┐
               │  Railway Service         │
               │  healthy-api (staging)   │
               │  Node.js :3000           │
               │  (Docker o nixpacks)     │
               └────┬──────────────┬─────┘
                    │              │
       ┌────────────▼──┐    ┌──────▼──────────────┐
       │ Railway        │    │ Railway              │
       │ PostgreSQL 16  │    │ Redis 7              │
       │ (plugin)       │    │ (plugin)             │
       └────────────────┘    └─────────────────────┘
```

---

## Servicios Railway

| Servicio | Tipo | URL / endpoint |
|----------|------|----------------|
| healthy-api (staging) | Service (Docker) | `https://healthy-api-staging.up.railway.app` |
| PostgreSQL 16 | Plugin | Inyectado como `DATABASE_URL` |
| Redis 7 | Plugin | Inyectado como `REDIS_URL` |

---

## Variables de entorno en Railway

Railway inyecta automáticamente `DATABASE_URL` y `REDIS_URL` desde los plugins.
El resto de variables se configuran en el Dashboard del servicio:

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `staging` |
| `PORT` | `3000` |
| `DATABASE_URL` | Inyectado por plugin PostgreSQL |
| `REDIS_URL` | Inyectado por plugin Redis |
| `JWT_SECRET` | Secret de firma de access tokens |
| `JWT_REFRESH_SECRET` | Secret de firma de refresh tokens |
| `ANTHROPIC_API_KEY` | API key de Claude |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Puerto SMTP (`587`) |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `EMAIL_FROM` | Remitente de emails |

---

## Sizing y coste estimado

### Staging (Railway plan gratuito / Hobby)

| Recurso | Railway | Coste estimado/mes |
|---------|---------|-------------------|
| Backend service | 512 MB RAM, 0.5 vCPU (shared) | $0–5 |
| PostgreSQL plugin | 1 GB storage | $0 (incluido en plan) |
| Redis plugin | 256 MB RAM | $0 (incluido en plan) |
| **Total staging** | | **~$0–5/mes** |

### Producción (Railway plan Pro)

| Recurso | Railway | Coste estimado/mes |
|---------|---------|-------------------|
| Backend service | 1 GB RAM, 1 vCPU | ~$10 |
| PostgreSQL plugin | 10 GB storage | ~$5 |
| Redis plugin | 512 MB RAM | ~$5 |
| **Total producción** | | **~$20/mes** |

---

## CI/CD — Deploy staging

El pipeline `deploy-staging.yml` se dispara en push a `develop`:

```
push a develop (paths: projects/healthy/backend/**)
  └── test (Jest + cobertura ≥80%)
        └── deploy (railway up --service <STAGING_SERVICE_ID>)
              └── smoke-test (GET /health → 200 OK)
```

El `RAILWAY_SERVICE_ID` del servicio de staging está hardcodeado en el workflow
(valor: `ec2720da-2f41-436c-a5e2-e39f7b7d9a6e`).

---

## Checklist antes del primer deploy a staging

- [ ] Proyecto creado en Railway Dashboard
- [ ] Plugin PostgreSQL 16 añadido al proyecto
- [ ] Plugin Redis 7 añadido al proyecto
- [ ] Variables de entorno de la tabla anterior configuradas en el servicio
- [ ] `RAILWAY_TOKEN` configurado en GitHub Secrets
- [ ] `RAILWAY_PRODUCTION_DATABASE_URL` configurado (para backups con pg_dump)
- [ ] Smoke test verificado: `GET https://healthy-api-staging.up.railway.app/health` → `{ success: true, data: { status: "ok" } }`
