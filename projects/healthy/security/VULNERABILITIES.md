# Registro de Vulnerabilidades — Healthy

**Versión:** 1.0  
**Fecha de creación:** 2026-06-07  
**Responsable:** Security Agent / DPO  
**Política de divulgación:** Responsible Disclosure (ver sección final)

---

## Registro de Vulnerabilidades Conocidas

### Instrucciones de uso de esta tabla

- **ID:** formato `VUL-AAAA-NNN` (año + número secuencial)
- **Severidad:** CRÍTICO / ALTO / MEDIO / BAJO / INFO
- **Estado:** ABIERTO / EN PROGRESO / RESUELTO / ACEPTADO (riesgo aceptado conscientemente) / FALSO POSITIVO
- **Fecha resolución:** completar cuando el estado cambie a RESUELTO

---

## Tabla de Vulnerabilidades

| ID | Fecha detección | Descripción | Severidad | Estado | Fecha resolución |
|----|-----------------|-------------|-----------|--------|------------------|
| VUL-2026-001 | 2026-06-07 | No existe endpoint `DELETE /user/me` para ejercer el derecho al olvido (RGPD Art. 17). Las cascadas de BD están definidas en Prisma pero no hay ruta ni controller que las invoque. | ALTO | RESUELTO | 2026-07-07: `DELETE /user/me` implementado en user.routes.js + user.controller.js |
| VUL-2026-002 | 2026-06-07 | No existe endpoint `GET /user/me/export` para portabilidad de datos (RGPD Art. 20). | ALTO | RESUELTO | 2026-07-07: `GET /user/me/export` implementado en user.routes.js + user.controller.js |
| VUL-2026-003 | 2026-06-07 | El consentimiento explícito para tratar datos de salud (Art. 9.2.a RGPD) no se registra en base de datos. No hay campo `health_consent_given_at` en el modelo `User`. | ALTO | RESUELTO | 2026-06-15: checkbox explícito en OnboardingHealth.tsx + backend valida `healthConsent: true` antes de procesar datos |
| VUL-2026-004 | 2026-06-07 | No se verifica la edad mínima de 16 años (14 con consentimiento parental en España) en el registro ni en el onboarding. La `birthdate` se recoge pero no se valida contra la edad mínima legal. | ALTO | RESUELTO | 2026-07-07: verificación edad < 16 en auth.controller.js (L53) y onboarding.controller.js (L43) |
| VUL-2026-005 | 2026-06-07 | El endpoint `POST /plans/regenerate` no tiene rate limiting específico por usuario. Un usuario autenticado puede realizar llamadas ilimitadas a la API de Anthropic, provocando costes económicos sin control. | ALTO | RESUELTO | 2026-06-15: `planRegenerateLimiter` (3/24h) en plans.routes.js + `apiLimiter` global en app.js |
| VUL-2026-006 | 2026-06-07 | Los campos `condition_name` y `notes` del modelo `HealthCondition` (datos Art. 9 RGPD — categoría especial) no tienen cifrado a nivel de columna ni están marcados como sensibles en el esquema. | ALTO | ACEPTADO | Riesgo aceptado para v1.0.0. Mejora planificada v1.2. Railway cifra volúmenes at-rest. TLS en tránsito activo. |
| VUL-2026-007 | 2026-06-07 | `ProgressLog.photo_url` almacena una URL sin control de acceso documentado. Si el bucket S3/Supabase Storage es público, las fotos corporales de los usuarios son accesibles por cualquiera con la URL. | ALTO | ACEPTADO | Riesgo aceptado v1.0.0. Supabase Storage privado por defecto. URLs firmadas planificadas para v1.2. |
| VUL-2026-008 | 2026-06-07 | Helmet.js se usa con configuración por defecto sin CSP (Content-Security-Policy) personalizada. Para una API REST debería tener `default-src 'none'` o CSP restrictiva. | MEDIO | RESUELTO | 2026-07-07: CSP explícita en app.js con `defaultSrc: ["'self'"]`, `frameSrc/objectSrc: ["'none'"]` |
| VUL-2026-009 | 2026-06-07 | CORS configurado con `origin: process.env.FRONTEND_URL \|\| '*'`. Si `FRONTEND_URL` no está definida en producción, el servidor acepta peticiones de cualquier origen. | MEDIO | ABIERTO | — |
| VUL-2026-010 | 2026-06-07 | `generateVerificationCode()` usa `Math.random()` en lugar de `crypto.randomInt()`. `Math.random()` no es criptográficamente seguro y un atacante con acceso al estado del PRNG podría predecir códigos OTP. | MEDIO | RESUELTO | 2026-07-07: crypto.util.js usa `crypto.randomInt(100000, 1000000)`. authService.js usa `crypto.randomInt(0, 999999)`. |
| VUL-2026-011 | 2026-06-07 | `POST /auth/set-password` y `POST /auth/reset-password` no tienen rate limiting aplicado. Son vectores de fuerza bruta aunque requieran un token previo. | MEDIO | RESUELTO | 2026-06-15: `apiLimiter` global aplicado en app.js cubre estas rutas vía /auth |
| VUL-2026-012 | 2026-06-07 | El rate limiter de `express-rate-limit` usa almacenamiento en memoria. En entornos multi-instancia (varios workers o pods), el contador no es compartido y los límites son inefectivos. | MEDIO | ABIERTO | — |
| VUL-2026-013 | 2026-06-07 | `ai_prompt_used String?` en el modelo `Plan` persiste el prompt completo enviado a Anthropic, que incluye datos de salud del usuario (condiciones, medidas, edad). Estos datos no tienen cifrado adicional. | MEDIO | ABIERTO | — |
| VUL-2026-014 | 2026-06-07 | El algoritmo JWT no se especifica explícitamente en `jwt.sign()`. Se usa HS256 por defecto pero no está forzado ni documentado en el código. | MEDIO | ABIERTO | — |
| VUL-2026-015 | 2026-06-07 | No existe validación de que la nueva contraseña sea diferente a la anterior en `resetPassword` y `setPassword`. Un usuario puede "resetear" con la misma contraseña comprometida. | BAJO | ABIERTO | — |
| VUL-2026-016 | 2026-06-07 | El refresh token se genera como `uuid.v4() + '.' + Date.now()`. El sufijo de timestamp en texto plano filtra información temporal, aunque UUID v4 es criptográficamente seguro. | BAJO | ABIERTO | — |
| VUL-2026-017 | 2026-06-07 | `GET /health` expone versión del paquete, estado de BD y estado de Redis sin autenticación. En producción podría facilitar el reconocimiento del sistema a un atacante. | BAJO | ABIERTO | — |
| VUL-2026-018 | 2026-06-07 | `PasswordResetToken` tiene expiración de 24 horas. El estándar de la industria es 1 hora para tokens de reset de contraseña. | BAJO | ABIERTO | — |
| VUL-2026-019 | 2026-06-07 | Helmet HSTS está activo (default) pero sin `includeSubDomains` ni `preload`. | BAJO | RESUELTO | 2026-07-07: `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }` en app.js |
| VUL-2026-020 | 2026-06-07 | Existen archivos duplicados en `/src/middleware/` (versiones con y sin sufijo `.middleware`). El código activo usa los `.middleware.js`, pero los duplicados pueden mantenerse divergentes. | BAJO | RESUELTO | 2026-07-01: duplicados eliminados en commit `chore(healthy): limpieza backend, docs Railway y fixes devops` |
| VUL-2026-021 | 2026-06-07 | Helmet `X-Frame-Options` está configurado como `SAMEORIGIN` por defecto. Para una API REST sin interfaz web embebida, debería ser `DENY`. | INFO | RESUELTO | 2026-07-07: `frameguard: { action: 'deny' }` configurado explícitamente en app.js |
| VUL-2026-022 | 2026-06-07 | `TrainingPreferences.injuries_or_limitations` es un campo de texto libre que puede contener información médica sensible pero no está tratado como dato de categoría especial en la política. | INFO | ABIERTO | — |

