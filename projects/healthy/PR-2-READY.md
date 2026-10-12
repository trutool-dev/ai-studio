# PR-2 — `feat: migración Prisma pendiente` — Informe de preparación

**Fecha de revisión:** 2026-06-15  
**Agente responsable:** database  
**Riesgo:** MEDIO  
**Estado:** ✅ Listo para revisión — no se necesita ejecutar nada antes de aprobar

---

## 1. Estado actual del schema

### `backend/prisma/schema.prisma`

✅ **COMPLETO** — Contiene todos los modelos requeridos por PR-2:

| Elemento | Estado | Línea |
|----------|--------|-------|
| Modelo `TokenUsageLog` | ✅ Presente | L603–620 |
| Relación `User.token_usage_logs` | ✅ Presente | L46 |
| Campo `User.health_consent_given_at DateTime?` | ✅ Presente | L49 |
| Campo `User.health_consent_version String?` | ✅ Presente | L50 |
| Índice `token_usage_logs_user_id_idx` | ✅ En schema | L617 |
| Índice `token_usage_logs_created_at_idx` | ✅ En schema | L618 |
| FK `token_usage_logs.user_id → users.id` con CASCADE DELETE | ✅ Presente | L615 |

### `database/schema.prisma`

✅ **SINCRONIZADO** — Idéntico al `backend/prisma/schema.prisma` en los campos relevantes.

### Conclusión: no se requieren cambios al schema

Ambos campos (`TokenUsageLog` y `health_consent_given_at`) ya existen en el schema.
**No se modificó `schema.prisma`** en esta PR.

---

## 2. Estado de las migraciones

### Migraciones encontradas en `backend/prisma/migrations/`

| Carpeta | Descripción | Estado |
|---------|-------------|--------|
| `20260429210701_init` | Creación inicial de todas las tablas (21 entidades) | ⏳ Generada, **pendiente de aplicar** |
| `20260608184928_add_token_usage_logs_and_health_consent` | Añade `token_usage_logs` + campos RGPD en `users` | ⏳ Generada, **pendiente de aplicar** |

### SQL de la migración pendiente (resumen)

