# Registro de Actividades de Tratamiento (RAT) — Healthy

**Documento:** Registro de Actividades de Tratamiento  
**Artículo de referencia:** Art. 30 RGPD (Reglamento UE 2016/679)  
**Responsable del tratamiento:** Healthy App S.L. *(👤 pendiente de confirmar por Antonio: razón social, NIF y domicilio)*  
**DPO / contacto de privacidad:** dpo@healthy-app.es *(👤 pendiente de confirmar que el buzón existe y quién lo atiende)*  
**Versión:** 2.0  
**Fecha:** 19 de octubre de 2026  
**Próxima revisión:** ante cualquier cambio de encargados o de tratamiento, y como máximo el 19 de abril de 2027

> **Cambios de la v2.0 (SEC-69 / SA-34).** El RAT se ha alineado con el sistema real verificado en
> la auditoría del 2026-10-19 (`SECURITY_AUDIT_2026-10-19.md`):
> - **Supabase eliminado** (commit `25f1359`): ya no es encargado. La autenticación es propia (backend + PostgreSQL).
> - **Redis está en Railway**, no en "Redis Cloud UE": se usa para la caché cifrada de planes, listas de revocación de sesión, cuotas de IA y caché de búsqueda de alimentos, siempre con TTL.
> - **Stripe y notificaciones push no están implementados**: AT-07 y AT-09 pasan a "no activos".
> - **Fotos de progreso:** no hay almacenamiento de objetos propio; solo se guarda una URL `https` de host en lista blanca (SEC-64).
> - **Retención:** la purga automática **no está implementada todavía** (SEC-50 pendiente). La versión anterior la declaraba "Implementada".
> - Se corrigen afirmaciones no verificadas: "JWT RS256" (es HS256 con algoritmo fijado, SEC-44), "cifrado AES-256 en reposo" de la BD (no hay cifrado de columna; VUL-2026-006, riesgo aceptado), "DPA firmado" de proveedores sin constancia.
>
> Leyenda: ✅ verificado en código o en documentación del proyecto · ⏳ pendiente técnico (tarea SEC) · 👤 pendiente de Antonio (decisión o trámite legal/contractual).

---

## Índice de Actividades de Tratamiento

| ID | Actividad | Categoría de datos | Base jurídica | Riesgo | Estado |
|----|-----------|-------------------|---------------|--------|--------|
| AT-01 | Registro, autenticación y sesiones | Identificativos, contacto, técnicos (IP) | Contrato | Medio | Activo |
| AT-02 | Onboarding y perfil de salud | **Salud (Art. 9)** | Consentimiento explícito | Alto | Activo |
| AT-03 | Generación de planes personalizados con IA | **Salud (Art. 9)** | Consentimiento explícito | Alto | Activo |
| AT-04 | Seguimiento nutricional diario | **Salud (Art. 9)** | Consentimiento explícito | Alto | Activo |
| AT-05 | Seguimiento de entrenamientos | **Salud (Art. 9)** | Consentimiento explícito | Alto | Activo |
| AT-06 | Registro de progreso (medidas y fotos) | **Salud (Art. 9)** + imagen | Consentimiento explícito | Alto | Activo (fotos: solo URL externa) |
| AT-07 | Notificaciones push | Token de dispositivo | Consentimiento | Bajo | **No activo** |
| AT-08 | Logs técnicos y seguridad | Técnicos (IP, user-agent) | Interés legítimo | Bajo | Activo |
| AT-09 | Suscripciones y pagos | Financieros | Contrato | Medio | **No activo** |
| AT-10 | Ejercicio de derechos RGPD | Identificativos + datos exportados | Obligación legal | Medio | Activo |
| AT-11 | Comunicaciones de servicio (email) | Correo electrónico, OTP | Contrato | Bajo | Activo |
| AT-12 | Control de uso y coste de IA | Identificador de usuario, consumo de tokens | Interés legítimo | Bajo | Activo |

