# Registro de Vulnerabilidades — Healthy

**Versión:** 1.1  
**Fecha de creación:** 2026-06-07  
**Última revisión:** 2026-10-19 (reapertura tras `SECURITY_AUDIT_2026-10-19.md` §2.1)  
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

> **Reapertura 2026-10-19.** La auditoría `SECURITY_AUDIT_2026-10-19.md` (§2.1) comprobó en el código que
> 16 entradas declaradas resueltas (o aún abiertas) no lo estaban del todo. Se reabren con referencia a la
> tarea que las corrige (`SECURITY_TASKS.md`, columna "Origen"). Las correcciones están en la rama
> `fix/security-audit-2026-10-19`: una entrada solo vuelve a **RESUELTO** cuando el fix esté verificado,
> mergeado en `main` y desplegado. Sin cambios: VUL-2026-006 (riesgo aceptado), 008, 010, 019, 021 (verificadas).
> VUL-2026-009 figura como ABIERTO pero la auditoría la da por verificada (CORS sin wildcard, fail-closed):
> pendiente de cerrar por el agente de seguridad tras revisión.
>
> Nuevos hallazgos de la auditoría (secretos versionados, toma de cuentas, etc.) se gestionan como
> SEC-25..SEC-72 en `SECURITY_TASKS.md`; este registro no repite valores de secretos.

