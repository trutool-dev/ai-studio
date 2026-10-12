# Política de Gestión de Secretos — Healthy Backend

> Aplica a todos los miembros del equipo con acceso a Railway o GitHub Secrets.

## Secretos del sistema

| Secreto | Descripción | TTL | Próxima rotación |
|---------|-------------|-----|-----------------|
| `ANTHROPIC_API_KEY` | Acceso a Claude API | 90 días | Ver Railway dashboard |
| `JWT_SECRET` | Firma de tokens JWT | 90 días | Ver Railway dashboard |
| `DATABASE_URL` | Conexión PostgreSQL | Al detectar anomalía | — |
| `REDIS_URL` | Conexión Redis | Al detectar anomalía | — |
| `REDIS_ENCRYPTION_KEY` | Cifrado AES-256 de caché | 180 días | — |
| `REDIS_HMAC_SECRET` | HMAC de integridad de caché | 180 días | — |

## Generación segura de secretos

```bash
# JWT_SECRET — mínimo 256 bits (64 chars hex)
openssl rand -hex 64

# REDIS_ENCRYPTION_KEY — exactamente 32 bytes (64 chars hex)
openssl rand -hex 32

# REDIS_HMAC_SECRET
openssl rand -hex 32
```

## Rotación de secretos

1. Generar nuevo valor con los comandos anteriores
2. Actualizar en Railway dashboard → Project → Variables
3. Hacer redeploy del servicio backend
4. Verificar con `GET /health` que el servicio está operativo
5. Anotar fecha de rotación en este documento

## Acceso mínimo necesario

Solo deben tener acceso a variables de Railway los miembros que lo necesiten activamente.
Revisar permisos cada 90 días.

## Pre-commit hook

El hook `.husky/pre-commit` detecta automáticamente si se intenta commitear:
- Patrones `sk-ant-` (Anthropic API keys)
- Patrones `Bearer ` en archivos que no sean tests
- Archivos `.env` con valores reales

Si el hook detecta un problema, el commit es bloqueado.