---

## AT-01 — Registro, autenticación y sesiones

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Crear y gestionar la cuenta; verificar el email; autenticar y mantener sesiones |
| **Categorías de interesados** | Usuarios registrados (edad mínima 16 años, validada en servidor — SEC-29) |
| **Categorías de datos** | Email, teléfono (opcional), nombre/alias, fecha de nacimiento, hash de contraseña (bcrypt 12 rondas), códigos OTP (guardados como HMAC — SEC-45), tokens de reset y refresh (guardados con hash — SEC-45), sesiones (`AuthSession`) con **dirección IP** y fechas, marca de consentimiento Art. 9 fijada por el servidor (SEC-33) |
| **Base jurídica** | Art. 6.1.b RGPD — Ejecución de contrato |
| **Categoría especial** | No |
| **Destinatarios / encargados** | Railway (alojamiento del backend, PostgreSQL y Redis); proveedor SMTP para el envío de OTP (AT-11) |
| **Transferencias internacionales** | Railway Corp. (EE. UU.) — 👤 región de los servicios y DPA/SCC pendientes de confirmar |
| **Plazo de retención** | Cuenta: mientras esté activa; borrado completo al ejercer la supresión (`DELETE /user/me`, transaccional y con reautenticación — SEC-48). OTP, tokens de reset/refresh y sesiones caducadas: ⏳ **sin purga automática hasta SEC-50** (propuesta: borrado diario de expirados/usados; IPs de sesión ≤ 90 días) |
| **Medidas de seguridad** | bcrypt 12 rondas; JWT HS256 con algoritmo fijado y revocación por sesión en Redis (SEC-44); refresh tokens rotados con detección de reutilización (SEC-45); rate limiting en `/auth` (SEC-32/SEC-43); HTTPS |
| **Evaluación de riesgo** | Medio |
| **Responsable interno** | Equipo Backend |

---

## AT-02 — Onboarding y perfil de salud

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Recoger el perfil físico, de estilo de vida y de salud para generar un plan personalizado |
| **Categorías de interesados** | Usuarios que completan el onboarding |
| **Categorías de datos — salud (Art. 9)** | Peso, altura, % de grasa corporal; **condiciones de salud** (`HealthCondition`: enfermedades, lesiones, medicación); **lesiones o limitaciones** en texto libre (`injuries_or_limitations`); **alergias e intolerancias** (`FoodRestriction`); nivel de estrés, horas y calidad de sueño; respuestas libres del onboarding (`OnboardingAnswer`) |
| **Categorías de datos — otros** | Edad/sexo, nivel de actividad, objetivo, preferencias de entrenamiento y nutrición, perfil de motivación |
| **Base jurídica** | Art. 9.2.a RGPD — consentimiento explícito, validado en servidor (`healthConsent === true`, fecha del servidor — SEC-33). ⏳ Versionado y retirada del consentimiento: SEC-47 |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios / encargados** | Railway (PostgreSQL); Anthropic (envío al prompt para generar el plan, AT-03) |
| **Transferencias internacionales** | Railway (EE. UU., 👤 región/DPA pendientes); Anthropic (EE. UU., ver AT-03) |
| **Plazo de retención** | Vigencia de la cuenta; borrado completo con la supresión de la cuenta (SEC-48) |
| **Medidas de seguridad** | TLS en tránsito; cifrado en reposo del proveedor (👤 confirmar con Railway); **sin cifrado de columna** (VUL-2026-006, riesgo aceptado, revisar antes de producción con usuarios reales); ⏳ límite de longitud del texto libre de salud (SEC-63) |
| **Evaluación de riesgo** | **Alto** |
| **Responsable interno** | Equipo Backend + Equipo IA |

---

