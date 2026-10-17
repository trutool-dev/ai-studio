# Registro de Actividades de Tratamiento (RAT) — Healthy

**Documento:** Registro de Actividades de Tratamiento  
**Artículo de referencia:** Art. 30 RGPD (Reglamento UE 2016/679)  
**Responsable del tratamiento:** Healthy App S.L.  
**DPO:** dpo@healthy-app.es  
**Versión:** 1.0  
**Fecha:** 18 de abril de 2026  
**Próxima revisión:** 18 de abril de 2027  

---

## Índice de Actividades de Tratamiento

| ID | Actividad | Categoría de datos | Base jurídica | Riesgo |
|----|-----------|-------------------|---------------|--------|
| AT-01 | Registro y autenticación de usuarios | Datos identificativos | Contrato | Medio |
| AT-02 | Onboarding y perfil de salud | Datos de salud (especiales) | Consentimiento | Alto |
| AT-03 | Generación de planes personalizados con IA | Datos de salud (especiales) | Consentimiento | Alto |
| AT-04 | Seguimiento nutricional diario | Datos de salud (especiales) | Consentimiento | Alto |
| AT-05 | Seguimiento de entrenamientos | Datos de salud (especiales) | Consentimiento | Alto |
| AT-06 | Gestión de fotos de progreso | Datos de salud (especiales) + imagen | Consentimiento | Alto |
| AT-07 | Notificaciones push | Datos de contacto técnico | Consentimiento | Bajo |
| AT-08 | Logs técnicos y seguridad | Datos técnicos | Interés legítimo | Bajo |
| AT-09 | Gestión de suscripciones y pagos | Datos financieros | Contrato | Medio |
| AT-10 | Ejercicio de derechos RGPD | Datos identificativos + historial | Obligación legal | Medio |
| AT-11 | Comunicaciones de servicio | Correo electrónico | Contrato | Bajo |

---

## AT-01 — Registro y Autenticación de Usuarios

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Crear y gestionar la cuenta del usuario; verificar identidad en cada sesión |
| **Categorías de interesados** | Usuarios registrados de la App |
| **Categorías de datos** | Correo electrónico, contraseña (hash bcrypt), nombre/alias, fecha de registro, token de sesión JWT |
| **Base jurídica** | Art. 6.1.b RGPD — Ejecución de contrato |
| **Categoría especial** | No |
| **Destinatarios** | Supabase (proveedor de autenticación), infraestructura Railway |
| **Transferencias internacionales** | Supabase — UE (Frankfurt); cláusulas contractuales tipo Art. 46 RGPD |
| **Plazo de retención** | Vigencia de la cuenta + 30 días tras eliminación |
| **Medidas de seguridad** | bcrypt 12 rounds, JWT RS256, rate limiting en login (5 intentos/15 min), HTTPS/TLS 1.3 |
| **Evaluación de riesgo** | Medio — riesgo de acceso no autorizado mitigado con MFA opcional y rate limiting |
| **Responsable interno** | Equipo Backend |

---

## AT-02 — Onboarding y Perfil de Salud

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Recoger el perfil físico y objetivos del usuario para generar un plan personalizado |
| **Categorías de interesados** | Usuarios que completan el onboarding |
| **Categorías de datos** | Edad, sexo biológico, peso actual, altura, nivel de actividad física (sedentario/moderado/activo/muy activo), objetivo principal (perder peso, ganar músculo, mantenimiento, salud general), condiciones de salud relevantes declaradas voluntariamente |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito para datos de categoría especial |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios** | Infraestructura Railway (PostgreSQL); Anthropic Claude API para generación del plan inicial |
| **Transferencias internacionales** | Anthropic (EE.UU.) — Cláusulas Contractuales Tipo (SCCs) vigentes |
| **Plazo de retención** | Vigencia de la cuenta; borrado completo en 30 días tras eliminación |
| **Medidas de seguridad** | Cifrado en reposo del proveedor (Railway, pendiente de confirmar); cifrado en tránsito TLS 1.3; anonimización parcial en envío a API de IA; acceso restringido por rol interno |
| **Evaluación de riesgo** | **Alto** — datos de salud categoría especial. EIPD realizada (ver sección EIPD) |
| **Responsable interno** | Equipo Backend + Equipo IA |

---

