# Informe de Auditoría de Seguridad — Healthy

**Versión:** 1.0  
**Fecha de auditoría:** 2026-06-07  
**Auditado por:** Security Agent (AI Studio)  
**Scope:** Backend Node.js + Express, base de datos PostgreSQL/Prisma, Redis, middleware, variables de entorno  
**Resultado global:** WARN — No hay hallazgos CRÍTICOS bloqueantes, pero existen varios ALTO que deben resolverse antes de producción.

---

## 1. Resumen Ejecutivo

La aplicación Healthy implementa correctamente los fundamentos de seguridad: JWT con expiración corta, bcrypt con 12 rounds, rate limiting en endpoints sensibles, validación de entrada con express-validator y manejo de errores centralizado. Sin embargo, se identifican deficiencias relevantes en la configuración de headers HTTP (Helmet sin CSP ni HSTS personalizados), ausencia de endpoints RGPD obligatorios (derecho al olvido y portabilidad), falta de verificación de edad mínima en el registro, y el endpoint `/plans/regenerate` sin rate limiting específico que expone el presupuesto de tokens de IA a abuso.

---

## 2. Hallazgos por Categoría

### SEC-01 — Variables de entorno

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| ENV-01 | BAJO | `DATABASE_URL` usa credenciales de placeholder (`user:pass`) correctamente documentadas como ejemplo | Documentar longitud mínima requerida para contraseña de BD en producción | ABIERTO |
| ENV-02 | MEDIO | `JWT_SECRET` tiene placeholder `your-secret-min-32-chars-here-change-in-production` (32 chars). Correcto en longitud, pero el valor es predecible si se copia sin cambiar | Agregar validación en startup que rechace el JWT_SECRET si coincide con el valor de ejemplo o tiene menos de 32 chars | ABIERTO |
| ENV-03 | BAJO | `SMTP_PASS=app-password` es un placeholder legible. Bajo riesgo en `.env.example`, pero debe documentarse que nunca debe subirse al control de versiones | Verificar `.gitignore` incluye `.env` y no `.env.example` | ABIERTO |
| ENV-04 | INFO | `ANTHROPIC_API_KEY=sk-ant-...` presente y correctamente tipado. Formato correcto. | Ninguno — correcto | RESUELTO |
| ENV-05 | INFO | `JWT_EXPIRES_IN=15m` y `JWT_REFRESH_EXPIRES_IN=30d` configurados correctamente en el archivo de ejemplo | Ninguno — correcto | RESUELTO |
| ENV-06 | BAJO | No existe variable `SESSION_SECRET` para cookies ni `CORS_WHITELIST` explícita. `FRONTEND_URL` se usa directamente como origen CORS con fallback a `*` en producción si está vacía | Agregar validación que en `NODE_ENV=production` rechace `FRONTEND_URL=*` | ABIERTO |

**Evaluacion SEC-01:** WARN. No hay hardcoding de secretos en el código. El riesgo principal es la ausencia de validación en startup de valores inseguros.

---

### SEC-02 — Headers HTTP (Helmet.js)

Configuración encontrada en `app.js`:
```js
app.use(helmet());
```
Helmet se invoca con **configuración por defecto**. No se pasan opciones personalizadas.

| ID | Severidad | Header | Estado actual | Fix recomendado |
|----|-----------|--------|---------------|-----------------|
| HDR-01 | ALTO | Content-Security-Policy (CSP) | Helmet default activa CSP pero con directivas muy permisivas. No se define una política restrictiva para la API | Configurar `helmet.contentSecurityPolicy({ directives: { defaultSrc: ["'none'"], ... } })`. Para una API REST pura puede desactivarse con argumento o limitarse a `default-src 'none'` | ABIERTO |
| HDR-02 | MEDIO | Strict-Transport-Security (HSTS) | Helmet default incluye HSTS con `max-age=15552000` (180 días). Correcto pero sin `includeSubDomains` ni `preload` | Agregar `helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true })` | ABIERTO |
| HDR-03 | INFO | X-Frame-Options | Helmet default establece `SAMEORIGIN`. Para una API REST debería ser `DENY` | Agregar `helmet.frameguard({ action: 'deny' })` | ABIERTO |
| HDR-04 | INFO | X-Content-Type-Options | Helmet default incluye `nosniff` correctamente | Ninguno — correcto | RESUELTO |
| HDR-05 | INFO | Referrer-Policy | Helmet default incluye `no-referrer` correctamente | Ninguno — correcto | RESUELTO |
| HDR-06 | MEDIO | CORS con wildcard como fallback | `origin: process.env.FRONTEND_URL \|\| '*'` — Si `FRONTEND_URL` no está definida en producción, el servidor acepta peticiones desde cualquier origen | Lanzar error en startup si `FRONTEND_URL` no está definida en `NODE_ENV=production` | ABIERTO |

