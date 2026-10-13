# Política de Privacidad — Healthy

**Versión:** 1.0  
**Fecha de entrada en vigor:** 18 de abril de 2026  
**Responsable del tratamiento:** Healthy App S.L.  
**Contacto DPO:** privacy@healthy-app.es  

---

## 1. Identidad del Responsable del Tratamiento

| Campo | Detalle |
|-------|---------|
| **Denominación social** | Healthy App S.L. |
| **CIF** | B-XXXXXXXX |
| **Domicilio social** | [Dirección fiscal], España |
| **Correo electrónico** | privacy@healthy-app.es |
| **Delegado de Protección de Datos (DPO)** | dpo@healthy-app.es |

Healthy App S.L. está sujeta al **Reglamento (UE) 2016/679 (RGPD)**, a la **Ley Orgánica 3/2018 (LOPDGDD)** y, en lo que respecta a datos de salud, al **artículo 9 RGPD** sobre categorías especiales de datos.

---

## 2. Datos que Recogemos y Finalidad

### 2.1 Datos de registro y perfil

| Dato | Finalidad | Base jurídica | Retención |
|------|-----------|---------------|-----------|
| Correo electrónico | Identificación de cuenta | Ejecución de contrato (Art. 6.1.b) | Vigencia de la cuenta + 30 días |
| Contraseña (hash bcrypt) | Autenticación segura | Ejecución de contrato | Vigencia de la cuenta |
| Nombre o alias | Personalización de la app | Ejecución de contrato | Vigencia de la cuenta + 30 días |

### 2.2 Datos de salud (categoría especial — Art. 9 RGPD)

Los siguientes datos son **categoría especial** y solo se tratan con tu **consentimiento explícito**:

| Dato | Finalidad | Base jurídica | Retención |
|------|-----------|---------------|-----------|
| Edad, peso, altura | Generar plan personalizado de nutrición y entrenamiento | Consentimiento explícito (Art. 9.2.a) | Vigencia de la cuenta |
| Sexo biológico | Cálculo de métricas fisiológicas | Consentimiento explícito | Vigencia de la cuenta |
| Nivel de actividad física | Calibrar intensidad del plan | Consentimiento explícito | Vigencia de la cuenta |
| Objetivo de salud (perder peso, ganar músculo, etc.) | Personalizar recomendaciones IA | Consentimiento explícito | Vigencia de la cuenta |
| Registro de comidas y calorías | Seguimiento nutricional | Consentimiento explícito | Vigencia de la cuenta |
| Registro de entrenamientos | Seguimiento de rendimiento | Consentimiento explícito | Vigencia de la cuenta |
| Fotos de progreso (opcional) | Seguimiento visual del usuario | Consentimiento explícito | Vigencia de la cuenta |
| Historial de peso | Monitorizar evolución | Consentimiento explícito | Vigencia de la cuenta |

### 2.3 Datos técnicos

| Dato | Finalidad | Base jurídica | Retención |
|------|-----------|---------------|-----------|
| Dirección IP | Seguridad y detección de fraude | Interés legítimo (Art. 6.1.f) | 90 días |
| Logs de actividad (sin datos personales) | Diagnóstico técnico | Interés legítimo | 90 días |
| Identificador de dispositivo | Gestión de sesiones | Ejecución de contrato | Vigencia de la sesión |
| Token de push notifications | Envío de notificaciones | Consentimiento | Hasta revocación |

---

## 3. Inteligencia Artificial y Tratamiento Automatizado

Healthy utiliza la **API de Claude (Anthropic)** para generar planes personalizados de nutrición y entrenamiento. Este proceso implica:

- Envío de tus datos de salud (anonimizados y cifrados en tránsito) a la API de Anthropic.
- Generación automatizada de recomendaciones personalizadas.
- **No se producen decisiones con efectos jurídicos** basadas exclusivamente en tratamiento automatizado (Art. 22 RGPD).

Puedes solicitar en cualquier momento **intervención humana** en las recomendaciones generadas por IA contactando a privacy@healthy-app.es.

---

## 4. Destinatarios y Transferencias Internacionales

| Proveedor | Servicio | País | Garantía |
|-----------|----------|------|----------|
| Supabase | Autenticación | UE (Frankfurt) | Art. 46 RGPD — Cláusulas tipo |
| Railway | Infraestructura cloud (servidores y base de datos) | Pendiente de confirmar | Pendiente de confirmar |
| Anthropic | Procesamiento IA (Claude API) | EE.UU. | Cláusulas Contractuales Tipo (SCCs) |
| Redis Cloud | Caché de sesiones | UE | Art. 46 RGPD |

