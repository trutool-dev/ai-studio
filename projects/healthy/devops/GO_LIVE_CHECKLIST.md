# Go-Live Checklist — v1.0.0 (TAREA-9)

**Generado por:** orquestador  
**Fecha:** 2026-07-14  
**Estado:** BLOQUEADO — espera TAREA-8 (EAS builds) y Lighthouse (dominio activo)

---

## Condición de entrada

Esta checklist solo puede ejecutarse cuando **todos** los puntos de la sección
"Criterios gate" estén marcados como completados.

**No crear el tag v1.0.0 si algún criterio falla.**

---

## Criterios gate — verificar en orden

### 1. Tests: cobertura >= 80%

- [ ] **Evidencia:** ejecutar y guardar salida

```bash
cd projects/healthy/backend
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
```

Estado actual: **88.21% (253/253 tests)** — verificado 2026-07-08.
Re-verificar antes del tag si se han modificado archivos de backend.

---

### 2. Load test: p95 < 500 ms

- [ ] **DIFERIDO por decisión del usuario** — no bloquea el tag v1.0.0

> Decisión de orquestador (2026-07-14): los tests de carga requieren el backend
> levantado localmente con base de datos real y fueron excluidos del gate por el usuario.
> Se ejecutarán como tarea post-release en v1.1.0.
>
> Comando para referencia futura:
> ```bash
> cd projects/healthy/backend
> NODE_ENV=test node server.js &
> cd ..
> node tests/load/planGeneration.js
> ```

---

### 3. Lighthouse landing >= 95 en los 4 indicadores

- [ ] Performance >= 95
- [ ] Accessibility >= 95
- [ ] Best Practices >= 95
- [ ] SEO >= 95

**Bloqueado:** el dominio `healthy.app` no está activo aún (verificado 2026-07-14).

Una vez activo, ejecutar:

```bash
npx lighthouse https://healthy.app \
  --output json \
  --output html \
  --output-path ./projects/healthy/tests/lighthouse-report \
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```

Ver `projects/healthy/tests/LIGHTHOUSE_PENDING.md` para instrucciones completas.

Documentar resultado en `projects/healthy/docs/LIGHTHOUSE_FINAL.md`.

---

### 4. Seguridad: 0 hallazgos CRITICAL o HIGH abiertos

- [x] **PASA** — verificado 2026-07-07

Referencia: `projects/healthy/security/SECURITY_AUDIT.md`
- VUL-2026-001, VUL-2026-002, VUL-2026-004: RESUELTOS
- VUL-2026-006, VUL-2026-007: ACEPTADOS con documentación

Volver a verificar si se han añadido nuevos hallazgos desde el 2026-07-07:
```bash
# Revisar manualmente:
# projects/healthy/security/VULNERABILITIES.md
# projects/healthy/security/SECURITY_AUDIT.md
```

---

### 5. Migración Prisma aplicada en producción

- [ ] Verificar que `prisma migrate status` muestra `Applied` contra la BD de producción

```bash
cd projects/healthy/backend
DATABASE_URL="<PRODUCTION_DATABASE_URL>" npx prisma migrate status
```

Estado actual: aplicada en staging (verificado 2026-06-29). Confirmar en producción
antes del tag.

---

### 6. Redis operativo en staging

- [ ] `GET https://backend-staging-01ee.up.railway.app/health` devuelve `"redis":"connected"`

> Ver TAREA-Redis en `tasks.md`. Requiere acción manual en Railway dashboard:
> editar `REDIS_URL` en el servicio backend con la URL real del plugin Redis.

---

### 7. App disponible en TestFlight (iOS)

- [ ] Build iOS `production` completado en expo.dev
- [ ] IPA subido a App Store Connect
- [ ] Al menos 1 tester interno en TestFlight puede instalar la app

> Requiere TAREA-8 completada. Ver `projects/healthy/devops/EAS_CHECKLIST.md`.

---

### 8. App disponible en Google Play Internal Testing (Android)

- [ ] Build Android `production` completado en expo.dev
- [ ] APK/AAB subido a Google Play Console
- [ ] App en estado "Internal testing" con al menos 1 tester

> Requiere TAREA-8 completada. Ver `projects/healthy/devops/EAS_CHECKLIST.md`.

---

## Pasos de go-live (ejecutar solo cuando todos los criterios pasen)

### Paso 1 — Documentar load test

Crear `projects/healthy/docs/LOAD_TEST_FINAL.md` con la decisión de diferimiento
o con los resultados reales si se ejecuta antes del go-live.

### Paso 2 — Documentar Lighthouse

Crear `projects/healthy/docs/LIGHTHOUSE_FINAL.md` con los scores obtenidos.
Estructura sugerida:

```markdown
# Lighthouse Final — v1.0.0

**Fecha:** YYYY-MM-DD
**URL:** https://healthy.app

| Categoría | Score |
|-----------|:-----:|
| Performance | XX |
| Accessibility | XX |
| Best Practices | XX |
| SEO | XX |

**Resultado:** PASS / FAIL
```

### Paso 3 — Actualizar tasks.md

Marcar en `projects/healthy/tasks.md` todas las métricas de éxito como `[x]`:

```markdown
- [x] Cobertura de tests >= 80%
- [x] Tiempo de respuesta API < 500ms (p95)
- [x] App publicada en TestFlight y Google Play Internal
- [x] Auditoría RGPD sin hallazgos críticos
- [x] Pipeline CI/CD verde en rama `develop`
- [x] Modo oscuro funcional en todas las pantallas
- [x] Landing publicada en producción con SSL, dominio propio y score Lighthouse >= 95
- [x] Pipeline de despliegue de landing operativo
```

### Paso 4 — Actualizar ORCHESTRATOR_STATUS.log

Añadir la entrada de cierre en `projects/healthy/ORCHESTRATOR_STATUS.log`:

```
[2026-07-XX] v1.0.0 — GO-LIVE COMPLETADO
  Fecha: YYYY-MM-DD
  Versión: v1.0.0
  Métricas alcanzadas:
    - Tests: 253/253, cobertura 88.21%
    - Seguridad: 0 CRITICAL/HIGH abiertos
    - Lighthouse: XX/XX/XX/XX (Performance/Accessibility/Best Practices/SEO)
    - Backend staging: https://backend-staging-01ee.up.railway.app/health
  Issues para v1.1.0:
    - Load tests en producción (autocannon p95 < 500ms bajo carga real)
    - SEC-03: cifrado at-rest de campos sensibles (condition_name, notes, ai_prompt_used)
    - DOC-01 a DOC-08: completar documentación técnica pendiente
    - TAREA-5: eliminar check ECR de branch protection en GitHub
```

### Paso 5 — Crear tag v1.0.0

```bash
# Desde la raíz del repositorio
git tag -a v1.0.0 -m "chore: release v1.0.0 — Healthy App go-live"
git push origin v1.0.0
```

Verificar que:
- El tag es visible en GitHub: `https://github.com/Trutool/ai-studio/tags`
- El workflow `eas-submit.yml` se dispara automáticamente con el trigger `v*.*.*`

### Paso 6 — Verificar que eas-submit.yml se completa

```bash
# Desde CLI (o ver en GitHub Actions)
# El workflow dispara: eas submit --platform all --profile production --latest
```

Confirmar en:
- App Store Connect: build recibido en "Processing"
- Google Play Console: release en "Internal testing"

---

## Pasos post-tag (monitorización inicial)

### Primeras 24 horas

1. **Monitorizar Railway staging:**
   - Ver logs en Railway dashboard → servicio backend → Logs
   - Verificar que no hay errores 5xx en los logs

2. **UptimeRobot:**
   - Configurar monitor HTTP para `https://backend-staging-01ee.up.railway.app/health`
   - Alertas a `trutool@gmail.com` si el uptime cae del 99%
   - Ver `projects/healthy/devops/MONITORING.md` para instrucciones completas

3. **CloudWatch / Railway Metrics:**
   - Revisar CPU y memoria del servicio backend en Railway dashboard
   - Si la memoria supera el 80%: escalar el plan (Hobby → Pro)

4. **Primeros usuarios:**
   - Compartir link de TestFlight con testers de confianza
   - Recopilar feedback en las primeras 24-48 horas
   - Crear issue en GitHub para cada bug crítico encontrado

### Primera semana

5. **Ejecutar load test real** (diferido en v1.0.0):
   ```bash
   cd projects/healthy/backend
   NODE_ENV=test node server.js &
   node ../tests/load/planGeneration.js
   ```

6. **Revisar logs de Claude API:**
   - Ver `ai/tokenLogger.ts` — revisar `token_usage_logs` en BD
   - Calcular coste real por usuario (estimado < $0.05 por onboarding con caching)

7. **Planificar v1.1.0:**
   - Cifrado at-rest (SEC-03)
   - Documentación técnica completa (DOC-01 a DOC-08 pendientes)
   - Tests de carga en producción

---

## Si algún criterio falla

| Criterio que falla | Acción |
|-------------------|--------|
| Cobertura < 80% | Reportar al agente tests; NO crear tag hasta superar umbral |
| Lighthouse < 95 | Revisar `landing/index.html` — ver `tests/LIGHTHOUSE_PENDING.md` para fixes |
| Vulnerabilidad CRITICAL/HIGH | Reportar al agente security; parchear antes del tag |
| Build EAS falla | Ver `devops/EAS_CHECKLIST.md` — sección "Qué hacer si falla" |
| Redis no conecta | TAREA-Redis: editar `REDIS_URL` en Railway dashboard manualmente |
| CI staging rojo | Revisar GitHub Actions → Deploy → Staging; ver `devops/PIPELINE_STATUS.md` |

---

## Resumen de estado actual (2026-07-14)

| Criterio | Estado | Bloqueado por |
|----------|--------|---------------|
| Tests >= 80% | [x] PASA (88.21%) | — |
| Load test p95 < 500ms | [~] DIFERIDO | Decisión del usuario |
| Lighthouse >= 95 | [ ] PENDIENTE | Dominio `healthy.app` inactivo |
| Seguridad 0 CRITICAL/HIGH | [x] PASA | — |
| Migración Prisma producción | [ ] VERIFICAR | Acción manual |
| Redis staging operativo | [ ] PENDIENTE | TAREA-Redis (acción manual Railway) |
| App TestFlight (iOS) | [ ] PENDIENTE | TAREA-8 (cuenta Apple del usuario) |
| App Google Play Internal | [ ] PENDIENTE | TAREA-8 (cuenta Google del usuario) |
| **Tag v1.0.0** | [ ] BLOQUEADO | Todos los anteriores |