**Evaluacion SEC-02:** WARN. La configuración por defecto de Helmet cubre lo básico, pero faltan ajustes críticos para producción, especialmente CSP explícita y CORS seguro.

---

### SEC-03 — Datos de salud sensibles (Art. 9 RGPD)

Campos de categoría especial identificados en `schema.prisma`:

| Modelo | Campo | Categoría RGPD | Cifrado en BD | Marcado sensible | Riesgo |
|--------|-------|----------------|---------------|------------------|--------|
| `HealthCondition` | `condition_name` | Art. 9 — datos de salud | NO | NO | ALTO |
| `HealthCondition` | `notes` | Art. 9 — puede contener diagnósticos, medicación, PII | NO | NO | ALTO |
| `Profile` | `weight_kg`, `height_cm`, `body_type` | Datos biométricos | NO | NO | MEDIO |
| `ProgressLog` | `body_fat_percentage`, `muscle_mass_kg`, `waist_cm`, `hip_cm`, `chest_cm` | Medidas corporales — Art. 9 indirecto | NO | NO | MEDIO |
| `ProgressLog` | `photo_url` | Fotografías — dato biométrico potencial | NO (URL, no binario) | NO | ALTO |
| `LifestyleProfile` | `smoker`, `alcohol_consumption` | Hábitos de salud | NO | NO | MEDIO |
| `FoodRestriction` | `restriction_type=allergy`, `severity` | Alergias — Art. 9 | NO | NO | MEDIO |

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| DAT-01 | ALTO | `HealthCondition.condition_name` y `notes` almacenan datos de categoría especial (Art. 9 RGPD) sin cifrado a nivel de columna ni marcado en el esquema | Implementar cifrado de columna con `pgcrypto` o cifrado a nivel aplicación (AES-256) antes de persistir. Alternativamente, usar extensión Prisma de cifrado | ABIERTO |
| DAT-02 | ALTO | `ProgressLog.photo_url` almacena una URL string sin control de acceso documentado. Si apunta a un bucket S3 público, las fotos corporales son accesibles sin autenticación | Verificar que el bucket S3/Supabase Storage es privado. Usar URLs firmadas con expiración (presigned URLs) al servir fotos | ABIERTO |
| DAT-03 | MEDIO | El campo `notes` en `HealthCondition` es un texto libre `String?` sin ninguna restricción de longitud o sanitización documentada. Puede contener PII de terceros (familiares, médicos) | Añadir `@db.VarChar(1000)` máximo y documentar en política que el campo es para uso del usuario solamente | ABIERTO |
| DAT-04 | MEDIO | No existe campo `consent_given_at` ni `consent_health_data` en el modelo `User` o en ninguna tabla. El consentimiento explícito para tratar datos de salud (Art. 9.2.a RGPD) no se registra en base de datos | Añadir `health_consent_given_at DateTime?` al modelo `User` y verificar en el onboarding antes de guardar `HealthCondition` | ABIERTO |
| DAT-05 | BAJO | `TrainingPreferences.injuries_or_limitations` es un campo de texto libre que puede contener información médica sensible | Tratar como dato de categoría especial, documentar en `DATA_REGISTER.md` | ABIERTO |

**Evaluacion SEC-03:** FAIL para datos Art. 9. Los datos de salud más sensibles no tienen cifrado en reposo ni registro de consentimiento.