## AT-03 — Generación de planes personalizados con IA

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Generar planes de entrenamiento y nutrición adaptados al perfil del usuario |
| **Categorías de interesados** | Usuarios con consentimiento Art. 9 que solicitan un plan |
| **Categorías de datos** | Datos de AT-02 necesarios para el plan (incluidas alergias, lesiones y condiciones — SEC-28), saneados antes del envío (SEC-38). **No** se envían email, nombre ni teléfono. Plan resultante (`Plan`) y motivo de regeneración |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito; Art. 6.1.b para la prestación del servicio |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios / encargados** | **Anthropic PBC** (Claude API) — inferencia; Railway (almacenamiento del plan) |
| **Transferencias internacionales** | **Anthropic (EE. UU.) — transferencia internacional de datos de salud.** 👤 Pendiente de Antonio: aceptar el DPA de Anthropic (Commercial Terms + DPA con SCC) o verificar la adhesión al EU-US Data Privacy Framework, documentar la evaluación de la transferencia y reflejarla en `PRIVACY_POLICY.md` |
| **Caché** | Plan generado cacheado en **Redis (Railway)** cifrado con AES-256-GCM + HMAC, **TTL 24 h**, fail-closed (si faltan las claves no se cachea — SEC-46/SEC-57); se invalida al cambiar el perfil y al borrar la cuenta (SEC-48) |
| **Plazo de retención** | Planes: vigencia de la cuenta. Caché: 24 h. Anthropic: según sus condiciones de API (👤 confirmar plazo de retención de entradas/salidas en el DPA) |
| **Medidas de seguridad** | Saneado de texto libre y defensa frente a prompt injection (SEC-38); validación de la salida y salvaguardas clínicas (SEC-36/SEC-37); cuota diaria de tokens por usuario (SEC-56); TLS |
| **Decisión automatizada** | El plan es una recomendación generada automáticamente, sin efectos jurídicos; se muestra disclaimer médico. Revisión humana a petición del usuario 👤 (definir canal) |
| **Evaluación de riesgo** | **Alto** |
| **Responsable interno** | Equipo IA |

---

## AT-04 — Seguimiento nutricional diario

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Registrar comidas y su adherencia al plan |
| **Categorías de interesados** | Usuarios que usan el módulo de nutrición |
| **Categorías de datos** | Comidas (`Meal`, `MealFood`): alimento, cantidad, macronutrientes, calorías, fecha y estado; búsquedas de alimentos |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios / encargados** | Railway (PostgreSQL; Redis para la caché de búsquedas de alimentos, TTL 6 h, sin datos de usuario) |
| **Transferencias internacionales** | Railway (👤 región/DPA pendientes) |
| **Plazo de retención** | Vigencia de la cuenta |
| **Medidas de seguridad** | Acceso autenticado por JWT y filtrado por `userId`; TLS |
| **Evaluación de riesgo** | Alto |
| **Responsable interno** | Equipo Backend |

---

## AT-05 — Seguimiento de entrenamientos

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Registrar sesiones y ejercicios completados |
| **Categorías de interesados** | Usuarios que usan el módulo de entrenamiento |
| **Categorías de datos** | Sesiones (`TrainingSession`, `SessionExercise`): ejercicio, series, repeticiones, peso utilizado, fecha, estado |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios / encargados** | Railway (PostgreSQL) |
| **Transferencias internacionales** | Railway (👤 región/DPA pendientes) |
| **Plazo de retención** | Vigencia de la cuenta |
| **Medidas de seguridad** | Acceso autenticado por JWT y filtrado por `userId`; TLS |
| **Evaluación de riesgo** | Alto |
| **Responsable interno** | Equipo Backend |

---