## AT-03 — Generación de Planes Personalizados con IA

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Usar IA para generar planes de nutrición y entrenamiento adaptados al perfil del usuario |
| **Categorías de interesados** | Todos los usuarios activos |
| **Categorías de datos** | Perfil de salud completo (AT-02), historial de progreso, registros de comidas, registros de entrenamientos |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito; complementado por Art. 6.1.b (ejecución del servicio contratado) |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios** | Anthropic (Claude API) — procesamiento de inferencia IA |
| **Transferencias internacionales** | Anthropic (EE.UU.) — SCCs; los datos se envían cifrados y con identificadores pseudoanonimizados |
| **Plazo de retención** | Los planes generados se conservan durante la vigencia de la cuenta; Anthropic no retiene datos de usuario según su política de API |
| **Medidas de seguridad** | Pseudoanonimización antes del envío a la API; no se envían nombre ni correo a la IA; TLS 1.3; auditoría de prompts enviados |
| **Decisión automatizada** | Sí, con posibilidad de revisión humana a petición del usuario (Art. 22.3 RGPD) |
| **Evaluación de riesgo** | **Alto** — implicaciones en salud del usuario. Plan de mitigación: disclaimer médico en la App, posibilidad de intervención humana |
| **Responsable interno** | Equipo IA |

---

## AT-04 — Seguimiento Nutricional Diario

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Permitir al usuario registrar comidas y calorías; ajustar el plan nutricional basándose en el progreso |
| **Categorías de interesados** | Usuarios que usan el módulo de nutrición |
| **Categorías de datos** | Registro de alimentos consumidos (nombre, cantidad, macronutrientes, calorías), fecha y hora del registro, adherencia al plan nutricional |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios** | PostgreSQL en Railway (almacenamiento principal); Anthropic Claude API (ajuste dinámico del plan) |
| **Transferencias internacionales** | Anthropic (EE.UU.) — SCCs |
| **Plazo de retención** | Vigencia de la cuenta + 30 días |
| **Medidas de seguridad** | Cifrado AES-256 en reposo; TLS 1.3 en tránsito; acceso autenticado por JWT |
| **Evaluación de riesgo** | Alto — historial alimentario revela hábitos sensibles de salud |
| **Responsable interno** | Equipo Backend |

---

## AT-05 — Seguimiento de Entrenamientos

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Registrar sesiones de entrenamiento y evolución del rendimiento físico del usuario |
| **Categorías de interesados** | Usuarios que usan el módulo de entrenamiento |
| **Categorías de datos** | Tipo de ejercicio, series, repeticiones, peso utilizado, duración, frecuencia cardíaca (si disponible), fecha y hora, percepción subjetiva del esfuerzo |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito |
| **Categoría especial** | **SÍ — Datos de salud (Art. 9 RGPD)** |
| **Destinatarios** | PostgreSQL en Railway; Anthropic Claude API (ajuste del plan) |
| **Transferencias internacionales** | Anthropic (EE.UU.) — SCCs |
| **Plazo de retención** | Vigencia de la cuenta + 30 días |
| **Medidas de seguridad** | Cifrado AES-256; TLS 1.3; autenticación JWT por sesión |
| **Evaluación de riesgo** | Alto — datos de rendimiento físico son categoría especial de salud |
| **Responsable interno** | Equipo Backend |

---

## AT-06 — Gestión de Fotos de Progreso

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Permitir al usuario documentar visualmente su evolución física (funcionalidad opcional) |
| **Categorías de interesados** | Usuarios que voluntariamente activan esta funcionalidad |
| **Categorías de datos** | Imágenes fotográficas del cuerpo del usuario, fecha de captura, metadatos EXIF (eliminados automáticamente al subir) |
| **Base jurídica** | Art. 9.2.a RGPD — Consentimiento explícito específico para esta funcionalidad |
| **Categoría especial** | **SÍ — Imágenes reveladoras de estado de salud (Art. 9 RGPD)** |
| **Destinatarios** | Almacenamiento de objetos privado (proveedor pendiente de definir) |
| **Transferencias internacionales** | Pendiente — depende del proveedor de almacenamiento elegido |
| **Plazo de retención** | Vigencia de la cuenta; borrado inmediato si el usuario elimina la foto o la cuenta |
| **Medidas de seguridad** | Almacenamiento privado (sin acceso público); URLs pre-firmadas con expiración de 15 minutos; metadatos EXIF eliminados en upload; cifrado en reposo; acceso solo por usuario propietario (validación JWT) |
| **Evaluación de riesgo** | **Muy Alto** — imágenes corporales sensibles. No se procesan por IA. Acceso exclusivo del usuario. |
| **Responsable interno** | Equipo Backend + Equipo DevOps |