---

### SEC-04 — Auditoría RGPD

| Derecho RGPD | Endpoint | Implementado | Observación |
|---|---|---|---|
| Acceso (Art. 15) | `GET /auth/me` | PARCIAL | Solo devuelve perfil básico, no historial completo de datos tratados |
| Rectificación (Art. 16) | Rutas onboarding `PUT` | SI | El usuario puede actualizar su perfil |
| Supresión / Derecho al olvido (Art. 17) | No existe `DELETE /user` | NO | **Obligatorio antes de producción** |
| Portabilidad (Art. 20) | No existe `GET /user/export` | NO | **Obligatorio antes de producción** |
| Oposición (Art. 21) | No implementado | NO | Relevante para marketing/IA |
| Limitación del tratamiento (Art. 18) | No implementado | NO | Recomendado |
| Consentimiento explícito datos de salud (Art. 9.2.a) | No se registra en BD | NO | **Obligatorio — datos categoría especial** |
| Bloqueo de menores < 16 años (Art. 8 RGPD / Art. 7 LOPDGDD) | No implementado | NO | **Obligatorio en España** |

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| RGPD-01 | CRÍTICO | No existe endpoint de eliminación de cuenta (derecho al olvido, Art. 17 RGPD) | Implementar `DELETE /user/me` que elimine en cascada todos los datos del usuario y sus relaciones. Las cascadas ya están definidas en Prisma (`onDelete: Cascade`) | ABIERTO |
| RGPD-02 | ALTO | No existe endpoint de exportación de datos (portabilidad, Art. 20 RGPD) | Implementar `GET /user/me/export` que devuelva JSON/CSV con todos los datos del usuario en formato legible por máquina | ABIERTO |
| RGPD-03 | ALTO | No se verifica edad mínima (< 16 años) en registro ni onboarding. España requiere 14 años con consentimiento parental (LOPDGDD Art. 7) para datos de salud es 16 | Validar `birthdate` en `POST /onboarding/profile` y rechazar si la edad calculada es menor de 16. Para 14-15 añadir flujo de consentimiento parental | ABIERTO |
| RGPD-04 | ALTO | El consentimiento explícito para tratamiento de datos de salud (Art. 9.2.a) no se registra en la base de datos. La política de privacidad existe pero no hay traza en BD de cuándo y cómo se aceptó | Añadir campos `health_consent_given_at`, `terms_accepted_at`, `privacy_accepted_at` al modelo `User`. Registrar en el paso de onboarding | ABIERTO |
| RGPD-05 | MEDIO | `GET /auth/me` solo devuelve datos básicos. Para cumplir Art. 15 (derecho de acceso), debe poder obtenerse la totalidad de datos tratados | Ampliar o crear endpoint dedicado `GET /user/me/data` que incluya historial completo | ABIERTO |

**Evaluacion SEC-04:** FAIL. Faltan los tres derechos más importantes para RGPD: olvido, portabilidad y consentimiento registrado.

---

### SEC-05 — Tokens JWT

