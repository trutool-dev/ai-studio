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

## Railway — Métricas y logs

Backend, PostgreSQL y Redis corren en Railway; no hay infraestructura propia que instrumentar.

### Métricas

Railway → proyecto → servicio → pestaña **Metrics**: CPU, memoria, red y peticiones HTTP
(incluye códigos 5xx). Las mismas métricas están disponibles para los plugins de PostgreSQL y Redis.

### Logs

```bash
# Logs del backend en tiempo real (desde la raíz del repo)
railway logs --service <SERVICE_ID>

# Logs del último deploy
railway logs --service <SERVICE_ID> --deployment
```

En el dashboard: servicio → **Deployments** → deploy activo → **View Logs** (permite filtrar por texto, p. ej. `ERROR`).

### Alertas

- **Caída / health check:** UptimeRobot (sección anterior).
- **Deploys fallidos:** Railway → Project Settings → **Notifications** (email).

---

## Runbook de incidencias

| Síntoma | Causa probable | Acción |
|---------|---------------|--------|
| CPU / RAM alta sostenida | Pico de tráfico o memory leak | Revisar Metrics del servicio en Railway; subir recursos del plan o reiniciar el servicio |
| HTTP 5xx frecuentes | Error en el backend | Ver logs: `railway logs --service <SERVICE_ID>` y buscar `ERROR` |
| Latencia alta | Queries lentas o Redis caído | Revisar Metrics de los plugins PostgreSQL y Redis en Railway |
| Health check falla | API caída o DB no disponible | Railway → Deployments → ver estado y logs del deploy activo; `GET /health` indica qué dependencia falla |
| Conexiones a PostgreSQL agotadas | Pool de Prisma agotado | Ajustar `DATABASE_POOL_MAX` y reiniciar el servicio (Railway → Restart) |