| ID | Fecha detección | Descripción | Severidad | Estado | Fecha resolución |
|----|-----------------|-------------|-----------|--------|------------------|
| VUL-2026-001 | 2026-06-07 | No existe endpoint `DELETE /user/me` para ejercer el derecho al olvido (RGPD Art. 17). Las cascadas de BD están definidas en Prisma pero no hay ruta ni controller que las invoque. | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): borrado no transaccional, sin reautenticación, dejaba claves en Redis y access token válido → **SEC-48 (SA-19)**. Corrección en rama `fix/security-audit-2026-10-19`: `ffcb134`, `8ccfcaf` — pendiente de verificación, merge y deploy |
| VUL-2026-002 | 2026-06-07 | No existe endpoint `GET /user/me/export` para portabilidad de datos (RGPD Art. 20). | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): export incompleto (comidas, sesiones, onboarding, consentimiento, teléfono, sesiones/IPs, planes) → **SEC-49 (SA-20)**. Corrección en rama `fix/security-audit-2026-10-19`: `ffcb134` — pendiente de verificación, merge y deploy |
| VUL-2026-003 | 2026-06-07 | El consentimiento explícito para tratar datos de salud (Art. 9.2.a RGPD) no se registra en base de datos. No hay campo `health_consent_given_at` en el modelo `User`. | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): `healthConsent` no se comprobaba y la fecha de consentimiento la fijaba el cliente → **SEC-33 (SA-07 + JB-09)**. Corrección en rama `fix/security-audit-2026-10-19`: `2c0ff41`, `c59bb38` — pendiente de verificación, merge y deploy |
| VUL-2026-004 | 2026-06-07 | No se verifica la edad mínima de 16 años (14 con consentimiento parental en España) en el registro ni en el onboarding. La `birthdate` se recoge pero no se valida contra la edad mínima legal. | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): eludible con `POST /onboarding/complete` (edad del body sin validar) → **SEC-29 (JB-02 + SA-18)**. Corrección en rama `fix/security-audit-2026-10-19`: `c59bb38` — pendiente de verificación, merge y deploy |
| VUL-2026-005 | 2026-06-07 | El endpoint `POST /plans/regenerate` no tiene rate limiting específico por usuario. Un usuario autenticado puede realizar llamadas ilimitadas a la API de Anthropic, provocando costes económicos sin control. | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): limitador con store en memoria y sin `trust proxy` → **SEC-32 (SA-06 + JB-07)**. Corrección en rama `fix/security-audit-2026-10-19`: `1661a42`, `5b4c2cb` — pendiente de verificación, merge y deploy |
| VUL-2026-006 | 2026-06-07 | Los campos `condition_name` y `notes` del modelo `HealthCondition` (datos Art. 9 RGPD — categoría especial) no tienen cifrado a nivel de columna ni están marcados como sensibles en el esquema. | ALTO | ACEPTADO | Riesgo aceptado para v1.0.0. Mejora planificada v1.2. Railway cifra volúmenes at-rest. TLS en tránsito activo. |
| VUL-2026-007 | 2026-06-07 | `ProgressLog.photo_url` almacena una URL sin control de acceso documentado. Si el almacenamiento de fotos es público, las fotos corporales de los usuarios son accesibles por cualquiera con la URL. | ALTO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado ACEPTADO): la justificación (Supabase Storage privado) ya no vale: Supabase se eliminó y `photo_url` admitía cualquier URL → **SEC-64 (SA-29)**. Corrección en rama `fix/security-audit-2026-10-19`: `d03781c` — pendiente de verificación, merge y deploy |
| VUL-2026-008 | 2026-06-07 | Helmet.js se usa con configuración por defecto sin CSP (Content-Security-Policy) personalizada. Para una API REST debería tener `default-src 'none'` o CSP restrictiva. | MEDIO | RESUELTO | 2026-07-07: CSP explícita en app.js con `defaultSrc: ["'self'"]`, `frameSrc/objectSrc: ["'none'"]` |
| VUL-2026-009 | 2026-06-07 | CORS configurado con `origin: process.env.FRONTEND_URL \|\| '*'`. Si `FRONTEND_URL` no está definida en producción, el servidor acepta peticiones de cualquier origen. | MEDIO | ABIERTO | — |
| VUL-2026-010 | 2026-06-07 | `generateVerificationCode()` usa `Math.random()` en lugar de `crypto.randomInt()`. `Math.random()` no es criptográficamente seguro y un atacante con acceso al estado del PRNG podría predecir códigos OTP. | MEDIO | RESUELTO | 2026-07-07: crypto.util.js usa `crypto.randomInt(100000, 1000000)`. authService.js usa `crypto.randomInt(0, 999999)`. |
| VUL-2026-011 | 2026-06-07 | `POST /auth/set-password` y `POST /auth/reset-password` no tienen rate limiting aplicado. Son vectores de fuerza bruta aunque requieran un token previo. | MEDIO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): `apiLimiter` no se montaba en `/auth`: set/reset-password, refresh y dev sin limitador → **SEC-43 (SA-12) + SEC-27 (SA-03)**. Corrección en rama `fix/security-audit-2026-10-19`: `5b4c2cb`, `f321aa6` — pendiente de verificación, merge y deploy |
| VUL-2026-012 | 2026-06-07 | El rate limiter de `express-rate-limit` usa almacenamiento en memoria. En entornos multi-instancia (varios workers o pods), el contador no es compartido y los límites son inefectivos. | MEDIO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): ningún limitador usaba store Redis → **SEC-32 (SA-06)**. Corrección en rama `fix/security-audit-2026-10-19`: `5b4c2cb` — pendiente de verificación, merge y deploy |
| VUL-2026-013 | 2026-06-07 | `ai_prompt_used String?` en el modelo `Plan` persiste el prompt completo enviado a Anthropic, que incluye datos de salud del usuario (condiciones, medidas, edad). Estos datos no tienen cifrado adicional. | MEDIO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): ya no se guarda el prompt, pero sí el `reason` libre sin límite de longitud → **SEC-63 (SA-28)**. Corrección en rama `fix/security-audit-2026-10-19`: `c59bb38` — pendiente de verificación, merge y deploy |
| VUL-2026-014 | 2026-06-07 | El algoritmo JWT no se especifica explícitamente en `jwt.sign()`. Se usa HS256 por defecto pero no está forzado ni documentado en el código. | MEDIO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): sin `algorithm` en `sign` ni `algorithms` en `verify` → **SEC-44 (SA-13)**. Corrección en rama `fix/security-audit-2026-10-19`: `bfea7f1`, `8ccfcaf` — pendiente de verificación, merge y deploy |
| VUL-2026-015 | 2026-06-07 | No existe validación de que la nueva contraseña sea diferente a la anterior en `resetPassword` y `setPassword`. Un usuario puede "resetear" con la misma contraseña comprometida. | BAJO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): seguía abierta → **SEC-72**. Corrección en rama `fix/security-audit-2026-10-19`: `2636da9` — pendiente de verificación, merge y deploy |
| VUL-2026-016 | 2026-06-07 | El refresh token se genera como `uuid.v4() + '.' + Date.now()`. El sufijo de timestamp en texto plano filtra información temporal, aunque UUID v4 es criptográficamente seguro. | BAJO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): formato igual y además guardado en claro en BD → **SEC-45 (SA-14)**. Corrección en rama `fix/security-audit-2026-10-19`: `6b21337` — pendiente de verificación, merge y deploy |
| VUL-2026-017 | 2026-06-07 | `GET /health` expone versión del paquete, estado de BD y estado de Redis sin autenticación. En producción podría facilitar el reconocimiento del sistema a un atacante. | BAJO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): confirmado en vivo en staging y producción; `SELECT 1` por petición sin rate limit → **SEC-71 (B-02)**. Corrección en rama `fix/security-audit-2026-10-19`: `80b88dd`, `b27763d` — pendiente de verificación, merge y deploy |
| VUL-2026-018 | 2026-06-07 | `PasswordResetToken` tiene expiración de 24 horas. El estándar de la industria es 1 hora para tokens de reset de contraseña. | BAJO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): el token de reset seguía con validez de 24 h → **SEC-45 (SA-14)**. Corrección en rama `fix/security-audit-2026-10-19`: `6b21337` — pendiente de verificación, merge y deploy |
| VUL-2026-019 | 2026-06-07 | Helmet HSTS está activo (default) pero sin `includeSubDomains` ni `preload`. | BAJO | RESUELTO | 2026-07-07: `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }` en app.js |
| VUL-2026-020 | 2026-06-07 | Existen archivos duplicados en `/src/middleware/` (versiones con y sin sufijo `.middleware`). El código activo usa los `.middleware.js`, pero los duplicados pueden mantenerse divergentes. | BAJO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (declarado RESUELTO): quedaban servicios muertos y rotos (`authService.js`, `cacheService.js`) → **SEC-68 (SA-33 + JB-18)**. Corrección en rama `fix/security-audit-2026-10-19`: `a190ebd` — pendiente de verificación, merge y deploy |
| VUL-2026-021 | 2026-06-07 | Helmet `X-Frame-Options` está configurado como `SAMEORIGIN` por defecto. Para una API REST sin interfaz web embebida, debería ser `DENY`. | INFO | RESUELTO | 2026-07-07: `frameguard: { action: 'deny' }` configurado explícitamente en app.js |
| VUL-2026-022 | 2026-06-07 | `TrainingPreferences.injuries_or_limitations` es un campo de texto libre que puede contener información médica sensible pero no está tratado como dato de categoría especial en la política. | INFO | **REABIERTO** (2026-10-19) | Auditoría 2026-10-19 (seguía ABIERTO): texto libre de salud sin límite de longitud ni tratamiento específico → **SEC-63 (SA-28)**. Corrección en rama `fix/security-audit-2026-10-19`: `c59bb38` — pendiente de verificación, merge y deploy |

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
