# Guía de despliegue — Healthy

Guía completa para desplegar la aplicación Healthy en los tres entornos: local (desarrollo), staging y producción.

Para el despliegue específico de la **landing page estática**, consulta [landing-deploy.md](./landing-deploy.md).
Para la arquitectura detallada, consulta [architecture-web.md](./architecture-web.md).

---

## Entorno local (desarrollo)

### Requisitos

| Herramienta | Versión mínima | Verificar con |
|-------------|----------------|---------------|
| Node.js | 18 LTS | `node --version` |
| npm | 9+ | `npm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-server --version` |
| Git | 2.x | `git --version` |

### Paso 1: Variables de entorno

```bash
cp backend/.env.example backend/.env
```

Rellena todas las variables en `backend/.env`. Variables mínimas para desarrollo:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/healthy_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=<cadena aleatoria ≥64 chars — usa: openssl rand -base64 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<cadena aleatoria ≥64 chars — distinta de JWT_SECRET>
JWT_REFRESH_EXPIRES_IN=30d
ANTHROPIC_API_KEY=sk-ant-api03-...
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tudireccion@gmail.com
SMTP_PASS=tu-app-password
EMAIL_FROM=Healthy App <noreply@healthy.app>
```

Ver la referencia completa de variables en `devops/ENV_VARS.md`.

### Paso 2: Base de datos

```bash
# Crear base de datos local
createdb healthy_dev

# Ejecutar migraciones desde la carpeta backend
cd backend
npx prisma migrate dev

# (Opcional) Abrir el explorador visual de la BD
npx prisma studio
```

> **Nota Prisma 7:** Este proyecto usa Prisma 7 con `prisma-client-js`. La URL de conexión se configura en `prisma.config.ts` (no en el schema). Asegúrate de que `DATABASE_URL` esté en tu `.env` antes de ejecutar migraciones.

### Paso 3: Redis

```bash
# macOS (Homebrew)
brew services start redis

# Linux (systemd)
sudo systemctl start redis

# Verificar que Redis responde
redis-cli ping   # debe responder: PONG
```

### Paso 4: Datos de prueba (opcional)

```bash
npx ts-node ../database/seed.ts
# Carga: 10 usuarios, 20 ejercicios, 200 alimentos, 5 planes de ejemplo
```

### Paso 5: Arrancar el servidor

```bash
npm run dev
# Servidor arranca en http://localhost:3000
# Verificar: GET http://localhost:3000/health
```

### Alternativa: Docker Compose

```bash
# Levanta PostgreSQL + Redis + backend en un solo comando
docker-compose up -d

# Apagar
docker-compose down
```

El `docker-compose.yml` está en `projects/healthy/devops/docker-compose.yml`.

---

## Staging

Staging refleja producción sobre Railway (backend + PostgreSQL + Redis gestionados). Los deploys se disparan automáticamente desde la rama `develop`.

### Prerrequisitos

- Acceso al repositorio en GitHub (rol collaborator o superior)
- Secretos de GitHub configurados (ver `devops/GITHUB_SECRETS.md`)
- Entorno `staging` creado en **Settings → Environments** del repositorio

### Secretos de GitHub requeridos (entorno staging)

| Secret | Descripción |
|--------|-------------|
| `RAILWAY_TOKEN` | Token de autenticación de Railway CLI |
| `JWT_SECRET` | Clave de firma de access tokens (staging) |
| `JWT_REFRESH_SECRET` | Clave de firma de refresh tokens (staging) |
| `SUPABASE_URL` | URL del proyecto Supabase de staging |
| `SUPABASE_KEY` | Clave anon de Supabase (staging) — `process.env.SUPABASE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio Supabase (operaciones privilegiadas) |
| `SMTP_USER` | Usuario SMTP para emails de verificación (`trutool@gmail.com`) *(pendiente en staging)* |
| `SMTP_PASS` | Contraseña de aplicación Gmail *(pendiente en staging)* |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `AWS_ACCESS_KEY_ID` | Credencial AWS (solo para deploy de la landing) |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS (solo para deploy de la landing) |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID CloudFront (solo para deploy de la landing) |

### Deploy automático (push a `develop`)

```bash
git push origin develop
# GitHub Actions dispara automáticamente el workflow deploy.yml:
#   1. test      → npm test --coverage (cobertura ≥ 80 %)
#   2. deploy    → railway up (ejecutado desde la raíz del repositorio)
#                  El CLI sube el repositorio completo; Railway navega a
#                  projects/healthy/backend según la configuración del servicio.
#   3. smoke-test → GET /health con 3 reintentos (espera 30 s entre intentos)
```

