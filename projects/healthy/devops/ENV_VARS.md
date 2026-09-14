# ENV_VARS — Variables de entorno del proyecto Healthy

Todas las variables necesarias para ejecutar el backend de Healthy.
**Nunca** commitar valores reales en el repositorio — usar `.env` local o secretos de GitHub Actions.

---

## App / Servidor

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `NODE_ENV` | Entorno de ejecución | `development` / `staging` / `production` | Establecer manualmente según el entorno |
| `PORT` | Puerto en el que escucha el servidor Express | `3000` | Libre elección; 3000 es el default |

---

## Database (PostgreSQL)

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `DATABASE_URL` | Connection string completa de PostgreSQL | `postgresql://user:pass@host:5432/healthy` | RDS → instancia → endpoint; local: docker-compose |
| `DATABASE_POOL_MIN` | Conexiones mínimas en el pool de Prisma | `2` | Ajustar según carga esperada |
| `DATABASE_POOL_MAX` | Conexiones máximas en el pool de Prisma | `10` | Ajustar según tipo de instancia RDS |

---

## Redis

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `REDIS_URL` | Connection string de Redis/ElastiCache | `redis://host:6379` / `rediss://host:6380` | ElastiCache → cluster → Primary endpoint; local: docker-compose |
| `REDIS_PASSWORD` | Contraseña de autenticación Redis | `str-aleatoria-32-chars` | ElastiCache → Auth token; local: `healthy_redis_pass` |
| `REDIS_TLS` | Activar TLS para conexiones a ElastiCache en AWS | `true` / `false` | `true` en staging/production, `false` en development |

---

## Auth (JWT)

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `JWT_SECRET` | Clave secreta para firmar access tokens JWT | Cadena ≥ 64 chars aleatoria | `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` | Tiempo de expiración del access token | `15m` | Fixed; no cambiar sin revisar seguridad |
| `JWT_REFRESH_SECRET` | Clave secreta para firmar refresh tokens (distinta de JWT_SECRET) | Cadena ≥ 64 chars aleatoria | `openssl rand -base64 64` |
| `JWT_REFRESH_EXPIRES_IN` | Tiempo de expiración del refresh token | `30d` | Fixed; se puede extender a 60d si el producto lo requiere |

---

## Anthropic AI

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `ANTHROPIC_API_KEY` | API key de Anthropic para llamadas a Claude | `sk-ant-api03-...` | console.anthropic.com → API Keys → Create Key |
| `ANTHROPIC_MODEL` | Modelo Claude a usar | `claude-sonnet-4-6` | Documentación Anthropic — actualizar al publicar nuevas versiones |

---

## Email (SMTP)

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `SMTP_HOST` | Servidor SMTP para envío de emails | `smtp.mailgun.org` / `smtp.gmail.com` | Cuenta Mailgun / Gmail → credenciales SMTP |
| `SMTP_PORT` | Puerto SMTP | `587` (STARTTLS) / `465` (SSL) | Depende del proveedor; 587 recomendado |
| `SMTP_USER` | Usuario o dirección de autenticación SMTP | `postmaster@mg.healthy.app` | Panel de Mailgun / cuenta Gmail |
| `SMTP_PASS` | Contraseña de autenticación SMTP | `password-o-app-password` | Mailgun → SMTP credentials; Gmail → App passwords |
| `EMAIL_FROM` | Nombre y dirección remitente en los emails | `Healthy App <noreply@healthy.app>` | Libre elección; debe coincidir con el dominio verificado |

---

## AWS

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `AWS_REGION` | Región AWS donde están los recursos | `eu-west-1` | Fixed para RGPD (datos en Europa) |
| `AWS_ACCESS_KEY_ID` | ID de la access key de IAM | `AKIAIOSFODNN7EXAMPLE` | AWS Console → IAM → Users → Security credentials → Create access key |
| `AWS_SECRET_ACCESS_KEY` | Clave secreta de la access key de IAM | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` | Se obtiene una única vez al crear la access key — guardar inmediatamente |
| `AWS_S3_BUCKET_PROGRESS` | Nombre del bucket S3 para fotos de progreso | `healthy-progress-photos-prod` | Crear manualmente o via Terraform |

---

## Frontend / App

| Variable | Descripción | Ejemplo/Formato | Cómo obtener |
|----------|-------------|-----------------|--------------|
| `FRONTEND_URL` | URL del frontend — usada en redirects y CORS | `https://healthy.app` (prod) / `http://localhost:8081` (dev) | La URL real del frontend desplegado |
| `API_URL` | URL base de la API backend — usada desde la app móvil | `https://api.healthy.app` (prod) / `https://api-staging.healthy.app` (staging) | La URL del ALB o dominio configurado |

---

## Notas importantes

1. **Desarrollo local**: copiar `.env.example` a `.env` y rellenar los valores.
2. **Staging / Producción**: los valores se inyectan como secretos de GitHub Actions — ver `GITHUB_SECRETS.md`.
3. **Nunca** añadir `.env` al repositorio. El archivo ya está en `.gitignore`.
4. `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser **distintos** y regenerarse si se sospecha de comprometimiento.
5. `JWT_SECRET` y `JWT_REFRESH_SECRET` deben regenerarse si se sospecha de comprometimiento.