---

## Vulnerabilidades Resueltas

*(Esta tabla se irá completando a medida que se resuelvan vulnerabilidades)*

| ID | Fecha detección | Descripción resumida | Severidad | Fecha resolución | Fix aplicado |
|----|-----------------|----------------------|-----------|------------------|--------------|
| — | — | — | — | — | — |

---

## Instrucciones para Reportar Nuevas Vulnerabilidades

### Responsible Disclosure Policy

Healthy App S.L. agradece los reportes de seguridad responsables de investigadores, usuarios y terceros. Seguimos un proceso de divulgación responsable para proteger a nuestros usuarios mientras las vulnerabilidades son corregidas.

### Canal de reporte

**Email dedicado:** security@healthy-app.es  
**PGP (opcional):** [Clave pública PGP — PENDIENTE DE GENERAR]  
**Tiempo de respuesta inicial:** máximo 48 horas laborables  
**Tiempo de resolución objetivo:** 30 días para ALTO/CRÍTICO, 90 días para MEDIO/BAJO  

### Qué incluir en el reporte

1. **Descripción:** Descripción clara de la vulnerabilidad y el sistema afectado
2. **Reproducción:** Pasos detallados para reproducir el problema
3. **Impacto:** Impacto estimado (qué datos o funcionalidades están en riesgo)
4. **Evidencias:** Capturas de pantalla, logs, requests/responses (sin datos reales de usuarios)
5. **Propuesta de fix (opcional):** Si tienes una solución sugerida

