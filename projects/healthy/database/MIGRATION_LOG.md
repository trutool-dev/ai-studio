# Migration Log — Healthy Database

## Estado: Pendiente de ejecución manual

Las migraciones no han sido ejecutadas automáticamente porque requieren
una instancia de PostgreSQL corriendo localmente o en Docker.

---

## Comandos a ejecutar manualmente

### Prerrequisitos

1. Asegúrate de que PostgreSQL está corriendo (ver opciones más abajo).
2. Asegúrate de que el fichero `.env` existe en `projects/healthy/backend/`.
3. El fichero `.env` debe contener `DATABASE_URL` apuntando a la base de datos.

**Ejemplo de DATABASE_URL:**
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/healthy_dev"
```

---

### Opción A: PostgreSQL via Docker (recomendado para desarrollo)

```bash
# Desde la carpeta projects/healthy/
docker-compose up -d db

# O si usas el Dockerfile de database/
cd projects/healthy/database
docker build -t healthy-db .
docker run -d \
  --name healthy-postgres \
  -e POSTGRES_DB=healthy_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  healthy-db
```

---

### Opción B: PostgreSQL nativo

Asegúrate de que el servicio PostgreSQL está activo en el sistema.

---

### Ejecutar la migración inicial

```bash
# Desde projects/healthy/backend/
npx prisma migrate dev --name init
```

Este comando:
1. Lee el schema en `database/schema.prisma` (vía `prisma.schema` en package.json o ruta relativa)
2. Genera la carpeta `migrations/` con el SQL de la migración inicial
3. Aplica la migración a la base de datos
4. Genera el Prisma Client

**Nota:** El schema está en `projects/healthy/database/schema.prisma`.
Si Prisma lo busca en `prisma/schema.prisma`, puedes especificar la ruta:

```bash
npx prisma migrate dev --schema ../database/schema.prisma --name init
```

---

### Ejecutar el seed después de la migración

```bash
# Desde projects/healthy/backend/
npx ts-node ../database/seed.ts

# O si usas ts-node directamente desde la carpeta database/
cd projects/healthy/database
npx ts-node seed.ts
```

---

### Verificar el estado de las migraciones

```bash
# Desde projects/healthy/backend/
npx prisma migrate status --schema ../database/schema.prisma
```

---

### Reset completo (destruye datos — solo desarrollo)

```bash
npx prisma migrate reset --schema ../database/schema.prisma
```

---

## Errores frecuentes y soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `P1001: Can't reach database server` | PostgreSQL no está corriendo | Arrancar Docker o servicio PostgreSQL |
| `P1003: Database does not exist` | Base de datos no creada | Ejecutar `npx prisma db push` primero o crear la BD manualmente |
| `Environment variable not found: DATABASE_URL` | `.env` ausente o mal configurado | Copiar `.env.example` a `.env` y configurar `DATABASE_URL` |
| `Schema file not found` | Ruta incorrecta al schema | Usar `--schema ../database/schema.prisma` |

---

## Historial de migraciones

| Fecha | Versión | Descripción | Estado |
|-------|---------|-------------|--------|
| Pendiente | `20260429210701_init` | Migración inicial — todas las tablas (21 entidades) | No ejecutada |
| Pendiente | `20260608184928_add_token_usage_logs_and_health_consent` | Añade tabla `token_usage_logs` y campos RGPD en `users` | No ejecutada |

---

## Detalle — Migración pendiente

### `20260608184928_add_token_usage_logs_and_health_consent`

**Fecha de creación del fichero:** 2026-06-08  
**Generada por:** agente database (PR-2)  
**Motivo:** requerida por AI-07 (`tokenLogger.ts`) y SEC-04 (RGPD Art. 9)

#### Cambios en base de datos

**ALTER TABLE `users`**
- `health_consent_given_at TIMESTAMP(3)` — fecha/hora en que el usuario dio consentimiento explícito para datos de salud (Art. 9 RGPD)
- `health_consent_version TEXT DEFAULT '1.0'` — versión del texto de consentimiento aceptado

**CREATE TABLE `token_usage_logs`**
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | TEXT PK | UUID v4 |
| `user_id` | TEXT FK | Referencia a `users.id` (CASCADE DELETE) |
| `request_type` | TEXT | Tipo de petición IA (e.g. `plan_generation`) |
| `input_tokens` | INTEGER | Tokens de entrada consumidos |
| `output_tokens` | INTEGER | Tokens de salida generados |
| `cache_read_tokens` | INTEGER DEFAULT 0 | Tokens leídos de caché (ahorro) |
| `cache_write_tokens` | INTEGER DEFAULT 0 | Tokens escritos en caché |
| `model_version` | TEXT | Versión del modelo Claude usada |
| `cost_usd` | DECIMAL(10,6) | Coste estimado en USD |
| `created_at` | TIMESTAMP(3) DEFAULT NOW() | Fecha/hora del log |

**Índices creados:**
- `token_usage_logs_user_id_idx` en `(user_id)`
- `token_usage_logs_created_at_idx` en `(created_at)`

#### Procedimiento de rollback

**En local (desarrollo):**
```bash
# Opción 1: reset completo (destruye datos)
cd projects/healthy/backend
npx prisma migrate reset --schema ../database/schema.prisma

# Opción 2: rollback manual (preserva otras tablas)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS token_usage_logs;"
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN IF EXISTS health_consent_given_at;"
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN IF EXISTS health_consent_version;"
# Luego eliminar la carpeta de migración y actualizar _prisma_migrations
psql $DATABASE_URL -c "DELETE FROM _prisma_migrations WHERE migration_name = '20260608184928_add_token_usage_logs_and_health_consent';"
```

**En producción (staging/prod):**
1. Restaurar snapshot RDS pre-deploy (ARN a documentar en `devops/PIPELINE_DRYRUN.md`)
2. Si el snapshot no está disponible, ejecutar rollback manual arriba con credenciales de producción
3. Hacer rollback del código al commit anterior al merge de PR-2
4. Verificar con `npx prisma migrate status` que la migración ya no aparece como `Applied`

---

## Comando de ejecución (cuando PR-2 sea aprobada)

```bash
# Prerequisito: PostgreSQL corriendo y DATABASE_URL configurada en backend/.env
cd projects/healthy/backend

# Ejecutar ambas migraciones en orden (Prisma las aplica automáticamente)
npx prisma migrate deploy --schema ../database/schema.prisma

# O en desarrollo (también genera client y ejecuta seed opcional)
npx prisma migrate dev --schema ../database/schema.prisma
```

---

## Notas

- El schema está en `projects/healthy/database/schema.prisma` (no en `prisma/`)
- El backend (`projects/healthy/backend/`) tiene Prisma instalado como devDependency
- Los índices (DB-03) y constraints (DB-05) ya están incluidos en el schema
- Una vez aplicada la migración, ejecutar `seed.ts` para poblar datos de prueba
- Los ficheros SQL de migración ya están generados en `backend/prisma/migrations/`; no es necesario ejecutar `migrate dev` para generarlos, solo para aplicarlos

---

*Última actualización: 2026-06-15*
