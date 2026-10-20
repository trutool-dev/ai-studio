# Política de Gestión de Secretos — Healthy Backend

> Aplica a todos los miembros del equipo **y a todos los agentes de IA del ai-studio** con acceso al repositorio, a Railway o a GitHub Secrets.
> Última revisión: 2026-10-19 (SEC-25, SEC-26, SEC-42).

## Secretos del sistema

| Secreto | Descripción | Rotación | Dónde vive |
|---------|-------------|----------|------------|
| `ANTHROPIC_API_KEY` | Acceso a Claude API | 90 días | Railway (staging/producción), GitHub Secrets |
| `JWT_SECRET` | Firma de access tokens (HS256) | 90 días o ante exposición | Railway, GitHub environment secrets |
| `JWT_REFRESH_SECRET` | Reservado (los refresh tokens son opacos) | Igual que `JWT_SECRET` | Railway, GitHub environment secrets |
| `DATABASE_URL` | Conexión PostgreSQL (incluye contraseña) | Ante exposición o anomalía | Railway (variable de referencia del plugin Postgres) |
| `RAILWAY_STAGING_DATABASE_URL` / `RAILWAY_PRODUCTION_DATABASE_URL` | Backups (`db-backup.yml`) | Al rotar la contraseña de la BD | GitHub Secrets |
| `REDIS_URL` | Conexión Redis | Ante exposición o anomalía | Railway |
| `REDIS_ENCRYPTION_KEY` | Cifrado AES-256-GCM de la caché de planes | 180 días | Railway |
| `REDIS_HMAC_SECRET` | HMAC de integridad de la caché | 180 días | Railway |
| `ADMIN_TOKEN` | Acceso a `/health/ai` | 90 días | Railway |
| `SMTP_PASS` | Envío de emails | Según proveedor | Railway |

## Reglas

1. **Los secretos solo viven en Railway, en GitHub Secrets y en el gestor de contraseñas de Antonio.** Nunca en el repositorio.
2. **Nunca se pegan valores de secretos en archivos `.md`** (checklists, guías, informes de PR, auditorías, `GITHUB_SECRETS.md`…): se escribe el nombre de la variable y un placeholder (`<JWT_SECRET>`, `${DATABASE_URL}`, `<generar en Railway>`).
3. **Nunca se guardan secretos ni credenciales en memorias o instrucciones de agentes** (`CLAUDE.md`, `MEMORY.md` y archivos de memoria, `.claude/settings*.json`, prompts, logs de sesión, `ORCHESTRATOR_STATUS.log`). Los agentes que necesiten un valor lo leen de una variable de entorno de la sesión; si un agente encuentra un secreto en un archivo, lo sustituye por un placeholder **sin repetir el valor** (ni en commits, ni en informes) y lo notifica para rotarlo.
4. **Los scripts leen las credenciales del entorno** (`process.env.DATABASE_URL`, `%DATABASE_URL%`) y fallan con un mensaje claro si no existen (ver `check-db.js`, `prisma-migrate*.bat` en la raíz del repo).
5. Los valores de ejemplo de `.env.example`, tests y CI deben ser evidentemente falsos (`test-…`, `your-…`, `localhost`).
6. Un secreto que haya llegado a git **se considera comprometido aunque se borre después**: sigue en el historial. Se rota siempre.

## Generación segura de secretos

```bash
# JWT_SECRET / JWT_REFRESH_SECRET — 512 bits
openssl rand -base64 64

# REDIS_ENCRYPTION_KEY — exactamente 32 bytes (64 caracteres hex)
openssl rand -hex 32

# REDIS_HMAC_SECRET / ADMIN_TOKEN
openssl rand -hex 32
```

Generar el valor en local y pegarlo **directamente** en Railway / GitHub Secrets; no guardarlo en ningún archivo del repo.

## Detección automática

| Capa | Herramienta | Qué detecta |
|------|-------------|-------------|
| Local (pre-commit) | `.husky/pre-commit` | Todas las líneas añadidas de **todos** los archivos staged, incluidos `*.md`, tests y ejemplos: API keys de Anthropic (`sk-ant-`), URLs `postgres://`/`redis://`/`mysql://`/`mongodb://` con contraseña, `JWT_SECRET=`/`JWT_REFRESH_SECRET=` con valor real, valores base64 largos junto a `SECRET`/`TOKEN`/`PASSWORD`/`KEY`, claves privadas PEM y tokens de GitHub (`ghp_`, `github_pat_`). Ignora placeholders (`<…>`, `${…}`, `$VAR`, `***`) y hosts locales. Nunca imprime el valor detectado |
| CI | `.github/workflows/secret-scan.yml` (gitleaks 8.21.2, config `.gitleaks.toml`) | Job **bloqueante** sobre los commits nuevos de cada PR/push; job **informativo** sobre el árbol completo (pasará a bloqueante cuando se cierren SEC-25, SEC-26 y SEC-40). Salida con `--redact` |
| GitHub | Secret scanning + Push protection | 👤 Activar en Settings → Code security (manual, Antonio) |

