# Resumen ejecutivo de seguridad — Healthy

**Destinatarios:** dirección, inversores, responsable legal, DPO  
**Fecha:** 2026-06-07  
**Preparado por:** Security Agent (AI Studio) / Docs Agent  
**Fuente:** `security/SECURITY_AUDIT.md` v1.0

---

## Estado actual: WARN (no crítico)

La aplicación Healthy ha superado la auditoría de seguridad interna sin hallazgos críticos que pongan en riesgo los datos de los usuarios en este momento. La arquitectura base de seguridad es sólida. Sin embargo, **existen cuatro deficiencias de cumplimiento legal (RGPD) que bloquean el lanzamiento en la Unión Europea** y deben resolverse antes de ninguna publicación en tiendas de aplicaciones o apertura a usuarios reales.

---

## Lo que bloquea el lanzamiento

Los cuatro puntos siguientes son **obligaciones legales directas** del RGPD europeo y de la ley española de protección de datos (LOPDGDD). No son mejoras opcionales. Su ausencia expone a la empresa a sanciones de hasta **20 millones de euros o el 4% del volumen de negocio anual**, y puede resultar en la retirada forzosa de la aplicación de las tiendas.

### 1. Falta el derecho al olvido (Art. 17 RGPD)

**Qué significa:** cualquier usuario tiene derecho a solicitar que se borren todos sus datos de nuestra plataforma de forma completa e irreversible.

**Estado actual:** no existe ningún mecanismo para que el usuario elimine su cuenta. Sus datos (historial de entrenamiento, medidas corporales, condiciones de salud, fotos de progreso) permanecerían indefinidamente en nuestra base de datos aunque dejara de usar la aplicación.

**Qué hay que hacer:** implementar un endpoint de eliminación de cuenta que borre en cascada todos los datos del usuario. La base de datos ya tiene las relaciones definidas correctamente para soportarlo; solo falta la funcionalidad en la API.

### 2. Falta la portabilidad de datos (Art. 20 RGPD)

**Qué significa:** cualquier usuario tiene derecho a recibir todos sus datos en un formato legible por máquina (JSON o CSV) para poder llevarlos a otro servicio.

**Estado actual:** no existe ningún mecanismo de exportación. Un usuario no puede obtener su historial de entrenamiento, su progreso corporal ni su plan de nutrición en un formato portable.

**Qué hay que hacer:** implementar un endpoint de exportación que genere un archivo con todos los datos del usuario.

### 3. El consentimiento para datos de salud no se registra (Art. 9 RGPD)

**Qué significa:** los datos de salud (enfermedades, lesiones, alergias, medidas corporales, fotos corporales) son datos de "categoría especial" que requieren un **consentimiento explícito, informado e inequívoco** del usuario. Y ese consentimiento debe quedar registrado en nuestra base de datos con fecha y hora.

**Estado actual:** aunque la aplicación recoge condiciones de salud durante el onboarding, no registra en ningún lado que el usuario ha dado ese consentimiento explícito. Si la AEPD (Agencia Española de Protección de Datos) nos solicitara demostrar que tenemos ese consentimiento, no podríamos hacerlo.

**Qué hay que hacer:** añadir un paso de consentimiento explícito en el onboarding (antes de introducir datos de salud) y registrar la fecha y hora de ese consentimiento en la base de datos.

### 4. No se verifica la edad mínima (Art. 8 RGPD / LOPDGDD Art. 7)

**Qué significa:** en España, los menores de 14 años no pueden registrarse en servicios digitales sin consentimiento parental. Para servicios que tratan datos de salud, el umbral es 16 años.

**Estado actual:** la aplicación recoge la fecha de nacimiento durante el onboarding pero no verifica si el usuario tiene la edad mínima requerida. Un menor de 14 años podría registrarse sin ningún obstáculo.

**Qué hay que hacer:** validar la edad durante el registro y rechazar o requerir consentimiento parental según corresponda.

---

## Qué está bien implementado

La auditoría confirma que los fundamentos de seguridad técnica están correctamente implementados:

