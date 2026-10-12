# BACKUP_STRATEGY — Estrategia de backups del proyecto Healthy

---

## RDS — Backups automáticos

### Configuración

Los backups automáticos están configurados en Terraform (`infra/rds.tf`):

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| `backup_retention_period` | 7 días | Backups diarios guardados durante 7 días |
| `backup_window` | `03:00-04:00 UTC` | Ventana de mínimo tráfico en Europa |
| `maintenance_window` | `Mon:04:30-Mon:05:30 UTC` | Mantenimiento semanal post-backup |

### Point-in-time Recovery (PITR)

AWS RDS permite restaurar a cualquier segundo dentro de la ventana de retención (7 días):

```bash
# Restaurar a un momento concreto (producción)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier healthy-production \
  --target-db-instance-identifier healthy-production-restored-$(date +%Y%m%d%H%M) \
  --restore-time "2026-06-07T14:30:00Z" \
  --db-instance-class db.t3.small \
  --multi-az \
  --region eu-west-1
```

---

## Snapshots manuales antes de cada deploy

### Ejecutar snapshot antes de un deploy a producción

```bash
aws rds create-db-snapshot \
  --db-instance-identifier healthy-prod \
  --db-snapshot-identifier "healthy-prod-pre-deploy-$(date +%Y%m%d)" \
  --region eu-west-1
```

### Verificar que el snapshot se creó correctamente

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier healthy-prod \
  --query 'DBSnapshots[*].{ID:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}' \
  --output table \
  --region eu-west-1
```

### Listar todos los snapshots disponibles

```bash
aws rds describe-db-snapshots \
  --db-instance-identifier healthy-prod \
  --snapshot-type manual \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[*].{ID:DBSnapshotIdentifier,Status:Status,Size:AllocatedStorage,Created:SnapshotCreateTime}' \
  --output table \
  --region eu-west-1
```

---

## Procedimiento de restauración paso a paso

Seguir este procedimiento en caso de pérdida de datos o corrupción:

### Paso 1 — Identificar el snapshot a restaurar

```bash
# Listar snapshots disponibles (manuales + automáticos)
aws rds describe-db-snapshots \
  --db-instance-identifier healthy-prod \
  --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-10:].{ID:DBSnapshotIdentifier,Status:Status,Created:SnapshotCreateTime}' \
  --output table \
  --region eu-west-1
```

Seleccionar el snapshot más reciente anterior al incidente o usar PITR para precisión al segundo.

### Paso 2 — Crear nueva instancia RDS desde el snapshot

```bash
# Restaurar desde snapshot manual
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "healthy-prod-restored-$(date +%Y%m%d%H%M)" \
  --db-snapshot-identifier "healthy-prod-pre-deploy-20260608" \
  --db-instance-class db.t3.small \
  --multi-az \
  --vpc-security-group-ids sg-XXXXXXXX \
  --db-subnet-group-name healthy-production-rds-subnet-group \
  --no-publicly-accessible \
  --region eu-west-1

# Esperar a que la instancia esté disponible (puede tardar 10-20 min)
aws rds wait db-instance-available \
  --db-instance-identifier "healthy-prod-restored-$(date +%Y%m%d%H%M)" \
  --region eu-west-1
```

### Paso 3 — Actualizar DATABASE_URL en AWS Secrets Manager

Una vez la nueva instancia esté disponible:

```bash
# Obtener el endpoint de la nueva instancia
NEW_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "healthy-prod-restored-$(date +%Y%m%d%H%M)" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text \
  --region eu-west-1)

echo "Nuevo endpoint: $NEW_ENDPOINT"

# Actualizar el secreto en Secrets Manager
aws secretsmanager update-secret \
  --secret-id "healthy/production/DATABASE_URL" \
  --secret-string "postgresql://healthy_admin:PASS@${NEW_ENDPOINT}:5432/healthy" \
  --region eu-west-1
```

### Paso 4 — Verificar conectividad y datos

```bash
# Forzar nuevo despliegue de ECS para que tome la nueva DATABASE_URL
aws ecs update-service \
  --cluster healthy-production \
  --service healthy-api \
  --force-new-deployment \
  --region eu-west-1

# Esperar a que el servicio esté estable
aws ecs wait services-stable \
  --cluster healthy-production \
  --services healthy-api \
  --region eu-west-1

# Verificar health check de la API
curl -s https://api.healthy.app/health | python3 -m json.tool
```

### Paso 5 — Eliminar la instancia antigua (tras confirmar que todo funciona)

```bash
# Solo ejecutar tras confirmar que la restauración fue exitosa
# Crear snapshot final de la instancia dañada antes de eliminarla
aws rds create-db-snapshot \
  --db-instance-identifier healthy-prod \
  --db-snapshot-identifier "healthy-prod-damaged-$(date +%Y%m%d)" \
  --region eu-west-1

# Eliminar la instancia dañada (si ya no se necesita)
aws rds delete-db-instance \
  --db-instance-identifier healthy-prod \
  --skip-final-snapshot \
  --region eu-west-1
```

---

## Job semanal de backup — GitHub Actions

El workflow `db-backup.yml` crea un snapshot manual cada domingo a las 02:00 UTC y verifica que se creó correctamente.

**Archivo:** `devops/.github/workflows/db-backup.yml`

Ver el workflow completo en la sección de workflows del repositorio.

---

## Retención y costes de snapshots

| Tipo | Retención | Coste |
|------|-----------|-------|
| Backups automáticos | 7 días (configurable) | Incluido en el tamaño de la instancia |
| Snapshots manuales | Indefinida (hasta borrar) | ~$0.095/GB/mes en eu-west-1 |
| Snapshot pre-deploy | Mantener 30 días, luego eliminar | Para 20 GB: ~$1.90/mes |

### Política de limpieza de snapshots manuales

```bash
# Listar snapshots manuales con más de 30 días
aws rds describe-db-snapshots \
  --db-instance-identifier healthy-prod \
  --snapshot-type manual \
  --query 'DBSnapshots[?SnapshotCreateTime<=`2026-05-09`].DBSnapshotIdentifier' \
  --output text \
  --region eu-west-1

# Eliminar un snapshot antiguo
aws rds delete-db-snapshot \
  --db-snapshot-identifier "healthy-prod-pre-deploy-20260401" \
  --region eu-west-1
```

---

## Verificación mensual del plan de backups

- [ ] Comprobar que los backups automáticos están activos: `aws rds describe-db-instances --db-instance-identifier healthy-prod --query 'DBInstances[0].BackupRetentionPeriod'`
- [ ] Verificar que el último snapshot automático es reciente (< 24h)
- [ ] Realizar una restauración de prueba en una instancia temporal cada trimestre
- [ ] Eliminar snapshots manuales con más de 30 días
- [ ] Revisar los costes de almacenamiento de snapshots en el billing
