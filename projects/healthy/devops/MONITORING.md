# MONITORING — Monitorización del sistema Healthy

---

## Endpoint de health check

El backend expone `GET /health` que devuelve el estado real del sistema:

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "version": "1.0.0",
  "timestamp": "2026-06-08T10:00:00.000Z"
}
```

- **`status`**: `"ok"` si todo funciona; `"degraded"` si algún servicio secundario falla
- **`db`**: resultado del ping a PostgreSQL
- **`redis`**: resultado del ping a Redis
- **`version`**: version de la imagen desplegada (del `package.json`)
- **`timestamp`**: hora UTC de la respuesta

---

## UptimeRobot — Monitorización externa gratuita

### Configuración (plan gratuito)

1. Ir a [uptimerobot.com](https://uptimerobot.com) y crear una cuenta gratuita
2. Clic en **Add New Monitor**
3. Configurar:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `Healthy API — Staging` / `Healthy API — Production`
   - **URL**: `https://api-staging.healthy.app/health` / `https://api.healthy.app/health`
   - **Monitoring Interval**: 5 minutos (máximo en plan gratuito)
   - **Alert When Down For**: 1 check (alerta inmediata al primer fallo)
4. En **Alert Contacts**, añadir email de notificación

### Alertas configuradas

| Monitor | URL | Intervalo | Alerta |
|---------|-----|-----------|--------|
| API Staging | `https://api-staging.healthy.app/health` | 5 min | Email en < 5 min de downtime |
| API Production | `https://api.healthy.app/health` | 5 min | Email en < 5 min de downtime |

### Límites del plan gratuito

- 50 monitores
- Intervalo mínimo: 5 minutos
- 1 alerta de SMS al mes
- Alertas email ilimitadas
- Dashboard público de estado opcional (útil para informar a usuarios)

---

## CloudWatch Alarms — Alertas AWS

### Alarma: CPU ECS > 80%

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "healthy-api-cpu-high" \
  --alarm-description "CPU del servicio ECS supera el 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --dimensions Name=ClusterName,Value=healthy-production Name=ServiceName,Value=healthy-api \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-west-1:ACCOUNT_ID:healthy-alerts
```

### Alarma: Memoria ECS > 85%

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "healthy-api-memory-high" \
  --alarm-description "Memoria del servicio ECS supera el 85%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --dimensions Name=ClusterName,Value=healthy-production Name=ServiceName,Value=healthy-api \
  --statistic Average \
  --period 300 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:eu-west-1:ACCOUNT_ID:healthy-alerts
```

### Alarma: Errores RDS > 10/min

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "healthy-rds-errors-high" \
  --alarm-description "Errores en RDS superan 10 por minuto" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=healthy-production \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:eu-west-1:ACCOUNT_ID:healthy-alerts
```

### Alarma: Errores HTTP 5xx en ALB > 10/min

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "healthy-alb-5xx-high" \
  --alarm-description "Errores 5xx en el ALB superan 10 por minuto" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --dimensions Name=LoadBalancer,Value=app/healthy-production-alb/XXXXXXXX \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --treat-missing-data notBreaching \
  --alarm-actions arn:aws:sns:eu-west-1:ACCOUNT_ID:healthy-alerts
```

### Topic SNS para recibir alertas por email

```bash
# Crear el topic
aws sns create-topic --name healthy-alerts --region eu-west-1

# Suscribir email al topic (reemplazar con email real)
aws sns subscribe \
  --topic-arn arn:aws:sns:eu-west-1:ACCOUNT_ID:healthy-alerts \
  --protocol email \
  --notification-endpoint trutool@gmail.com
```

---

## CloudWatch Logs — Logs del backend

### Grupo de logs

- **Nombre del grupo**: `/ecs/healthy-api`
- **Retención**: 30 días (configurado en Terraform `ecs.tf`)
- **Streams**: uno por tarea ECS (prefijo `ecs/healthy-api/TASK_ID`)

### Ver logs en tiempo real (tail)

```bash
# Todos los logs de la API en tiempo real
aws logs tail /ecs/healthy-api --follow --region eu-west-1

# Filtrar solo errores
aws logs tail /ecs/healthy-api --follow --filter-pattern "ERROR" --region eu-west-1

# Filtrar por endpoint concreto
aws logs tail /ecs/healthy-api --follow --filter-pattern "/health" --region eu-west-1

# Logs de los últimos 30 minutos
aws logs tail /ecs/healthy-api \
  --since 30m \
  --region eu-west-1
```

### Buscar en logs históricos

```bash
# Buscar errores en las últimas 2 horas
aws logs filter-log-events \
  --log-group-name /ecs/healthy-api \
  --start-time $(date -d '2 hours ago' +%s000) \
  --filter-pattern "ERROR" \
  --region eu-west-1
```

---

## Dashboard CloudWatch

### Crear dashboard (consola AWS)

1. Ir a CloudWatch → **Dashboards** → **Create dashboard**
2. Nombre: `healthy-api-dashboard`
3. Añadir los siguientes widgets:

### Widgets recomendados

| Widget | Métrica | Descripción |
|--------|---------|-------------|
| Latencia API p50 | `TargetResponseTime` (ALB) | Latencia mediana de las peticiones |
| Latencia API p99 | `TargetResponseTime` (ALB) | Latencia del percentil 99 (los peores casos) |
| Error rate 5xx | `HTTPCode_Target_5XX_Count` (ALB) | Errores del servidor por minuto |
| Error rate 4xx | `HTTPCode_Target_4XX_Count` (ALB) | Errores del cliente por minuto |
| CPU ECS | `CPUUtilization` (ECS) | % de CPU del servicio |
| RAM ECS | `MemoryUtilization` (ECS) | % de memoria del servicio |
| Conexiones RDS activas | `DatabaseConnections` (RDS) | Conexiones abiertas a PostgreSQL |
| Latencia RDS | `ReadLatency` + `WriteLatency` (RDS) | Tiempo de respuesta de la base de datos |
| Cache hits Redis | `CacheHits` (ElastiCache) | Peticiones servidas desde caché |
| Tareas ECS corriendo | `RunningTaskCount` (ECS) | Número de contenedores activos |

### Comando CLI para crear el dashboard

```bash
aws cloudwatch put-dashboard \
  --dashboard-name healthy-api-dashboard \
  --dashboard-body file://cloudwatch-dashboard.json \
  --region eu-west-1
```

---

## Runbook de incidencias

| Síntoma | Causa probable | Acción |
|---------|---------------|--------|
| CPU ECS > 80% sostenido | Pico de tráfico o memory leak | Escalar ECS temporalmente: `aws ecs update-service --desired-count 3` |
| HTTP 5xx > 10/min | Error en el backend | Ver logs: `aws logs tail /ecs/healthy-api --follow --filter-pattern "ERROR"` |
| Latencia p99 > 2s | Queries lentas o Redis caído | Revisar `DatabaseConnections` en RDS y estado de ElastiCache |
| Health check falla | API caída o DB no disponible | Ver tarea ECS: `aws ecs list-tasks --cluster healthy-production` |
| RDS connections maxed | Pool de conexiones agotado | Reiniciar tareas ECS: `aws ecs update-service --force-new-deployment` |