### Deploy manual

```bash
# Re-run del job en GitHub Actions:
# GitHub.com → repositorio → Actions → Deploy → Re-run jobs

# O desde CLI local (requiere RAILWAY_TOKEN):
railway up --service backend --environment staging
```

### URL de verificación

```
https://backend-staging-01ee.up.railway.app/health
# Respuesta esperada:
# { "success": true, "data": { "status": "ok", "db": "connected", "redis": "connected" } }
```

### Ver logs de staging

```bash
# Desde Railway CLI
railway logs --service backend --environment staging

# Filtrar por nivel de error
railway logs --service backend --environment staging | grep ERROR
```

### Conectarse a la base de datos de staging

Staging usa Railway PostgreSQL. Desde el dashboard de Railway:

1. Ir al servicio PostgreSQL → pestaña **Connect**
2. Copiar la `DATABASE_URL` de staging
3. `psql "postgresql://...railway.app:PORT/railway"` (con la CLI de Railway o un cliente como TablePlus)

---

## Producción

Producción corre en Railway (servicio `ai-studio`, proyecto `healthy-staging`). El deploy es automático al hacer push a `main` vía GitHub Actions.

- **Service ID:** `ec2720da-2f41-436c-a5e2-e39f7b7d9a6e`
- **Dominio:** `https://ai-studio-production-1835.up.railway.app`
- **Builder:** Dockerfile multi-stage (root: `projects/healthy/backend`)
- **BD / Redis:** servicios gestionados Railway (`${{Postgres.DATABASE_URL}}` / `${{Redis.REDIS_URL}}`)

### Prerrequisitos

- Secretos del entorno `production` configurados en GitHub
- Los valores de `JWT_SECRET`, `JWT_REFRESH_SECRET` y `SUPABASE_*` deben ser **distintos** de los de staging
- Si el deploy incluye migraciones, ejecutarlas antes (ver sección Migraciones)

### Secretos de GitHub requeridos (entorno production)

Los mismos que staging (excepto las claves AWS de landing, que se gestionan por separado):

| Secret | Descripción |
|--------|-------------|
| `RAILWAY_TOKEN` | Token de autenticación de Railway CLI |
| `JWT_SECRET` | Clave de firma de access tokens (producción) |
| `JWT_REFRESH_SECRET` | Clave de firma de refresh tokens (producción) |
| `SUPABASE_URL` | URL del proyecto Supabase de producción |
| `SUPABASE_KEY` | Clave anon de Supabase (producción) — `process.env.SUPABASE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio Supabase (operaciones privilegiadas) |
| `SMTP_USER` | `trutool@gmail.com` |
| `SMTP_PASS` | Contraseña de aplicación Gmail |
| `ANTHROPIC_API_KEY` | API key de Anthropic |

### Proceso de deploy a producción

```
1. Abrir Pull Request de develop → main
2. Code review + merge
3. GitHub Actions dispara el workflow deploy.yml:
   a. test      → npm test --coverage (cobertura ≥ 80 %)
   b. deploy    → railway up --service ai-studio (Dockerfile multi-stage build en Railway)
   c. smoke-test → GET /health con 3 reintentos (espera 30 s entre intentos)
4. Verificar en https://ai-studio-production-1835.up.railway.app/health
```

### Checklist pre-deploy a producción

- [ ] `npm test` pasa en la rama con cobertura ≥ 80 %
- [ ] `GET /health` en staging devuelve `{ "db": "connected", "redis": "connected" }`
- [ ] Si hay migraciones de BD: probar `prisma migrate deploy` en staging primero
- [ ] Revisar `security/VULNERABILITIES.md` — sin hallazgos CRITICAL o HIGH abiertos

### Migraciones de base de datos en producción

Las migraciones se ejecutan **antes** del deploy. Railway expone la `DATABASE_URL` de producción en el dashboard:

```bash
# 1. Copiar DATABASE_URL de producción desde Railway:
#    Dashboard → proyecto healthy-staging → servicio Postgres → Connect

# 2. Ejecutar migraciones apuntando a producción:
DATABASE_URL="postgresql://...railway.app:PORT/railway" \
  npx prisma migrate deploy --schema=../database/schema.prisma

