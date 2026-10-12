# Cumplimiento RGPD — Healthy

Healthy maneja datos de salud de sus usuarios (peso, medidas corporales, condiciones médicas, historial de entrenamiento y nutrición). Estos datos son **datos sensibles de categoría especial** bajo el Reglamento General de Protección de Datos (RGPD, Reglamento EU 2016/679) y requieren protección reforzada.

Referencia de seguridad complementaria: `security/SECURITY_AUDIT.md`.

---

## Base legal para el tratamiento

| Tipo de datos | Base legal | Artículo RGPD |
|---------------|-----------|---------------|
| Datos de cuenta (email, teléfono) | Ejecución de contrato | Art. 6.1.b |
| Datos de salud (peso, condiciones médicas) | Consentimiento explícito | Art. 9.2.a |
| Datos de uso (logs diarios, actividad) | Ejecución de contrato | Art. 6.1.b |
| Cookies de analítica (si se implementa) | Consentimiento | Art. 6.1.a |
| Datos enviados a Anthropic para generar el plan | Consentimiento explícito en datos de salud | Art. 9.2.a + Art. 46 (transferencia internacional) |

---

## Flujo de consentimiento

### Consentimiento durante el registro — verificación de edad

En `POST /auth/register` se valida que el usuario tiene **≥ 16 años** a partir del campo `birthdate` antes de crear la cuenta (LOPDGDD Art. 7). Si la edad es inferior, el endpoint devuelve `403 Forbidden` con el mensaje `"Debes tener al menos 16 años para registrarte"`.

La edad se calcula en el servidor en el momento del registro. El usuario no puede bypasearla modificando el campo `birthdate` en una petición posterior, ya que el campo queda inmutable en la tabla `profiles`.

### Consentimiento para datos de salud (Categoría Especial — Art. 9)

Los datos de salud requieren consentimiento **explícito, libre, informado y específico** (Art. 9.2.a RGPD). La implementación:

1. En el paso `PUT /onboarding/health`: el backend registra `health_consent_given_at = NOW()` la primera vez que el usuario envía datos de salud. El campo es **inmutable** — una vez registrado, no puede sobreescribirse.
2. El campo `health_consent_version = "1.0"` registra la versión de la política de privacidad aceptada, de modo que revisiones futuras de la política puedan requerir un nuevo consentimiento explícito.
3. **Requisito de frontend (pendiente de PR-frontend):** La pantalla de salud del onboarding debe mostrar un checkbox de consentimiento (no pre-marcado) con enlace a la política de privacidad, y el botón de continuar debe estar deshabilitado hasta que el usuario marque el checkbox.

### Retirada del consentimiento

El usuario puede retirar el consentimiento para el tratamiento de datos de salud desde:

- **App:** Settings → Privacidad → Retirar consentimiento de datos de salud
- **Efecto inmediato:** bloqueo del procesamiento de nuevos datos de categoría especial
- **Datos históricos:** opciones de anonimización o eliminación completa vía `DELETE /user/me`
- La retirada del consentimiento no afecta a la licitud del tratamiento realizado antes de la retirada (Art. 7.3 RGPD)

---

## Derechos del usuario (RGPD)

### Derecho de acceso (Art. 15)

El usuario tiene derecho a saber qué datos suyos tratamos y con qué finalidad.

**Endpoint:** `GET /user/me/export` — devuelve todos los datos del usuario en formato JSON.

El sistema registra automáticamente la fecha de la exportación para cumplir con el Art. 15.3 (derecho a copia). Las exportaciones repetidas en un período de 30 días pueden limitarse para evitar abuso (no implementado en v1.0.0).

### Derecho de rectificación (Art. 16)

El usuario puede corregir sus datos en cualquier momento desde la app.

**Endpoints disponibles:**
- `PATCH /profile/physical` — actualiza perfil físico
- `PUT /onboarding/profile` — actualiza nombre, género, peso, altura, objetivo
- `PUT /onboarding/lifestyle` — actualiza datos de estilo de vida
- `PUT /onboarding/training` — actualiza preferencias de entrenamiento
- `PUT /onboarding/nutrition` — actualiza preferencias nutricionales
- `PUT /onboarding/health` — actualiza condiciones de salud

### Derecho al olvido / supresión (Art. 17)

El usuario puede solicitar la eliminación completa de todos sus datos.

**Endpoint:** `DELETE /user/me` — requiere JWT válido (access token activo).