---

## AT-07 — Notificaciones Push

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Enviar recordatorios de comidas, entrenamientos y logros al usuario |
| **Categorías de interesados** | Usuarios que otorgan permiso de notificaciones |
| **Categorías de datos** | Token de dispositivo para push notifications (Expo Push Token) |
| **Base jurídica** | Art. 6.1.a RGPD — Consentimiento |
| **Categoría especial** | No |
| **Destinatarios** | Expo Push Notification Service (intermediario técnico) |
| **Transferencias internacionales** | Expo (EE.UU.) — SCCs; el token es un identificador técnico, no dato de salud |
| **Plazo de retención** | Hasta revocación del consentimiento o eliminación de cuenta |
| **Medidas de seguridad** | Token almacenado en Redis con TTL; no incluir datos de salud en el contenido de las notificaciones |
| **Evaluación de riesgo** | Bajo |
| **Responsable interno** | Equipo Backend |

---

## AT-08 — Logs Técnicos y Seguridad

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Monitorizar el funcionamiento de la App, detectar errores y prevenir accesos no autorizados |
| **Categorías de interesados** | Todos los usuarios (de forma anónima o pseudoanonimizada) |
| **Categorías de datos** | Dirección IP (truncada a /24 para anonimización), timestamp, endpoint accedido, código de respuesta HTTP, identificador de sesión (no el JWT completo), user-agent |
| **Base jurídica** | Art. 6.1.f RGPD — Interés legítimo (seguridad del servicio) |
| **Categoría especial** | No |
| **Destinatarios** | Infraestructura Railway (logs del servicio) |
| **Transferencias internacionales** | Railway (región pendiente de confirmar) |
| **Plazo de retención** | 90 días; rotación automática |
| **Medidas de seguridad** | Los logs **no contienen datos de salud ni contenido de las peticiones**; IPs truncadas; acceso restringido al equipo de seguridad y DevOps |
| **Evaluación de riesgo** | Bajo |
| **Responsable interno** | Equipo DevOps + Equipo Seguridad |

---

## AT-09 — Gestión de Suscripciones y Pagos

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Gestionar el acceso Premium y procesar pagos recurrentes |
| **Categorías de interesados** | Usuarios con suscripción de pago |
| **Categorías de datos** | Correo electrónico, historial de suscripción (plan, fecha inicio/fin), identificador de pago externo (token Stripe, nunca datos de tarjeta completos) |
| **Base jurídica** | Art. 6.1.b RGPD — Ejecución de contrato; Art. 6.1.c — Obligación legal (facturación) |
| **Categoría especial** | No |
| **Destinatarios** | Stripe (procesador de pagos) |
| **Transferencias internacionales** | Stripe (EE.UU.) — SCCs; Stripe es PCI-DSS Level 1 certificado |
| **Plazo de retención** | 5 años (obligación fiscal española — Ley 58/2003 General Tributaria) |
| **Medidas de seguridad** | Nunca almacenamos datos de tarjeta; solo token de Stripe; TLS 1.3 |
| **Evaluación de riesgo** | Medio |
| **Responsable interno** | Equipo Backend |

---

## AT-10 — Ejercicio de Derechos RGPD

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Gestionar solicitudes de acceso, rectificación, supresión, portabilidad y demás derechos |
| **Categorías de interesados** | Cualquier usuario o ex-usuario que ejerza sus derechos |
| **Categorías de datos** | Datos identificativos de la solicitud (correo, copia de DNI/NIE), naturaleza de la solicitud, historial de gestión de la misma |
| **Base jurídica** | Art. 6.1.c RGPD — Obligación legal (cumplimiento de derechos RGPD) |
| **Categoría especial** | Posible, si la solicitud afecta a datos de salud |
| **Destinatarios** | Solo equipo interno de privacidad (DPO) |
| **Transferencias internacionales** | Ninguna |
| **Plazo de retención** | 3 años desde resolución (para acreditar cumplimiento ante la AEPD) |
| **Medidas de seguridad** | Buzón de correo cifrado; acceso restringido al DPO; registro de todas las solicitudes y resoluciones |
| **Evaluación de riesgo** | Medio |
| **Responsable interno** | DPO / Equipo Legal |

---