| Verificación | Valor encontrado | ¿Correcto? |
|---|---|---|
| Expiración access token | `15m` (env `JWT_EXPIRES_IN`) con fallback `'15m'` en código | SI |
| Expiración refresh token | `30d` (env `JWT_REFRESH_EXPIRES_IN`) | SI |
| Refresh token one-time-use | El refresh token se rota en cada uso (`update` con nuevo token + nueva expiración en `auth/refresh`) | SI |
| Algoritmo JWT | HS256 (por defecto de `jsonwebtoken` sin opción `algorithm` explícita) | PARCIAL — documentado abajo |
| Logout invalida refresh token en Redis | SI — `redis.del(session:${sessionId})` y `prisma.authSession.deleteMany` | SI |
| Invalidación sesiones en reset-password | SI — `prisma.authSession.deleteMany({ where: { user_id } })` en transacción | SI |

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| JWT-01 | MEDIO | El algoritmo JWT no se especifica explícitamente en `generateAccessToken`. `jsonwebtoken` usa HS256 por defecto, pero no está documentado ni forzado. Esto facilita ataques de confusión de algoritmo si se migra a RS256 en el futuro | Agregar `{ expiresIn: ..., algorithm: 'HS256' }` explícitamente en `jwt.sign` | ABIERTO |
| JWT-02 | BAJO | El refresh token se genera como `uuid.v4() + '.' + Date.now()`. UUID v4 es criptográficamente seguro, pero añadir el timestamp en texto plano filtra información temporal | Usar `crypto.randomBytes(48).toString('hex')` como refresh token en lugar de UUID+timestamp | ABIERTO |
| JWT-03 | INFO | El algoritmo HS256 es aceptable para un MVP pero para producción a escala se recomienda RS256 (clave asimétrica) para permitir verificación sin exponer el secreto de firma | Documentar decisión. Planificar migración a RS256 antes de escalar el servicio | ABIERTO |
| JWT-04 | INFO | Session TTL en Redis es 2592000 segundos (30 días), alineado con `JWT_REFRESH_EXPIRES_IN`. Correcto. | Ninguno — correcto | RESUELTO |

**Evaluacion SEC-05:** PASS con reservas. La implementación core es correcta. Los hallazgos son mejoras de hardening.

---

### SEC-06 — Rate Limiting

| Endpoint | Rate Limiter aplicado | Límite | Evaluación |
|---|---|---|---|
| `POST /auth/register` | authRateLimiter | 5 req / 15min / IP | CORRECTO |
| `POST /auth/login` | authRateLimiter | 5 req / 15min / IP | CORRECTO |
| `POST /auth/verify-email` | authRateLimiter | 5 req / 15min / IP | CORRECTO |
| `POST /auth/forgot-password` | authRateLimiter | 5 req / 15min / IP | CORRECTO |
| `POST /auth/resend-code` | authRateLimiter | 5 req / 15min / IP | CORRECTO |
| `POST /auth/set-password` | NINGUNO | — | MEDIO |
| `POST /auth/reset-password` | NINGUNO | — | MEDIO |
| `POST /auth/refresh` | NINGUNO | — | BAJO |
| `POST /plans/regenerate` | NINGUNO (solo autenticación) | — | ALTO — abuso de tokens IA |

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| RL-01 | ALTO | `POST /plans/regenerate` no tiene rate limiting específico. Un usuario autenticado puede llamar a este endpoint en bucle generando costes ilimitados de tokens Anthropic | Aplicar un rate limiter específico: máximo 3 regeneraciones por usuario por hora. Implementar con Redis counter por `userId` en lugar de por IP | ABIERTO |
| RL-02 | MEDIO | `POST /auth/set-password` y `POST /auth/reset-password` no tienen rate limiting. Aunque requieren un token/email previo, son vectores de enumeración y fuerza bruta | Aplicar `authRateLimiter` también a estos endpoints | ABIERTO |
| RL-03 | BAJO | El rate limiter es por IP. En entornos con NAT compartido (empresas, universidades) puede bloquear usuarios legítimos. El rate limiter de Redis por email/userId es más preciso | Implementar rate limiting dual: por IP (protección amplia) + por email/userId (precisión) | ABIERTO |
| RL-04 | INFO | El limiter usa `express-rate-limit` en memoria. En entornos multi-instancia (varios pods/workers) el contador no es compartido, haciendo el límite inefectivo | Para producción con múltiples instancias, usar `rate-limit-redis` con la instancia Redis ya disponible | ABIERTO |

**Evaluacion SEC-06:** WARN. Los endpoints de auth críticos están protegidos. Falta protección en `/plans/regenerate` y algunos endpoints de auth secundarios.

---

### SEC-07 — Política de contraseñas