**Proceso de eliminación implementado** (controlador `user.controller.js`):

```
Orden de eliminación (respeta restricciones de clave foránea):
  1. token_usage_logs
  2. verification_codes
  3. password_reset_tokens
  4. auth_sessions           → invalida todas las sesiones activas
  5. onboarding_answers
  6. food_restrictions
  7. progress_logs
  8. daily_logs
  9. session_exercises
  10. training_sessions
  11. meal_foods
  12. meals
  13. plans
  14. motivation_profile
  15. nutrition_preferences
  16. health_conditions
  17. training_preferences
  18. lifestyle_profiles
  19. profiles
  20. users                  → registro principal
```

Tras el borrado completo de PostgreSQL, se invalida la entrada del usuario en Redis (caché de plan IA y sesiones).

**Respuesta:** `{ "success": true, "message": "Cuenta eliminada" }`

**Pendiente para v1.1.0:**
- Eliminación de fotos de progreso en S3 (si se añade la funcionalidad de fotos)
- Log de auditoría de la eliminación (retenido 90 días según Art. 17.3.e para defensa legal)
- Confirmación por email al usuario tras la eliminación

### Derecho de portabilidad (Art. 20)

El usuario puede exportar sus datos en formato estructurado, de uso común y lectura mecánica.

**Endpoint:** `GET /user/me/export` — requiere JWT válido

**Datos incluidos en la exportación:**

```json
{
  "export_date": "ISO 8601",
  "user": { "email", "created_at", "email_verified" },
  "profile": { "name", "birthdate", "gender", "weight_kg", "height_cm", "goal", "activity_level" },
  "lifestyle": { "profession", "stress_level", "sleep_hours_usual", ... },
  "health_conditions": [ { "condition_name", "condition_type", "affects_training" }, ... ],
  "training_preferences": { ... },
  "nutrition_preferences": { ... },
  "food_restrictions": [ ... ],
  "motivation_profile": { ... },
  "progress_logs": [ { "log_date", "weight_kg", "body_fat_percentage", ... }, ... ],
  "daily_logs": [ { "log_date", "water_ml", "sleep_hours", "energy_level", ... }, ... ],
  "plans": [ { "start_date", "end_date", "status", "generated_by_ai" }, ... ]
}
```

**Formato de respuesta:** JSON con cabecera `Content-Disposition: attachment; filename="healthy-export-{userId}.json"` que fuerza la descarga en el navegador.

**Pendiente para v1.1.0:**
- Entrega alternativa por email: presigned URL de S3 con TTL de 24 horas
- Exportación adicional en formato CSV

### Derecho de oposición (Art. 21)

El usuario puede oponerse al tratamiento de sus datos para fines distintos de la ejecución del contrato (por ejemplo, analítica de uso agregada o mejora de los modelos de IA).

En la app: Settings → Privacidad → Gestión de consentimientos. Pendiente de implementación en v1.1.0.

Los datos enviados a Anthropic para generación de planes no se usan para entrenar modelos (según los términos de la API de Anthropic para uso comercial), pero el usuario debe ser informado de esta transferencia en la política de privacidad.

---

## Medidas técnicas de seguridad

### Datos en reposo

| Dato | Medida |
|------|--------|
| Contraseñas | Hash bcrypt (factor de coste ≥ 12), nunca en texto plano |
| OTP de verificación | `crypto.randomInt()` (no `Math.random()`), hash bcrypt antes de guardar |
| Datos en RDS PostgreSQL | Cifrado AES-256 en reposo (RDS encryption habilitado) |
| Fotos de progreso | Bucket S3 privado, acceso solo vía presigned URLs (TTL corto) |
| Datos de salud (`condition_name`, `notes`) | Sin cifrado a nivel de campo en v1.0.0; pendiente para v1.1.0 (VUL-2026-006) |

### Datos en tránsito