**No vendemos ni cedemos tus datos a terceros** con fines comerciales o publicitarios.

---

## 5. Derechos del Usuario

Puedes ejercer los siguientes derechos enviando un correo a **privacy@healthy-app.es** con copia de tu DNI/NIE:

| Derecho | Descripción | Plazo de respuesta |
|---------|-------------|-------------------|
| **Acceso** (Art. 15) | Obtener copia de todos tus datos | 30 días |
| **Rectificación** (Art. 16) | Corregir datos inexactos | 30 días |
| **Supresión / Olvido** (Art. 17) | Borrado completo de tu cuenta y datos | 30 días |
| **Oposición** (Art. 21) | Oponerte al tratamiento basado en interés legítimo | 30 días |
| **Portabilidad** (Art. 20) | Recibir tus datos en formato estructurado (JSON/CSV) | 30 días |
| **Limitación** (Art. 18) | Suspender el tratamiento mientras se resuelve una reclamación | 30 días |
| **No decisión automatizada** (Art. 22) | Solicitar intervención humana en decisiones de IA | 30 días |
| **Retirar consentimiento** | En cualquier momento, sin efecto retroactivo | Inmediato |

Si consideras que tus derechos no han sido atendidos, puedes **presentar una reclamación ante la AEPD**: [www.aepd.es](https://www.aepd.es)

---

## 6. Seguridad de los Datos

Aplicamos las siguientes medidas técnicas y organizativas:

- **Cifrado en tránsito:** HTTPS/TLS 1.3 en todas las comunicaciones.
- **Cifrado en reposo:** según las garantías del proveedor de infraestructura (Railway) — pendiente de confirmar.
- **Contraseñas:** Hashing con bcrypt (mínimo 12 rounds). Nunca almacenamos contraseñas en texto plano.
- **Autenticación:** JWT con algoritmo RS256 y expiración de 15 minutos (refresh token: 7 días).
- **Fotos de progreso:** Almacenamiento privado, acceso por URLs pre-firmadas de corta duración.
- **Sesiones en caché:** Redis con TTL configurado; datos sin información personal identificable.
- **App móvil:** Tokens almacenados exclusivamente en SecureStore (nunca en AsyncStorage).
- **Rate limiting:** Protección ante ataques de fuerza bruta en endpoints de autenticación.
- **Acceso interno:** Principio de mínimo privilegio. Acceso a datos de salud restringido y auditado.

---

## 7. Datos de Menores

Healthy **no está dirigida a menores de 16 años**. No recogemos conscientemente datos de menores. Si detectamos que un usuario es menor de 16 años, procederemos a eliminar su cuenta y datos de forma inmediata.

Si eres padre/madre/tutor y crees que tu hijo/a ha creado una cuenta, contacta a privacy@healthy-app.es.

---

## 8. Cookies y Tecnologías Similares

La app móvil no utiliza cookies. En nuestra web corporativa utilizamos:

- **Cookies técnicas esenciales:** Necesarias para el funcionamiento (base jurídica: interés legítimo).
- **Cookies analíticas:** Solo con tu consentimiento previo.

Puedes gestionar las preferencias de cookies en la configuración de tu navegador.

---

## 9. Retención y Borrado de Datos

- Los datos se conservan mientras la cuenta esté activa.
- Tras la eliminación de cuenta: **borrado completo en 30 días naturales** (incluyendo backups).
- Logs técnicos anonimizados: **máximo 90 días**.
- Datos requeridos por obligación legal (ej. facturación): **5 años** según legislación fiscal española.

---

## 10. Actualizaciones de esta Política

Podemos actualizar esta política por cambios legales o de producto. Te notificaremos por correo electrónico con **al menos 15 días de antelación** ante cambios materiales. La versión en vigor siempre estará disponible en la app.

---

## 11. Contacto

- **Consultas generales de privacidad:** privacy@healthy-app.es  
- **Delegado de Protección de Datos:** dpo@healthy-app.es  
- **Ejercicio de derechos:** privacy@healthy-app.es (plazo: 30 días)  
- **Reclamaciones ante autoridad de control:** [AEPD](https://www.aepd.es) — Agencia Española de Protección de Datos  

---

*Documento generado el 18 de abril de 2026 — Healthy App S.L.*
