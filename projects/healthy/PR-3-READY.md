# PR-3 — docs: documentación técnica completa

**Estado:** ✅ LISTA PARA MERGE  
**Agente:** docs  
**Fecha:** 2026-06-15  
**Riesgo:** BAJO — solo documentación, sin modificaciones de código ejecutable

---

## Documentos creados / completados

### DOC-05 — `docs/README.md` (279 líneas)

Punto de entrada para cualquier desarrollador nuevo. Incluye:
- Stack tecnológico completo (tabla con versiones mínimas)
- Diagrama ASCII de arquitectura de alto nivel
- Requisitos previos con comandos de verificación
- Instalación paso a paso (6 pasos: clonar → instalar → env → BD → seed → arrancar)
- Tabla completa de variables de entorno
- Todos los comandos principales (dev, BD, tests) con ejemplos
- Mapa de la estructura de carpetas del proyecto
- Índice de documentación adicional con links

### DOC-01 — `docs/api-reference.md` (1261 líneas)

Referencia completa de todos los endpoints REST, agrupados por dominio:

| Dominio | Endpoints documentados |
|---------|----------------------|
| Health check | `GET /health` |
| Autenticación (`/auth`) | register, verify-email, resend-code, set-password, login, forgot-password, reset-password, refresh, logout, me |
| Onboarding (`/onboarding`) | start, profile, lifestyle, training, nutrition, health, motivation, complete |
| Planes (`/plans`) | GET /plans, GET /plans/:id, POST /plans/regenerate, PUT /plans/:id/pause |
| Entrenamiento (`/training`) | today, sessions, sessions/:id, sessions/:id/complete, sets |
| Nutrición (`/nutrition`) | today, meals, meals/:id/complete |
| Alimentos (`/foods`) | search, barcode/:code |
| Progreso (`/progress`) | GET, POST, stats |
| Logs diarios (`/logs`) | today (GET/PUT), history |
| Usuario (`/user`) | me/export, DELETE /user/me |

Cada endpoint documenta: método, ruta, descripción, body/params, respuesta exitosa con JSON de ejemplo, y errores posibles. Incluye tabla de códigos de error comunes y notas de seguridad.

### DOC-03 — `docs/ai-architecture.md` (309 líneas)

Arquitectura completa del módulo IA:
- Diagrama Mermaid del flujo de generación (9 pasos)
- Las 7 dimensiones del onboarding con interfaces TypeScript
- Fórmula Mifflin-St Jeor completa (TMB/TDEE) con factores de actividad y ejemplo práctico
- Estructura JSON completa de `GeneratedPlan` con `WeeklySession` y `MealSuggestion`
- Prompt caching: qué se cachea, precios, ahorro estimado por llamada (~90% en system prompt)
- Sistema de fallback: cuándo se activa, qué genera por reglas
- Regeneración automática: criterio de estancamiento, razones, contexto adicional
- Estimación de costes por usuario/mes con y sin caché

### DOC-04 — `docs/rgpd-compliance.md` (actualizado — 190 líneas)

Flujos RGPD reales implementados:
- Base legal para cada categoría de datos (Arts. 6.1.b, 9.2.a)
- Flujo de consentimiento: verificación de edad ≥16 años en registro (LOPDGDD Art. 7)
- Consentimiento explícito para datos de salud: campo `health_consent_given_at` inmutable
- **Art. 17 — Derecho al olvido:** `DELETE /user/me` con orden completa de eliminación en cascada (20 tablas)
- **Art. 20 — Portabilidad:** `GET /user/me/export` con lista completa de campos exportados y formato JSON
- **Art. 15 — Acceso** y **Art. 16 — Rectificación** con endpoints correspondientes
- Medidas técnicas: bcrypt (coste ≥12), AES-256 en RDS, TLS, HSTS, minimización de datos
- Tabla de retención de datos con plazos
- Registro de actividades de tratamiento (Art. 30) — resumen
- Transferencias internacionales (Anthropic/EEUU — SCCs pendientes de formalizar)
- Procedimiento de notificación de brechas (Arts. 33-34), referenciando `security/INCIDENT_RESPONSE.md`

### DOC-02 — `docs/deployment-guide.md` (actualizado — 230 líneas)

Guía completa para los tres entornos:

**Local:** requisitos, variables de entorno mínimas, base de datos, Redis, seed, servidor, Docker Compose.

**Staging (Railway):** tabla de secretos de GitHub requeridos, proceso de deploy automático (push a `develop` → pipeline 4 jobs: test → build → deploy → smoke-test), URL de verificación, comandos de logs, acceso a BD.