**Falsos positivos.** Si el hook o gitleaks marcan algo que se ha verificado que no es un secreto, se añade el comentario `gitleaks:allow` en esa línea (lo respetan ambos). Para hallazgos ya conocidos del árbol se puede usar `.gitleaksignore` (fingerprints, sin valores). **Nunca** se usa `git commit --no-verify` ni se amplía la allowlist de `.gitleaks.toml` para ocultar un secreto real.

**Historial.** El historial git contiene secretos expuestos antes de 2026-10-19 (SEC-25/SEC-26). El escaneo de CI no los vuelve a analizar (solo mira commits nuevos); se gestionan **rotándolos** (procedimiento abajo). Reescribir el historial (`git filter-repo`) es una decisión de Antonio y requiere coordinar a todos los clones.

## Rotación ordinaria

1. Generar un valor nuevo con los comandos anteriores.
2. Actualizarlo en Railway → Proyecto → Servicio → Variables (staging y producción por separado, **valores distintos**).
3. Actualizar el GitHub Secret correspondiente si existe.
4. Redeploy del servicio backend y comprobar `GET /health`.
5. Anotar **la fecha** (nunca el valor) en el registro de rotaciones de este documento.

## Procedimiento de rotación por exposición — SEC-25 / SEC-26 (👤 Antonio)

Estado: **pendiente**. Los valores retirados del repo el 2026-10-19 (commit `7cce351`) deben tratarse como comprometidos.

### SEC-25 — `JWT_SECRET` / `JWT_REFRESH_SECRET`
1. Generar 4 valores nuevos (`openssl rand -base64 64`): JWT y refresh para staging y para producción.
2. Railway → staging → backend → Variables: sustituir `JWT_SECRET` y `JWT_REFRESH_SECRET`. Repetir en producción.
3. GitHub → Settings → Environments → `staging` / `production` → actualizar los mismos secretos.
4. Redeploy. Efecto esperado: **todos los access tokens existentes dejan de ser válidos** y los usuarios deben volver a iniciar sesión.
5. Comprobar en Railway que el valor desplegado ya no coincide con ningún valor que haya estado en el repositorio.

### SEC-26 — Credenciales de PostgreSQL (staging y producción)
1. Railway → Postgres (staging) → regenerar la contraseña del usuario de la BD (o `ALTER USER … PASSWORD …` desde la consola de Railway). Repetir en producción si la instancia existe.
2. Verificar que el servicio backend usa la variable de referencia de Railway (`${{Postgres.DATABASE_URL}}`) y se actualiza solo; si no, actualizar `DATABASE_URL` a mano.
3. Actualizar los GitHub Secrets `RAILWAY_STAGING_DATABASE_URL` y `RAILWAY_PRODUCTION_DATABASE_URL`.
4. Desactivar el **TCP Proxy / public networking** de PostgreSQL si no hace falta (o restringirlo); para tareas puntuales usar `railway connect` o la consola de Railway.
5. Revisar los logs de conexión de PostgreSQL en Railway para descartar accesos ajenos y documentar el resultado en `security/INCIDENT_RESPONSE.md`; valorar si procede notificación a la AEPD (Art. 33 RGPD, 72 h).
6. Sacar `.claude/settings.local.json` del índice (SEC-40) y rotar cualquier token que contenga.

### Después de rotar
- Anotar las fechas en el registro de rotaciones.
- Marcar SEC-25/SEC-26 como hechas en `security/SECURITY_TASKS.md` y M-21 en `tasks.md`.
- Quitar `continue-on-error` del job `gitleaks-tree` cuando el árbol quede limpio.

## Registro de rotaciones (solo fechas)

| Fecha | Secreto | Entorno | Motivo | Responsable |
|-------|---------|---------|--------|-------------|
| — | — | — | — | — |

## Acceso mínimo necesario

Solo deben tener acceso a las variables de Railway y a GitHub Secrets quienes lo necesiten activamente. Revisar permisos y colaboradores del repositorio cada 90 días.