## AT-06 — Registro de progreso (medidas y fotos)

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Documentar la evolución física del usuario |
| **Categorías de interesados** | Usuarios que registran su progreso |
| **Categorías de datos** | `ProgressLog`: peso, % de grasa corporal, masa muscular, perímetros (cintura, cadera, pecho), notas libres, fecha; `photo_url` (URL de una foto alojada fuera de Healthy); `DailyLog`: agua, horas y calidad de sueño, energía, estado de ánimo, pasos |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)**; las fotos corporales pueden revelar estado de salud |
| **Destinatarios / encargados** | Railway (PostgreSQL). **Healthy no almacena imágenes**: `photo_url` solo admite `https` y hosts en lista blanca (SEC-64). 👤 Si se implementa subida de fotos, elegir proveedor de almacenamiento privado (UE preferente) y añadirlo como encargado |
| **Transferencias internacionales** | Railway (👤 región/DPA pendientes) |
| **Plazo de retención** | Vigencia de la cuenta |
| **Medidas de seguridad** | Acceso autenticado por JWT y filtrado por `userId`; validación de URL (SEC-64) |
| **Evaluación de riesgo** | Alto |
| **Responsable interno** | Equipo Backend |

---

## AT-07 — Notificaciones push (NO ACTIVO)

No hay envío de notificaciones push en el backend (sin integración con Expo Push Service). Si se activa: consentimiento Art. 6.1.a, token de dispositivo sin datos de salud en el contenido, Expo (EE. UU.) como encargado con DPA/SCC (👤) y actualización de este registro antes del lanzamiento.

---

## AT-08 — Logs técnicos y seguridad

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Monitorizar el servicio, detectar errores y prevenir accesos no autorizados |
| **Categorías de interesados** | Usuarios y visitantes de la API |
| **Categorías de datos** | IP, timestamp, método y ruta, código de respuesta, user-agent (morgan); identificador de usuario en eventos de seguridad |
| **Base jurídica** | Art. 6.1.f RGPD — Interés legítimo (seguridad del servicio) |
| **Categoría especial** | No (los logs no deben contener datos de salud ni PII — ⏳ SEC-51 elimina emails, OTP y enlaces de reset de los logs) |
| **Destinatarios / encargados** | Railway (logs del servicio) |
| **Transferencias internacionales** | Railway (👤 región/DPA pendientes) |
| **Plazo de retención** | Según el plan de Railway (👤 confirmar plazo; objetivo ≤ 90 días). Las IPs **no** se truncan actualmente (la v1.0 lo afirmaba) |
| **Medidas de seguridad** | Acceso al panel de Railway restringido a la cuenta de Antonio |
| **Evaluación de riesgo** | Bajo (Medio hasta cerrar SEC-51) |
| **Responsable interno** | Equipo DevOps + Equipo Seguridad |

---

## AT-09 — Suscripciones y pagos (NO ACTIVO)

No hay integración de pagos (Stripe u otro) en el código. Si se activa: base jurídica Art. 6.1.b/6.1.c, retención fiscal de 5 años (Ley 58/2003), sin almacenar datos de tarjeta, proveedor PCI-DSS como encargado con DPA (👤), y actualización de este registro.

---

## AT-10 — Ejercicio de derechos RGPD

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Atender acceso, rectificación, supresión, portabilidad y demás derechos |
| **Categorías de interesados** | Usuarios y ex-usuarios |
| **Categorías de datos** | Datos de la solicitud; export completo Art. 15/20 vía `GET /user/me/export` (SEC-49); supresión vía `DELETE /user/me` con reautenticación, transaccional y con purga de Redis y revocación de tokens (SEC-48) |
| **Base jurídica** | Art. 6.1.c RGPD — Obligación legal |
| **Categoría especial** | Sí, el export incluye datos de salud |
| **Destinatarios** | Solo el propio interesado; equipo interno de privacidad |
| **Transferencias internacionales** | Ninguna adicional |
| **Plazo de retención** | Registro de solicitudes gestionadas por canal externo (email): 3 años para acreditar cumplimiento (👤 definir dónde se guarda) |
| **Medidas de seguridad** | Endpoints autenticados; reautenticación para la supresión |
| **Evaluación de riesgo** | Medio |
| **Responsable interno** | DPO / Antonio |

---

