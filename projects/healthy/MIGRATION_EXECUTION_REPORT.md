# Informe de ejecución — Migración Prisma PR-2

**Fecha:** 2026-06-15  
**Ejecutado por:** agente database (Cowork)  
**Estado final:** ⏳ PENDIENTE DE BD REAL

---

## Resultado del intento de ejecución

### Comando ejecutado
```bash
cd projects/healthy/backend
npx prisma migrate deploy --schema ../database/schema.prisma
```

### Error obtenido
```
Error: Failed to fetch sha256 checksum at
  https://binaries.prisma.sh/.../schema-engine.gz.sha256 - 403 Forbidden
```

### Causa raíz
El sandbox de ejecución **no tiene acceso de red a `binaries.prisma.sh`** (restricción de red, no de PostgreSQL). Prisma 7.8.0 necesita descargar el binario `schema-engine` en el primer uso. En el entorno de desarrollo real del usuario (Windows/WSL con acceso a internet), este paso ocurre automáticamente.

> **No es un error de schema ni de migraciones.** Es una restricción del entorno de ejecución aislado.

---

## Verificación de artefactos (todo OK ✅)

### Archivos de migración SQL presentes
```
backend/prisma/migrations/
├── 20260429210701_init/
│   └── migration.sql          ✅ presente
├── 20260608184928_add_token_usage_logs_and_health_consent/
│   └── migration.sql          ✅ presente
└── migration_lock.toml        ✅ presente
```

### Contenido de la migración pendiente — verificado ✅
```sql
-- Nuevos campos RGPD en tabla users
ALTER TABLE "users"
  ADD COLUMN "health_consent_given_at" TIMESTAMP(3),
  ADD COLUMN "health_consent_version"  TEXT DEFAULT '1.0';

-- Nueva tabla de auditoría de tokens IA
CREATE TABLE "token_usage_logs" (
    "id"                 TEXT         NOT NULL,
    "user_id"            TEXT         NOT NULL,
    "request_type"       TEXT         NOT NULL,
    "input_tokens"       INTEGER      NOT NULL,
    "output_tokens"      INTEGER      NOT NULL,
    "cache_read_tokens"  INTEGER      NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER      NOT NULL DEFAULT 0,
    "model_version"      TEXT         NOT NULL,
    "cost_usd"           DECIMAL(10,6) NOT NULL,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "token_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "token_usage_logs_user_id_idx" ON "token_usage_logs"("user_id");
CREATE INDEX "token_usage_logs_created_at_idx" ON "token_usage_logs"("created_at");

ALTER TABLE "token_usage_logs"
  ADD CONSTRAINT "token_usage_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

### Variables de entorno en `.env` — verificadas ✅
```
DATABASE_URL=postgresql://healthy:healthy_pass@localhost:5432/healthy_db
NODE_ENV=development
```
`DIRECT_URL` no está definida (requerida solo en producción con RDS Proxy).

### Versión de Prisma — verificada ✅
```
prisma@7.8.0
```

---

## Pasos exactos para ejecutar en tu máquina

### Prerequisito: PostgreSQL corriendo

**Opción A — Docker (recomendado para desarrollo local):**
```bash
docker run -d \
  --name healthy-postgres \
  -e POSTGRES_USER=healthy \
  -e POSTGRES_PASSWORD=healthy_pass \
  -e POSTGRES_DB=healthy_db \
  -p 5432:5432 \
  postgres:16
```

**Opción B — PostgreSQL nativo ya instalado:**
```bash
createdb -U postgres healthy_db
psql -U postgres -c "CREATE USER healthy WITH PASSWORD 'healthy_pass';"
psql -U postgres -c "GRANT ALL ON DATABASE healthy_db TO healthy;"
```

### Ejecutar la migración (desde tu terminal)
```bash
cd C:\Users\Antonio\Documents\ai-studio\projects\healthy\backend

# Aplica ambas migraciones pendientes
npx prisma migrate deploy --schema ../database/schema.prisma

# Verifica que quedaron aplicadas (debe mostrar ambas como "Applied")
npx prisma migrate status --schema ../database/schema.prisma

# Regenera el Prisma Client
npx prisma generate --schema ../database/schema.prisma
```

### Resultado esperado tras éxito
```
Prisma Migrate applied the following migration(s):

  20260429210701_init
  20260608184928_add_token_usage_logs_and_health_consent
```

---

## Variables de entorno para producción (RDS / AWS)

| Variable | Descripción | Requerida en |
|----------|-------------|-------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` | Dev + Staging + Prod |
| `DIRECT_URL` | Conexión directa sin pooler (para DDL) | Solo prod con RDS Proxy |
| `NODE_ENV` | `production` | Prod |

En producción, agregar al `schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Resumen

| Check | Estado |
|-------|--------|
| Archivos SQL de migración existen | ✅ |
| SQL de migración es correcto | ✅ |
| Schema Prisma tiene todos los modelos | ✅ |
| `.env` tiene `DATABASE_URL` configurado | ✅ (apunta a localhost) |
| Migración aplicada en BD real | ⏳ Pendiente — requiere PostgreSQL activo |

---

*Informe generado: 2026-06-15 | Agente: database | PR: PR-2*
