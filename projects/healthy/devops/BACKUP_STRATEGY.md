# BACKUP_STRATEGY — Estrategia de backups del proyecto Healthy

PostgreSQL corre como plugin de Railway (staging y producción). La estrategia combina los
backups del propio Railway con un `pg_dump` semanal propio guardado fuera de Railway.

---

## Backups de Railway

Railway → proyecto → servicio PostgreSQL → pestaña **Backups**:

- Programar backups automáticos (diarios / semanales) según el plan contratado.
- Lanzar un backup manual antes de cada deploy a producción o migración Prisma.
- Restaurar: seleccionar el backup → **Restore**. Railway restaura sobre el volumen del servicio.

> Comprobar en el dashboard qué frecuencia y retención incluye el plan actual (Hobby).

---

## Job semanal de backup — GitHub Actions

El workflow `devops/.github/workflows/db-backup.yml` ejecuta `pg_dump` cada domingo a las
02:00 UTC (y bajo demanda con `workflow_dispatch`) y sube el dump como artefacto de GitHub
con retención de 30 días.

| Secret de GitHub | Origen |
|------------------|--------|
| `RAILWAY_STAGING_DATABASE_URL` | Railway → PostgreSQL (staging) → Variables → `DATABASE_PUBLIC_URL` |
| `RAILWAY_PRODUCTION_DATABASE_URL` | Ídem en el entorno de producción |

---

## Backup manual antes de un deploy

```bash
# DATABASE_URL = URL pública de Railway (DATABASE_PUBLIC_URL)
pg_dump "$DATABASE_URL" --no-owner --no-acl --format=custom \
  --file="healthy-prod-pre-deploy-$(date +%Y%m%d).dump"
```

---

## Procedimiento de restauración desde un dump

1. **Descargar el dump**: GitHub → Actions → *Weekly DB Backup* → ejecución → artefacto.
2. **Parar escrituras**: Railway → servicio backend → **Settings → Pause** (o escalar a 0 réplicas).
3. **Restaurar**:

   ```bash
   pg_restore --clean --if-exists --no-owner --no-acl \
     --dbname "$DATABASE_URL" healthy-production-backup-XXXX.sql
   ```

4. **Verificar**: reactivar el backend y comprobar `GET /health` (`db: "ok"`) y algunos datos clave.
5. **Migraciones**: `npx prisma migrate status` — si el dump es anterior a una migración, aplicar `npx prisma migrate deploy`.

---

## Verificación mensual del plan de backups

- [ ] La última ejecución de *Weekly DB Backup* terminó en verde y el artefacto existe
- [ ] Railway muestra backups recientes en el servicio PostgreSQL
- [ ] Restauración de prueba en una base de datos temporal cada trimestre