## AT-11 — Comunicaciones de servicio (email)

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Enviar OTP de verificación, recuperación de contraseña y avisos esenciales |
| **Categorías de interesados** | Usuarios registrados |
| **Categorías de datos** | Email, código OTP, enlace de reset |
| **Base jurídica** | Art. 6.1.b RGPD — Ejecución de contrato |
| **Categoría especial** | No (los correos no contienen datos de salud) |
| **Destinatarios / encargados** | Proveedor SMTP configurado en `SMTP_HOST` (por defecto Gmail SMTP — Google) |
| **Transferencias internacionales** | Google (EE. UU.) — 👤 confirmar proveedor definitivo y su DPA (Google Workspace/Gmail o Mailgun UE) |
| **Plazo de retención** | Según el proveedor (buzón de enviados) — 👤 configurar |
| **Medidas de seguridad** | TLS (STARTTLS); OTP de un solo uso y caducidad corta; SPF/DKIM/DMARC 👤 pendientes de verificar en el dominio definitivo (SEC-34) |
| **Evaluación de riesgo** | Bajo |
| **Responsable interno** | Equipo Backend |

---

## AT-12 — Control de uso y coste de IA

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Limitar el consumo de la API de IA por usuario y controlar costes (SEC-56) |
| **Categorías de datos** | `userId`, tipo de petición, tokens consumidos y coste (`TokenUsageLog`); contador diario en Redis con TTL |
| **Base jurídica** | Art. 6.1.f RGPD — Interés legítimo (prevención de abuso y sostenibilidad del servicio) |
| **Categoría especial** | No (no se guarda el contenido del prompt) |
| **Destinatarios / encargados** | Railway (PostgreSQL y Redis) |
| **Plazo de retención** | ⏳ Pendiente de definir en SEC-50 (propuesta: 12 meses agregados) |
| **Evaluación de riesgo** | Bajo |
| **Responsable interno** | Equipo IA |

---

## Retención de datos — estado real

| Dato | Retención objetivo | Estado |
|------|-------------------|--------|
| Cuenta y datos de salud | Vigencia de la cuenta; borrado inmediato y completo al suprimir la cuenta | ✅ SEC-48 |
| Caché de planes (Redis) | 24 h (TTL) | ✅ SEC-46/SEC-57 |
| Revocación de sesiones (Redis) | Vida del access token (TTL) | ✅ SEC-44 |
| Caché de búsqueda de alimentos (Redis) | 6 h (TTL), sin datos de usuario | ✅ |
| OTP, tokens de reset y refresh expirados/usados | Borrado diario | ⏳ SEC-50 (job pendiente) |
| Sesiones caducadas e IPs de sesión | ≤ 90 días | ⏳ SEC-50 |
| `TokenUsageLog` | 12 meses (propuesta) | ⏳ SEC-50 |
| Logs de Railway | ≤ 90 días | 👤 confirmar en Railway |
| Cuentas inactivas | Sin política | 👤 decidir plazo (p. ej. aviso y borrado tras 24 meses de inactividad) |

---

## Evaluación de Impacto en la Protección de Datos (EIPD)

Conforme al Art. 35 RGPD, la EIPD es **obligatoria** para AT-02 a AT-06 (datos de salud a gran escala y elaboración de perfiles con IA).

### Medidas de mitigación — estado real