### Lo que nos comprometemos a hacer

- Confirmar la recepción del reporte en 48 horas
- Investigar y validar la vulnerabilidad
- Mantenerte informado del progreso
- Corregir la vulnerabilidad antes de cualquier divulgación pública
- Reconocer tu colaboración en nuestro Hall of Fame de seguridad (si lo deseas)

### Lo que te pedimos

- No acceder a datos de usuarios reales
- No realizar ataques DoS ni pruebas que puedan degradar el servicio
- No divulgar públicamente la vulnerabilidad hasta que hayamos publicado un fix (o hasta 90 días si no respondemos)
- Actuar de buena fe

### Alcance del programa

**En scope:**
- API backend (api.healthy-app.es)
- Aplicación móvil (iOS y Android)
- Landing page (healthy-app.es)
- Infraestructura accesible públicamente

**Fuera de scope:**
- Ataques de ingeniería social a empleados
- Ataques físicos
- Vulnerabilidades en dependencias de terceros que ya tienen CVE público

### Proceso interno para vulnerabilidades reportadas externamente

1. Recepción y acuse de recibo (< 48h)
2. Validación y asignación de ID `VUL-AAAA-NNN`
3. Clasificación de severidad (CVSS v3)
4. Apertura de issue privado en repositorio
5. Desarrollo y test del fix
6. Despliegue del fix
7. Notificación al reportante y cierre
8. Actualización de esta tabla con estado RESUELTO

---

## Definición de Severidades (CVSS v3 simplificado)

| Severidad | Score CVSS | Descripción |
|---|---|---|
| CRÍTICO | 9.0 – 10.0 | Explotación trivial, impacto máximo, acceso completo al sistema o datos |
| ALTO | 7.0 – 8.9 | Impacto significativo en confidencialidad/integridad/disponibilidad |
| MEDIO | 4.0 – 6.9 | Impacto moderado, requiere condiciones específicas o privilegios |
| BAJO | 0.1 – 3.9 | Impacto mínimo, difícil de explotar |
| INFO | 0.0 | Mejora de hardening, sin impacto directo en seguridad |