# 3. Verificar estado:
npx prisma migrate status
# Todas las migraciones deben aparecer como "Applied"
```

También se puede añadir este paso al propio workflow de deploy.yml antes de `railway up`.

### Rollback en Railway

```bash
# Desde el dashboard de Railway:
# Dashboard → proyecto healthy-staging → servicio ai-studio → Deployments
# Seleccionar un deploy anterior → "Redeploy"

# O desde CLI:
railway redeploy --service ai-studio --deployment <DEPLOYMENT_ID>
```

### Ver logs en producción

```bash
# Desde Railway CLI
railway logs --service ai-studio

# Filtrar errores
railway logs --service ai-studio | grep ERROR
```

---

## Variables de entorno por entorno

| Variable | Local | Staging (Railway) | Producción (Railway) |
|----------|-------|-------------------|----------------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `PORT` | `3000` | `3000` | `3000` |
| `DATABASE_URL` | localhost PostgreSQL | URL directa Railway Postgres | URL directa Railway Postgres |
| `REDIS_URL` | localhost Redis | URL directa Railway Redis | URL directa Railway Redis |
| `JWT_SECRET` | Valor local | Secret GitHub (staging) | Secret GitHub (production) |
| `JWT_REFRESH_SECRET` | Valor local | Secret GitHub (staging) | Secret GitHub (production) |
| `JWT_EXPIRES_IN` | `15m` | `15m` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | `30d` | `30d` |
| `ANTHROPIC_API_KEY` | Tu key personal | Secret GitHub | Secret GitHub |
| `SUPABASE_URL` | Proyecto Supabase dev | Proyecto Supabase staging | Proyecto Supabase prod |
| `SUPABASE_KEY` | Clave anon dev | Secret GitHub (staging) | Secret GitHub (production) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave servicio dev | Secret GitHub (staging) | Secret GitHub (production) |
| `SMTP_HOST` | `smtp.gmail.com` | *(pendiente)* | `smtp.gmail.com` |
| `SMTP_PORT` | `587` | *(pendiente)* | `587` |
| `SMTP_USER` | tu cuenta Gmail | *(pendiente)* | `trutool@gmail.com` |
| `SMTP_PASS` | contraseña app Gmail | *(pendiente)* | Secret GitHub (production) |
| `FRONTEND_URL` | `http://localhost:3000` | URL staging frontend | URL producción frontend |

> **Nota sobre DATABASE_URL y REDIS_URL en Railway:** Deben configurarse con la URL directa del servicio. Las referencias de template (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`) solo funcionan si Railway las resuelve automáticamente en el entorno. Si no resuelven, usar la URL directa obtenida desde el dashboard del servicio correspondiente.

---

## Migraciones de base de datos

### En local (desarrollo)

```bash
# Crear nueva migración (genera archivo en database/migrations/)
npx prisma migrate dev --name descripcion-del-cambio

# Ver historial de migraciones
npx prisma migrate status

# Revertir todas las migraciones y recrear la BD (destructivo — solo en local)
npx prisma migrate reset
```

### En staging / producción

```bash
# Aplicar migraciones pendientes (NO crea nuevas, NO borra datos)
# Ejecutar con la DATABASE_URL del entorno destino (obtenida desde Railway dashboard)
DATABASE_URL="postgresql://...railway.app:PORT/railway" \
  npx prisma migrate deploy --schema=../database/schema.prisma

# Verificar estado tras el deploy
npx prisma migrate status
```

> En producción, `prisma migrate deploy` debe ejecutarse **antes** de lanzar `railway up`. Si la migración falla, abortar el deploy. Railway mantiene el último deploy activo hasta que el nuevo supere el health check.

---

## App móvil (Expo EAS)

### Preview build (para testing interno)

```bash
# Instalar EAS CLI
npm install -g eas-cli
eas login

# Build para ambas plataformas (distribución por QR / link directo)
cd frontend
eas build --profile preview --platform all
```

### Production build + submit

```bash
# Build de producción
eas build --profile production --platform all

# Subir a App Store y Google Play
eas submit --platform ios
eas submit --platform android
```

El proceso completo también se puede disparar creando un tag `v*.*.*` en el repositorio, que activa el workflow `eas-submit.yml`. Ver `devops/EAS_SUBMIT.md` para los requisitos de credenciales Apple/Google.

---

> Última actualización: 2026-07-07 — Docs Agent