## AT-11 — Comunicaciones de Servicio

| Campo | Detalle |
|-------|---------|
| **Finalidad** | Enviar notificaciones transaccionales (confirmación de registro, cambio de contraseña, cambios en los Términos) |
| **Categorías de interesados** | Usuarios registrados |
| **Categorías de datos** | Correo electrónico, nombre/alias, idioma preferido |
| **Base jurídica** | Art. 6.1.b RGPD — Ejecución de contrato (comunicaciones esenciales del servicio) |
| **Categoría especial** | No |
| **Destinatarios** | Proveedor de envío de correo transaccional (Gmail SMTP — Google) |
| **Transferencias internacionales** | Google (Gmail SMTP) — revisar ubicación de datos y DPA |
| **Plazo de retención** | Vigencia de la cuenta |
| **Medidas de seguridad** | Los correos no contienen datos de salud; SPF, DKIM y DMARC configurados |
| **Evaluación de riesgo** | Bajo |
| **Responsable interno** | Equipo Backend |

---

## Evaluación de Impacto en la Protección de Datos (EIPD)

Conforme al Art. 35 RGPD, se ha realizado una EIPD para los tratamientos de **categoría especial de datos de salud** (AT-02, AT-03, AT-04, AT-05, AT-06).

### Criterios que activan la obligación de EIPD
- ✅ Tratamiento a gran escala de datos de categoría especial (Art. 35.3.b)
- ✅ Evaluación sistemática de personas mediante perfiles automatizados (IA)
- ✅ Datos de salud de usuarios (categoría especial Art. 9)

### Medidas de mitigación implementadas

| Riesgo identificado | Medida de mitigación | Estado |
|--------------------|---------------------|--------|
| Acceso no autorizado a datos de salud | JWT RS256 + RBAC + cifrado AES-256 | Implementado |
| Filtración de datos en tránsito hacia IA | Pseudoanonimización + TLS 1.3 | Implementado |
| Almacenamiento indefinido de datos sensibles | TTL automático + política de retención | Implementado |
| Decisiones de salud automatizadas sin supervisión | Disclaimer médico + opción de revisión humana | Implementado |
| Fotos corporales expuestas | Almacenamiento privado + URLs pre-firmadas 15 min | Pendiente — proveedor por definir |
| Logs con datos de salud | Logs solo técnicos, sin payload de datos | Implementado |
| Brecha de datos masiva | Protocolo INCIDENT_RESPONSE.md activo | Documentado |

### Conclusión de la EIPD
El tratamiento es necesario y proporcional. Los riesgos residuales son aceptables dadas las medidas implementadas. Se procede al tratamiento.

**Fecha de la EIPD:** 18 de abril de 2026  
**Próxima revisión de la EIPD:** Ante cualquier cambio sustancial en el tratamiento o cada 2 años.

---

## Subencargados del Tratamiento (Art. 28 RGPD)

| Subencargado | Servicio | País | Contrato firmado | Garantías |
|-------------|----------|------|-----------------|-----------|
| Supabase | Autenticación y gestión de usuarios | UE (Frankfurt) | ✅ DPA firmado | SCCs Art. 46 |
| Railway | Infraestructura cloud (backend, PostgreSQL, Redis, landing) | Pendiente de confirmar | ⏳ DPA pendiente | Pendiente — Railway es empresa de EEUU |
| Anthropic | Procesamiento IA (Claude API) | EE.UU. | ✅ DPA firmado | SCCs vigentes |
| Redis Cloud | Caché de sesiones | UE | ✅ DPA firmado | SCCs Art. 46 |
| Stripe | Procesamiento de pagos | EE.UU. | ✅ DPA firmado | SCCs + PCI-DSS L1 |
| Expo | Push notifications | EE.UU. | ✅ DPA firmado | SCCs |

---

## Historial de Revisiones del RAT

| Versión | Fecha | Cambios | Responsable |
|---------|-------|---------|-------------|
| 1.0 | 18/04/2026 | Creación inicial del RAT | DPO |

---

## Firma y Aprobación

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| Responsable del Tratamiento | CEO — Healthy App S.L. | 18/04/2026 | Pendiente |
| Delegado de Protección de Datos | DPO | 18/04/2026 | Pendiente |

---

*Documento confidencial — Registro de Actividades de Tratamiento — Art. 30 RGPD*  
*Healthy App S.L. — Versión 1.0 — 18 de abril de 2026*