| Verificación | Valor encontrado | ¿Correcto? |
|---|---|---|
| Longitud mínima 8 caracteres | Validado en `auth.routes.js` con `isLength({ min: 8 })` para `set-password` y `reset-password` | SI |
| bcrypt salt rounds | `SALT_ROUNDS = 12` en `crypto.util.js` | SI — correcto |
| Sin bloqueo de caracteres especiales | No se observa ningún filtro de caracteres. express-validator `isLength` no restringe caracteres | SI |
| Nueva contraseña diferente a la anterior | No se verifica en `resetPassword` ni en `setPassword` | NO |
| Generación código verificación | `Math.floor(100000 + Math.random() * 900000)` — usa `Math.random()`, no criptográficamente seguro | PARCIAL |

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| PWD-01 | BAJO | En `resetPassword` no se verifica que la nueva contraseña sea diferente a la anterior. Un usuario que completa el flujo sin cambiar la contraseña mantiene la comprometida | Antes de `hashPassword`, comparar con `comparePassword(newPassword, user.password_hash)` y rechazar si es igual | ABIERTO |
| PWD-02 | MEDIO | `generateVerificationCode()` usa `Math.random()` que no es criptográficamente seguro. Un atacante con acceso al estado del PRNG del proceso podría predecir códigos OTP | Reemplazar con `parseInt(crypto.randomInt(100000, 999999).toString())` o `crypto.randomBytes(3)` | ABIERTO |
| PWD-03 | INFO | No existe política de expiración de contraseñas ni historial de contraseñas. Aceptable para MVP, no recomendable en producción con datos de salud | Documentar decisión de no implementar rotación forzada. Considerar notificación si la contraseña tiene más de 12 meses | ABIERTO |
| PWD-04 | INFO | bcrypt con 12 rounds tiene un tiempo de hash de ~300ms en hardware moderno. Correcto para equilibrar seguridad y rendimiento. No requiere cambio. | Ninguno — correcto | RESUELTO |

**Evaluacion SEC-07:** PASS con reservas. La base es sólida. PWD-02 es el único hallazgo que debería resolverse antes de producción.

---

## 3. Checklist OWASP Top 10 (2021)

| # | Vulnerabilidad | Estado | Observación |
|---|---|---|---|
| A01 | Broken Access Control | PARTIAL | Auth en rutas protegidas, pero faltan endpoints RGPD y no hay control de acceso a recursos de otros usuarios documentado en todos los controllers |
| A02 | Cryptographic Failures | PARTIAL | bcrypt correcto, JWT HS256 aceptable, pero datos Art. 9 sin cifrar en BD y OTP con Math.random |
| A03 | Injection | PASS | Prisma ORM con queries parametrizadas. Sin SQL dinámico detectado. express-validator en inputs |
| A04 | Insecure Design | PARTIAL | Sin endpoints de olvido/portabilidad. Sin verificación de edad. Sin registro de consentimiento |
| A05 | Security Misconfiguration | PARTIAL | Helmet sin CSP personalizada. CORS con fallback wildcard. Rate limiter en memoria (multi-instancia) |
| A06 | Vulnerable Components | INFO | No auditado en este alcance. Ejecutar `npm audit` regularmente |
| A07 | Auth and Session Failures | PASS | Tokens rotan, logout invalida, rate limiting en login, bcrypt 12 rounds |
| A08 | Software and Data Integrity | INFO | No hay verificación de integridad de builds CI/CD auditada |
| A09 | Logging and Monitoring | PARTIAL | Logger implementado, pero no hay alertas automáticas en eventos de seguridad (múltiples fallos de login, token inválido masivo) |
| A10 | Server-Side Request Forgery | INFO | No se detectan llamadas a URLs externas desde input de usuario. Bajo riesgo actual |

---

## 4. Checklist RGPD — Derechos del Usuario