| Riesgo identificado | Medida de mitigación | Estado |
|--------------------|---------------------|--------|
| Acceso no autorizado a datos de salud | JWT HS256 con algoritmo fijado, revocación por sesión, rate limiting, filtrado por `userId` | ✅ (SEC-32, SEC-43, SEC-44) |
| Secretos expuestos en el repositorio | Placeholders, escaneo de secretos en pre-commit y CI | ✅ SEC-42 · 👤 rotación SEC-25/SEC-26 |
| Tratamiento sin consentimiento válido | Consentimiento explícito validado en servidor | ✅ SEC-33 · ⏳ versionado/retirada SEC-47 |
| Transferencia de datos de salud a EE. UU. (Anthropic) | Minimización (sin identificadores directos), DPA + SCC | ⏳ 👤 DPA/SCC pendientes |
| Datos en caché | AES-256-GCM + HMAC, TTL 24 h, fail-closed | ✅ SEC-46 |
| Almacenamiento indefinido | Purga automática y política de retención | ⏳ SEC-50 |
| Salida de IA dañina para la salud | Validación de esquema y salvaguardas clínicas | ✅/⏳ SEC-36, SEC-37 |
| Fotos corporales expuestas | No se almacenan; URL https en lista blanca | ✅ SEC-64 |
| Logs con datos personales | Eliminar PII/OTP de los logs | ⏳ SEC-51 |
| Brecha de datos | `INCIDENT_RESPONSE.md` | Documentado; 👤 valorar si SEC-26 constituye incidente notificable (Art. 33) |
| Cifrado de columna de datos de salud | — | ❌ Riesgo aceptado (VUL-2026-006); revisar antes de producción |

### Conclusión de la EIPD
👤 **Pendiente de revalidación por Antonio.** La conclusión de la v1.0 ("riesgos residuales aceptables") se basaba en medidas que no estaban implementadas. No debe darse por válida hasta cerrar las tareas bloqueantes de `SECURITY_TASKS.md` y firmar los DPA de Railway y Anthropic.

---

## Encargados del tratamiento (Art. 28 RGPD)

| Encargado | Servicio | País / región | Contrato (DPA) | Garantías de transferencia | Estado |
|-----------|----------|---------------|----------------|----------------------------|--------|
| Railway Corp. | Backend, PostgreSQL, Redis (caché cifrada de planes, revocación de sesiones, cuotas), landing, logs | EE. UU. (empresa); región de los servicios 👤 por confirmar (seleccionar región UE si está disponible) | 👤 Pendiente | 👤 SCC / DPF pendientes de verificar | Activo |
| Anthropic PBC | Inferencia IA (Claude API) con datos de salud | EE. UU. | 👤 Pendiente de aceptar/archivar | 👤 SCC (DPA de Anthropic) o DPF pendientes | Activo |
| Google (Gmail SMTP) u otro proveedor SMTP | Envío de emails transaccionales | EE. UU. | 👤 Pendiente | 👤 Pendiente | Activo (proveedor por confirmar) |
| GitHub (Microsoft) | Repositorio de código y CI | EE. UU. | Términos estándar | DPF | Activo — **no debe contener datos personales ni secretos** (SEC-25/26/40) |
| Expo | Build de la app; push (no activo) | EE. UU. | 👤 Solo si se activan push | — | Build activo; push no activo |
| ~~Supabase~~ | — | — | — | — | **Eliminado** (`25f1359`) |
| ~~Redis Cloud~~ | — | — | — | — | **Nunca usado**: Redis está en Railway |
| ~~Stripe~~ | — | — | — | — | **No integrado** |

---

## Historial de Revisiones del RAT

| Versión | Fecha | Cambios | Responsable |
|---------|-------|---------|-------------|
| 1.0 | 18/04/2026 | Creación inicial del RAT | DPO |
| 2.0 | 19/10/2026 | Alineado con el sistema real (SEC-69 / SA-34): sin Supabase, Redis en Railway, Stripe y push no activos, Anthropic como transferencia internacional pendiente de DPA/SCC, retención real (SEC-50 pendiente), categorías Art. 9 reales, nueva AT-12 | Agente docs/security |

---

## Firma y Aprobación

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Responsable del Tratamiento | 👤 Antonio | — | Pendiente |
| Delegado de Protección de Datos | 👤 Por designar | — | Pendiente |

---

*Documento confidencial — Registro de Actividades de Tratamiento — Art. 30 RGPD — Versión 2.0 — 19 de octubre de 2026*