```sql
-- En tabla users: dos nuevas columnas RGPD
ALTER TABLE "users"
  ADD COLUMN "health_consent_given_at" TIMESTAMP(3),
  ADD COLUMN "health_consent_version"  TEXT DEFAULT '1.0';

-- Nueva tabla de auditoría de tokens IA
CREATE TABLE "token_usage_logs" (
    "id"                 TEXT    NOT NULL,
    "user_id"            TEXT    NOT NULL,
    "request_type"       TEXT    NOT NULL,
    "input_tokens"       INTEGER NOT NULL,
    "output_tokens"      INTEGER NOT NULL,
    "cache_read_tokens"  INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "model_version"      TEXT    NOT NULL,
    "cost_usd"           DECIMAL(10,6) NOT NULL,
    "created_at"         TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "token_usage_logs_user_id_idx"    ON "token_usage_logs"("user_id");
CREATE INDEX "token_usage_logs_created_at_idx" ON "token_usage_logs"("created_at");

ALTER TABLE "token_usage_logs"
  ADD CONSTRAINT "token_usage_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### Por qué las migraciones no están aplicadas

Las migraciones requieren una instancia PostgreSQL activa con `DATABASE_URL` configurada.
El entorno de CI/CD local no tiene PostgreSQL corriendo — esto es esperado y está documentado
en `database/MIGRATION_LOG.md`. Los **ficheros SQL ya están generados y versionados** en el
repositorio; solo falta ejecutarlos contra la base de datos.

---

## 3. Cambios realizados en esta PR

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `backend/prisma/schema.prisma` | Sin cambios | Ya contenía los campos requeridos |
| `database/schema.prisma` | Sin cambios | Ya sincronizado |
| `database/MIGRATION_LOG.md` | **Actualizado** | Documenta ambas migraciones pendientes + procedimiento de rollback detallado |
| `database/ERD.md` | **Actualizado** | Añade entidad `TokenUsageLog` al diagrama Mermaid; añade `health_consent_given_at`/`health_consent_version` en `User`; añade relación `User ||--o{ TokenUsageLog`; actualiza tabla de entidades y sección de relaciones 1:N |
| `projects/healthy/PR-2-READY.md` | **Creado** | Este informe |

---

## 4. Comando exacto para ejecutar la migración (post-aprobación)

### Prerequisitos

1. PostgreSQL corriendo (local: Docker; staging/prod: RDS)
2. Archivo `backend/.env` con `DATABASE_URL` válida
3. PR-2 mergeada en `main`

### En entorno de desarrollo / staging

```bash
cd projects/healthy/backend

# Aplica todas las migraciones pendientes sin interacción
npx prisma migrate deploy --schema ../database/schema.prisma

# Verifica que quedaron aplicadas
npx prisma migrate status --schema ../database/schema.prisma

# Regenera el Prisma Client (necesario tras cada migración)
npx prisma generate --schema ../database/schema.prisma

# Opcional: ejecutar seed tras la migración inicial
npx ts-node ../database/seed.ts
```

### En producción (a ejecutar desde el pipeline CI/CD)

```bash
# Solo deploy (no genera cliente interactivo, seguro en CI)
npx prisma migrate deploy --schema ../database/schema.prisma
```

> **Nota:** `migrate deploy` es el comando correcto para producción.
> `migrate dev` está restringido a desarrollo (puede resetear datos).

---

## 5. Plan de rollback paso a paso

### Escenario A — Rollback en desarrollo local

```bash
# Opción 1: Reset completo (destruye todos los datos — solo dev)
cd projects/healthy/backend
npx prisma migrate reset --schema ../database/schema.prisma

# Opción 2: Rollback manual de solo la migración nueva (preserva tabla init)
psql "$DATABASE_URL" <<'SQL'
  DROP TABLE IF EXISTS "token_usage_logs";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "health_consent_given_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "health_consent_version";
  DELETE FROM "_prisma_migrations"
    WHERE migration_name = '20260608184928_add_token_usage_logs_and_health_consent';
SQL
```

### Escenario B — Rollback en staging / producción

1. **Detener el servicio** (ECS task count → 0) para evitar escrituras durante el rollback:
   ```bash
   aws ecs update-service --cluster healthy-staging --service healthy-api --desired-count 0
   ```

2. **Restaurar snapshot RDS pre-deploy** (ARN documentado en `devops/PIPELINE_DRYRUN.md`):
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier healthy-staging-db \
     --target-db-instance-identifier healthy-staging-db-rollback \
     --restore-time <timestamp-pre-deploy>
   ```

3. Si el snapshot no está disponible, ejecutar el **rollback manual** del Escenario A
   usando las credenciales de staging/producción.

4. **Revertir el código** al commit anterior al merge de PR-2:
   ```bash
   git revert <merge-commit-hash>
   git push origin main
   ```

5. **Verificar el estado** de las migraciones:
   ```bash
   npx prisma migrate status --schema ../database/schema.prisma
   # Debe mostrar solo '20260429210701_init' como Applied
   ```

6. **Restaurar el servicio**:
   ```bash
   aws ecs update-service --cluster healthy-staging --service healthy-api --desired-count 2
   ```

7. Ejecutar smoke test: `GET /health` debe devolver `200 {"success": true}`.

---

## 6. Variables de entorno necesarias

Las siguientes variables deben estar configuradas antes de ejecutar la migración.
**No se incluyen valores** — obtenerlos de `devops/ENV_VARS.md` y `devops/GITHUB_SECRETS.md`.

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Cadena de conexión PostgreSQL (formato: `postgresql://user:pass@host:port/dbname`) |
| `DIRECT_URL` | Conexión directa a RDS para migraciones (sin pooler) — requerida en AWS con RDS Proxy |
| `NODE_ENV` | Entorno de ejecución (`development`, `staging`, `production`) |

> **Importante:** en producción con RDS Proxy, Prisma requiere `DIRECT_URL` para las
> migraciones porque el pooler de conexiones no soporta las transacciones largas de DDL.
> Configurar en `schema.prisma` con `directUrl = env("DIRECT_URL")` si aplica.

---

## 7. Criterios de aceptación (checklist de merge gate)

- [ ] `npx prisma migrate status` muestra **ambas** migraciones como `Applied`
- [ ] `npx prisma validate --schema ../database/schema.prisma` sin errores
- [ ] `npx ts-node database/seed.ts` ejecuta sin errores
- [ ] `database/MIGRATION_LOG.md` documenta la migración con procedimiento de rollback ✅ (ya actualizado)
- [ ] `database/ERD.md` incluye `TokenUsageLog` y `health_consent_given_at` en `User` ✅ (ya actualizado)

---

## 8. Dependencias de otras PRs

- **PR-2 no bloquea ni es bloqueada por PR-1 ni PR-3** — pueden ejecutarse en paralelo.
- **PR-5** (pipeline CI/CD) **no puede empezar** hasta que PR-2 esté mergeada — la infra de producción necesita el schema final.
- **PR-6** (go-live) requiere que PR-2 esté aplicada en producción.

---

*Informe generado: 2026-06-15 | Agente: database | PR: PR-2*