| Derecho | Art. RGPD | Implementado | Prioridad |
|---|---|---|---|
| Información / Transparencia | Art. 13-14 | SI (política de privacidad existe) | — |
| Acceso | Art. 15 | PARCIAL (solo `/auth/me` básico) | MEDIA |
| Rectificación | Art. 16 | SI (endpoints PUT onboarding) | — |
| Supresión (derecho al olvido) | Art. 17 | NO | ALTA — bloquea producción |
| Limitación del tratamiento | Art. 18 | NO | MEDIA |
| Portabilidad | Art. 20 | NO | ALTA — bloquea producción |
| Oposición | Art. 21 | NO | MEDIA |
| No decisión automatizada | Art. 22 | PARCIAL (IA genera planes pero usuario puede regenerar/pausar) | MEDIA |
| Consentimiento explícito datos de salud | Art. 9.2.a | NO registrado en BD | ALTA — bloquea producción |
| Protección menores | Art. 8 + LOPDGDD Art. 7 | NO | ALTA — bloquea producción |
| Notificación de brechas a AEPD | Art. 33 | Protocolo en INCIDENT_RESPONSE.md | — |
| Delegado de Protección de Datos | Art. 37 | Definido en política (dpo@healthy-app.es) | — |

---

## 5. Recomendaciones Prioritarias (Top 5 antes de producción)

### P1 — Implementar derecho al olvido y portabilidad (RGPD-01, RGPD-02)
**Bloqueante legal.** Sin estos endpoints la app no puede lanzarse en la UE.
- `DELETE /user/me` — eliminar cuenta y todos los datos asociados (cascadas ya en Prisma)
- `GET /user/me/export` — exportar todos los datos en JSON/CSV

### P2 — Registrar consentimiento explícito para datos de salud (RGPD-04, DAT-04)
**Bloqueante legal.** El Art. 9 RGPD requiere consentimiento explícito registrado.
- Añadir `health_consent_given_at DateTime?` al modelo `User`
- Añadir paso de consentimiento en onboarding antes de guardar `HealthCondition`
- Registrar IP y timestamp del consentimiento

### P3 — Verificar edad mínima en onboarding (RGPD-03)
**Bloqueante legal.** Requisito LOPDGDD Art. 7.
- Calcular edad desde `birthdate` al guardar perfil
- Rechazar registro si edad < 14; requerir consentimiento parental si 14-15; aceptar si >= 16

### P4 — Añadir rate limiting a `/plans/regenerate` (RL-01)
**Impacto económico directo.** Sin límite, un usuario puede agotar el presupuesto Anthropic en minutos.
- Rate limiter por `userId` en Redis: máximo 3 regeneraciones/hora, 10/día

### P5 — Reemplazar `Math.random()` en OTP y añadir CSP a Helmet (PWD-02, HDR-01)
**Seguridad básica.**
- OTP: reemplazar `Math.random()` por `crypto.randomInt(100000, 999999)`
- Helmet: añadir CSP explícita con `default-src 'none'` para API REST
- Helmet: añadir `frameguard({ action: 'deny' })`
- CORS: lanzar error en startup si `NODE_ENV=production` y `FRONTEND_URL` no está definida

---

## 6. Hallazgos adicionales

| ID | Severidad | Descripción | Fix recomendado | Estado |
|----|-----------|-------------|-----------------|--------|
| MISC-01 | MEDIO | `ai_prompt_used String?` en el modelo `Plan` almacena el prompt completo enviado a Anthropic, que incluye datos de salud del usuario (edad, condiciones, medidas). Este campo no tiene cifrado | Cifrar el campo `ai_prompt_used` o eliminarlo de la persistencia si no es necesario para auditabilidad | ABIERTO |
| MISC-02 | BAJO | Hay archivos duplicados en `/src/middleware/` (`auth.middleware.js` y `auth.js`, `rateLimiter.middleware.js` y `rateLimiter.js`, etc). El código activo usa los `.middleware.js`, pero la presencia de duplicados puede causar confusión y mantenimiento de dos versiones | Eliminar los archivos sin sufijo `.middleware` si son obsoletos | ABIERTO |
| MISC-03 | BAJO | El health check endpoint `GET /health` expone información del sistema (versión del paquete, estado de BD y Redis) sin autenticación | Proteger con autenticación básica o limitar el detalle en producción | ABIERTO |
| MISC-04 | INFO | `PasswordResetToken` expira en 24 horas. Para un flujo de reset, 1 hora es el estándar de la industria | Reducir a `1 * 60 * 60 * 1000` (1 hora) en `forgotPassword` | ABIERTO |