- Todo el tráfico usa HTTPS/TLS 1.2+ (certificado ACM, renovación automática)
- HSTS activado en CloudFront y ALB (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`)
- Comunicación HTTP sin cifrar bloqueada (redirect 301 a HTTPS en ALB y CloudFront)
- Conexión a ElastiCache Redis: TLS activado en producción (`REDIS_TLS=true`)

### Minimización de datos

- Solo se recopilan los datos estrictamente necesarios para la funcionalidad
- Los prompts enviados a la API de Anthropic usan el `userId` interno, no el email ni el nombre real del usuario
- Los códigos OTP tienen TTL de 15 minutos y se eliminan tras el uso o expiración
- Los tokens de reset de contraseña tienen TTL de 24 horas

### Retención de datos

| Tipo de dato | Retención | Acción al vencer |
|--------------|-----------|-----------------|
| Datos de cuenta activa | Mientras la cuenta exista | El usuario la elimina con `DELETE /user/me` |
| Códigos OTP | 15 minutos | Eliminación automática (campo `expires_at` en BD) |
| Tokens de reset de contraseña | 24 horas | Eliminación automática + flag `used: true` al usarse |
| Refresh tokens (sesiones) | 30 días de inactividad | Eliminación automática al expirar |
| Logs de uso de tokens IA | 12 meses | Eliminación por batch job mensual (pendiente implementar) |
| Logs de auditoría de eliminaciones | 90 días | Eliminación automática (pendiente implementar) |
| Fotos de progreso | Mientras la cuenta exista | Eliminación en cascada con la cuenta |

---

## Registro de actividades de tratamiento (Art. 30)

Resumen del registro formal requerido por el Art. 30 RGPD:

| Campo | Valor |
|-------|-------|
| **Responsable del tratamiento** | Healthy App (razón social y datos de contacto pendientes de definir) |
| **Categorías de interesados** | Usuarios mayores de 16 años que usan la aplicación |
| **Categorías de datos** | Datos de identificación, datos de salud (categoría especial), datos de actividad física y nutricional |
| **Finalidades** | Prestación del servicio de planes de salud personalizados; generación de planes de entrenamiento y nutrición mediante IA |
| **Destinatarios** | Anthropic (generación de planes), Supabase (autenticación), AWS (infraestructura EU) |
| **Transferencias internacionales** | Anthropic (EEUU) — base legal pendiente de documentar (cláusulas contractuales tipo) |
| **Plazos de supresión** | Ver tabla de retención de datos |
| **Medidas técnicas** | TLS en tránsito, AES-256 en reposo (RDS), bcrypt para contraseñas, rate limiting |

> **Nota legal:** Este registro debe mantenerse actualizado y estar disponible para la Agencia Española de Protección de Datos (AEPD) si se requiere. Completar con asesor legal antes del lanzamiento.

---

## Transferencias internacionales (Art. 44-46)

| Proveedor | País | Datos transferidos | Mecanismo legal |
|-----------|------|--------------------|-----------------|
| Anthropic (Claude API) | EEUU | Datos de salud anonimizados (userId + métricas de salud sin nombre/email) para generación de planes | Cláusulas Contractuales Tipo (SCCs) — pendiente de formalizar con Anthropic |
| Supabase | EEUU / EU | Credenciales de autenticación (email, hash de contraseña, OTP) | Comprobar si el proyecto está en región EU; si no, SCCs necesarias |
| AWS | EU (eu-west-1 — Irlanda) | Todos los datos de la aplicación | Sin transferencia internacional (datos en EU) |

> **Acción pendiente (legal):** Verificar y formalizar las SCCs con Anthropic antes del lanzamiento. Confirmar la región de Supabase Auth.

---

## Notificación de brechas de seguridad (Art. 33-34)

En caso de brecha de seguridad que afecte a datos personales:

1. **Detección** → registrar en `security/INCIDENT_RESPONSE.md`
2. **Evaluación de riesgo** → determinar si es probable que suponga un riesgo para los derechos y libertades
3. **Notificación a la AEPD** → en un plazo máximo de 72 horas desde la detección (Art. 33)
4. **Notificación a los afectados** → si la brecha supone un alto riesgo para sus derechos y libertades (Art. 34)
5. **Documentación** → registrar la brecha, sus efectos y las medidas correctoras adoptadas

El procedimiento detallado está en `security/INCIDENT_RESPONSE.md`.

**Contacto AEPD:** [www.aepd.es](https://www.aepd.es) · Teléfono: 901 100 099

---

## Delegado de Protección de Datos (DPD/DPO)

Las aplicaciones que tratan datos de salud a escala pueden estar obligadas a designar un DPD (Art. 37.1.c RGPD). En función del número de usuarios y el volumen de datos de salud tratados, consultar con asesor legal si la designación es obligatoria.

Mientras no se designe formalmente, el punto de contacto para consultas sobre privacidad es: **privacy@healthy.app** (dirección pendiente de crear).

---

> Última actualización: 2026-06-15 — Docs Agent (PR-3)  
> Revisión legal pendiente antes del lanzamiento v1.0.0.