- **Contraseñas:** cifradas con bcrypt a 12 rondas (nivel bancario). Las contraseñas nunca se almacenan en texto plano.
- **Tokens de sesión:** los tokens de acceso expiran en 15 minutos. Los de refresco, en 30 días. Al hacer logout, los tokens quedan invalidados inmediatamente en servidor.
- **Protección contra ataques automatizados:** los endpoints de registro, login y recuperación de contraseña tienen límite de intentos (5 por 15 minutos por dirección IP).
- **Prevención de inyección SQL:** el uso del ORM Prisma garantiza que ninguna consulta a la base de datos puede ser manipulada por inputs maliciosos.
- **Comunicaciones cifradas:** toda la comunicación entre la app y el servidor va por HTTPS.
- **Separación de entornos:** las credenciales y secretos se gestionan por variables de entorno, nunca incluidas en el código fuente.
- **Protocolo de incidentes:** existe un protocolo documentado para notificar a la AEPD en menos de 72 horas en caso de brecha de datos, conforme al Art. 33 RGPD.
- **DPO designado:** el Delegado de Protección de Datos está identificado (dpo@healthy-app.es) y documentado en la política de privacidad.

---

## Plan de acción

### Prioridad 1 — Bloqueantes legales (antes del lanzamiento)

| Tarea | Responsable | Estimación |
|-------|-------------|------------|
| Implementar `DELETE /account` (derecho al olvido) | Equipo Backend | 1-2 días |
| Implementar `GET /account/export` (portabilidad) | Equipo Backend | 1-2 días |
| Añadir paso de consentimiento en onboarding + registro en BD | Equipo Backend + Frontend | 2-3 días |
| Validar edad mínima en onboarding (>= 14 con parental, >= 16 sin él) | Equipo Backend | 1 día |

**Tiempo total estimado:** 5-8 días de desarrollo.

### Prioridad 2 — Riesgo económico (antes del lanzamiento)

| Tarea | Responsable | Estimación |
|-------|-------------|------------|
| Limitar regeneraciones de plan: máx. 3/hora por usuario | Equipo Backend | 1 día |

Sin este límite, un usuario malintencionado podría solicitar regeneraciones de plan en bucle, agotando el presupuesto de IA de la empresa en cuestión de horas.

### Prioridad 3 — Mejoras de hardening (antes de escalar a producción)

| Tarea | Responsable | Estimación |
|-------|-------------|------------|
| Reemplazar generador de códigos OTP por versión criptográficamente segura | Equipo Backend | 2 horas |
| Configurar cabeceras de seguridad HTTP más restrictivas | Equipo Backend | 4 horas |
| Configurar CORS para rechazar peticiones de orígenes desconocidos en producción | Equipo Backend | 2 horas |
| Cifrar campos de datos de salud sensibles en base de datos | Equipo Backend + BD | 3-5 días |

### Prioridad 4 — Mejoras a medio plazo

- Migrar el limitador de peticiones a Redis compartido (necesario si se despliegan múltiples instancias del servidor)
- Especificar explícitamente el algoritmo de firma de tokens JWT
- Reducir la expiración del enlace de recuperación de contraseña de 24h a 1h (estándar de la industria)
- Proteger el endpoint de health check con autenticación básica en producción

---

## Resumen para toma de decisiones

La aplicación puede continuar en desarrollo y pruebas internas sin riesgo. Sin embargo, **no puede abrirse a usuarios reales ni publicarse en App Store o Google Play** hasta que se resuelvan los cuatro bloqueantes legales de la Prioridad 1.

El tiempo estimado para resolverlos es de **5-8 días de trabajo del equipo backend y frontend**. Una vez completados y auditados, la aplicación estaría en condiciones de solicitar revisión en las tiendas.

Para cualquier duda técnica sobre los hallazgos, el informe completo está disponible en `security/SECURITY_AUDIT.md` y el registro de vulnerabilidades en `security/VULNERABILITIES.md`.

---

*Última actualización: 2026-06-07 — Docs Agent*  
*Contacto DPO: dpo@healthy-app.es*  
*Canal de reporte de vulnerabilidades: security@healthy-app.es*