**Producción (AWS ECS):** checklist pre-deploy, proceso con aprobación manual en GitHub environment "production", migraciones de BD en producción, rollback con `aws ecs update-service`, comandos de CloudWatch Logs.

Variables de entorno por entorno (tabla comparativa local/staging/producción), migraciones local vs. producción, app móvil EAS (preview build y production submit).

### DOC-06 — `docs/architecture-web.md` (189 líneas)

Arquitectura AWS completa:
- Diagrama ASCII con dos flujos: landing (Route 53 → CloudFront → S3) y API (Route 53 → ALB → ECS → RDS/Redis)
- Tabla de todos los componentes AWS con instancia/tier y descripción
- Decisiones de red: VPC 10.0.0.0/16, 8 subnets (públicas y privadas en 2 AZ)
- Security Groups para sg-alb, sg-ecs, sg-rds, sg-redis con reglas inbound/outbound
- **Estimación de costes mensuales:** ~$56–80/mes en early stage (desglose por servicio)
- Flujo CI/CD: landing (S3 sync + CloudFront invalidation) y backend (ECR + ECS)
- Secretos de GitHub necesarios para CI/CD

### DOC-07 — `docs/landing-deploy.md` (306 líneas)

Guía para actualizar la landing:
- Mapa de secciones de `landing/index.html` con comentarios delimitadores
- Tokens de diseño CSS completos (colores, tipografía, radios, easings)
- Cómo añadir una nueva sección (plantilla HTML reutilizable)
- Despliegue manual: prerequisitos AWS CLI, `s3 sync`, refresco forzado de `index.html`, invalidación CloudFront
- Despliegue automático: cómo funciona el CI (push a `main` con cambios en `landing/`)
- Forzar invalidación manual de CloudFront
- Rollback: restaurar versión anterior del S3 (versioning habilitado)
- Verificación post-deploy: URL, headers, Lighthouse
- Cabeceras de seguridad inyectadas por CloudFront Functions (HSTS, X-Frame-Options, CSP, etc.)

### DOC-08 — `docs/landing-content.md` (339 líneas)

Guía para el equipo de marketing (sin conocimientos técnicos):
- Cómo abrir y editar el fichero HTML con cualquier editor de texto
- Edición sección a sección: hero (badge, título, subtítulo), estadísticas (4 métricas), features (entrenamiento, nutrición, progreso), manifesto, descarga (botones App Store / Google Play), footer
- Para cada sección: fragmento HTML exacto con el texto editable marcado, qué NO tocar, ejemplos
- Cómo cambiar imágenes de mockup: clases CSS y cómo referenciar nuevas imágenes
- Cómo actualizar CTAs: links de App Store y Google Play
- Proceso para publicar cambios: opción A (PR a main) y opción B (avisar al equipo técnico)

---

## Criterios de aceptación — verificación

| Criterio | Estado |
|----------|--------|
| Los 8 documentos existen y no están vacíos | ✅ |
| `docs/api-reference.md` cubre los 10 dominios de endpoints | ✅ auth, onboarding, plans, training, nutrition, foods, progress, logs, user, health |
| `docs/deployment-guide.md` incluye los tres entornos (local, staging, producción) | ✅ |
| `docs/rgpd-compliance.md` referencia Arts. 17 y 20 con los endpoints reales | ✅ `DELETE /user/me` (Art. 17), `GET /user/me/export` (Art. 20) |
| `docs/architecture-web.md` incluye estimación de costes mensuales AWS | ✅ ~$56–80/mes desglosado por servicio |
| Ningún documento referencia archivos inexistentes | ✅ verificado — todos los links apuntan a archivos reales en el repo |

---

## Archivos modificados en esta PR

```
docs/README.md              (sin cambios — ya estaba completo)
docs/api-reference.md       (sin cambios — ya estaba completo)
docs/ai-architecture.md     (sin cambios — ya estaba completo)
docs/rgpd-compliance.md     (ACTUALIZADO — eliminados TODOs, añadido contenido real)
docs/deployment-guide.md    (ACTUALIZADO — completadas secciones staging y producción)
docs/architecture-web.md    (sin cambios — ya estaba completo)
docs/landing-deploy.md      (sin cambios — ya estaba completo)
docs/landing-content.md     (sin cambios — ya estaba completo)
```

---

## Dependencias

- PR-3 no tiene dependencias de código — puede mergearse en cualquier momento.
- PR-6 (go-live) no puede cerrarse hasta que PR-3 esté mergeada.
