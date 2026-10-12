# Protocolo de Respuesta ante Incidentes de Seguridad — Healthy

**Versión:** 1.0  
**Fecha:** 2026-06-07  
**Responsable:** Equipo de Seguridad / DPO  
**Base legal:** RGPD Art. 33-34, LOPDGDD Art. 37-38  

---

## Marco Legal

| Obligación | Plazo | Base legal |
|---|---|---|
| Notificación a la AEPD | 72 horas desde detección | RGPD Art. 33 |
| Notificación a usuarios afectados (si riesgo alto) | Sin dilación indebida | RGPD Art. 34 |
| Documentación interna del incidente | Obligatoria, sin plazo fijo | RGPD Art. 33.5 |

---

## 1. Detección y Contención (Objetivo: < 1 hora desde la detección)

### 1.1 Canales de detección
- Alertas automáticas del sistema de monitoreo (logs de errores, picos de tráfico)
- Reporte de usuario o tercero
- Notificación de proveedor de infraestructura (AWS, Supabase)
- Resultado de auditoría de seguridad periódica
- Bug bounty / responsible disclosure (ver `VULNERABILITIES.md`)

### 1.2 Acciones inmediatas (primeros 60 minutos)

**Paso 1 — Confirmar el incidente (15 min)**
- [ ] Verificar que es un incidente real y no un falso positivo
- [ ] Identificar el sistema/componente afectado
- [ ] Asignar un responsable del incidente (Incident Manager)
- [ ] Abrir canal de comunicación de emergencia (chat/llamada) con el equipo core

**Paso 2 — Contención inmediata (30 min)**
- [ ] Si hay acceso no autorizado activo: revocar tokens de sesión afectados en Redis (`redis.del session:*`)
- [ ] Si hay exfiltración de base de datos: rotar credenciales `DATABASE_URL` e invalidar conexiones
- [ ] Si hay compromiso de JWT_SECRET: rotar el secreto, invalidar TODAS las sesiones activas
- [ ] Si hay abuso de API de IA: rotar `ANTHROPIC_API_KEY` y establecer límite de gasto en Anthropic Console
- [ ] Si hay acceso a almacenamiento de fotos: revocar acceso al bucket S3/Supabase Storage
- [ ] Documentar acciones tomadas con timestamp exacto

**Paso 3 — Preservar evidencias (15 min)**
- [ ] Capturar y guardar en lugar seguro: logs de acceso, logs de aplicación, logs de BD
- [ ] No borrar ni modificar ningún log hasta completar la investigación
- [ ] Registrar: IPs origen, user agents, timestamps, endpoints accedidos, volumen de datos

---

## 2. Evaluación del Alcance

### 2.1 Preguntas para evaluar el alcance

1. **¿Qué datos se han visto comprometidos?**
   - Credenciales (email + hash de contraseña)
   - Datos de perfil (nombre, fecha de nacimiento, teléfono)
   - Datos de salud Art. 9 (condiciones médicas, medidas corporales)
   - Fotos de progreso
   - Tokens de sesión activos
   - Datos de uso de IA (prompts con datos de salud)

2. **¿Cuántos usuarios están afectados?**
   - < 100 usuarios: bajo impacto
   - 100-1.000 usuarios: impacto medio
   - > 1.000 usuarios: alto impacto — escalar inmediatamente

3. **¿El acceso fue de lectura o también escritura/modificación/borrado?**

4. **¿El incidente está contenido o sigue activo?**

5. **¿Hay indicios de publicación de datos en internet?**

### 2.2 Clasificación del incidente

| Nivel | Criterio | Acción |
|---|---|---|
| NIVEL 1 — Bajo | < 100 usuarios, solo datos no sensibles, contenido | Notificación AEPD, documentación interna |
| NIVEL 2 — Medio | 100-1.000 usuarios, datos personales básicos | Notificación AEPD + evaluación de notificación a usuarios |
| NIVEL 3 — Alto | Datos de salud (Art. 9), > 1.000 usuarios, fotos, contraseñas | Notificación AEPD + notificación obligatoria a usuarios |
| NIVEL 4 — Crítico | Brecha masiva, datos publicados, daño activo en curso | Notificación AEPD + usuarios + posible paralización del servicio |

---

## 3. Notificación a la AEPD (< 72 horas — RGPD Art. 33)

### 3.1 Canal de notificación
- **Portal AEPD:** https://sedeagpd.gob.es (Sede Electrónica AEPD)
- **Formulario:** Notificación de violaciones de seguridad de datos personales
- **Teléfono consultas:** 901 100 099

### 3.2 Plazo y exención

La notificación es OBLIGATORIA a menos que la brecha **no suponga un riesgo para los derechos y libertades** de los afectados. En caso de duda, notificar siempre.

Si no se dispone de toda la información en las 72 horas, se puede notificar con la información disponible e ir completando.

### 3.3 Plantilla de notificación a la AEPD

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NOTIFICACIÓN DE VIOLACIÓN DE SEGURIDAD — RGPD Art. 33
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATOS DEL RESPONSABLE DEL TRATAMIENTO
--------------------------------------
Entidad: Healthy App S.L.
CIF: B-XXXXXXXX
Dirección: [Dirección fiscal]
Representante: [Nombre del representante legal]
DPO: dpo@healthy-app.es
Teléfono de contacto: [PLACEHOLDER]

DESCRIPCIÓN DE LA VIOLACIÓN
------------------------------
Fecha y hora de detección: [AAAA-MM-DD HH:MM UTC+1]
Fecha y hora estimada del inicio del incidente: [AAAA-MM-DD HH:MM UTC+1 o "Desconocida"]
Naturaleza de la violación:
  [ ] Confidencialidad (acceso no autorizado)
  [ ] Integridad (modificación no autorizada)
  [ ] Disponibilidad (destrucción/pérdida de acceso)

DATOS AFECTADOS
----------------
Categorías de datos afectados:
  [ ] Datos identificativos (nombre, email, teléfono)
  [ ] Contraseñas (hash bcrypt)
  [ ] Datos de salud (condiciones médicas, medidas corporales)
  [ ] Datos biométricos (fotografías)
  [ ] Datos de comportamiento (historial de entrenamiento/nutrición)
  [ ] Tokens de sesión

Número aproximado de interesados afectados: [N]
Número aproximado de registros afectados: [N]

POSIBLES CONSECUENCIAS
------------------------
[Descripción de las consecuencias probables para los usuarios afectados]

MEDIDAS ADOPTADAS O PROPUESTAS
---------------------------------
Medidas de contención tomadas hasta la fecha:
  1. [Medida 1 — ej. revocación de tokens de sesión]
  2. [Medida 2 — ej. rotación de credenciales de BD]
  3. [Medida 3 — ej. bloqueo temporal del servicio]

Medidas previstas para mitigar los efectos:
  1. [Medida futura 1]
  2. [Medida futura 2]

NOTIFICACIÓN A LOS INTERESADOS
---------------------------------
¿Se ha notificado o se tiene previsto notificar a los interesados?
  [ ] Sí — Fecha prevista: [AAAA-MM-DD]
  [ ] No — Justificación: [Motivo por el que no supone riesgo alto]

Firma del representante: _______________________
Fecha: [AAAA-MM-DD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. Notificación a Usuarios Afectados (RGPD Art. 34)

### 4.1 Árbol de decisión — ¿Notificar a usuarios?

```
¿Hay violación de seguridad de datos personales?
│
├── NO → No es necesario notificar a la AEPD ni a usuarios.
│         Documentar internamente.
│
└── SÍ → ¿Supone riesgo para derechos y libertades de usuarios?
          │
          ├── NO (ej. datos cifrados, afectados < 10, datos no sensibles)
          │    → Notificar a AEPD. NO es obligatorio notificar a usuarios.
          │      Documentar justificación.
          │
          └── SÍ → ¿El riesgo es ALTO?
                    │
                    ├── NO (riesgo moderado: datos básicos, acceso de lectura)
                    │    → Notificar a AEPD. Evaluar notificación voluntaria a usuarios.
                    │
                    └── SÍ (datos de salud, contraseñas, fotos, > 1000 usuarios)
                         → NOTIFICACIÓN OBLIGATORIA a AEPD Y a usuarios afectados.
                           Plazo: "sin dilación indebida" (recomendado < 72h)
```

### 4.2 Criterios de riesgo ALTO (notificación obligatoria a usuarios)
- Exposición de datos de salud o biométricos (Art. 9 RGPD)
- Exposición de contraseñas (aunque sea hash)
- Exposición de fotos personales
- Acceso a datos financieros
- Riesgo de discriminación, daño físico, daño reputacional o fraude para los afectados

### 4.3 Plantilla de notificación a usuarios afectados

```
Asunto: Aviso importante sobre la seguridad de tu cuenta en Healthy

Estimado/a [nombre del usuario],

Te escribimos para informarte de que hemos detectado un incidente de 
seguridad que puede haber afectado a tus datos personales.

¿QUÉ HA OCURRIDO?
[Descripción clara y no técnica del incidente. Fecha aproximada.]

¿QUÉ DATOS PUEDEN ESTAR AFECTADOS?
[Lista de tipos de datos: email, datos de perfil, datos de salud, etc.]

¿QUÉ RIESGO SUPONE PARA TI?
[Explicación clara del riesgo: acceso no autorizado, posible uso fraudulento, etc.]

¿QUÉ MEDIDAS HEMOS TOMADO?
1. [Medida 1 — ej. hemos revocado todas las sesiones activas]
2. [Medida 2 — ej. hemos reforzado la seguridad del sistema]
3. [Medida 3 — ej. hemos notificado a la AEPD]

¿QUÉ PUEDES HACER TÚ?
- Cambia tu contraseña en Healthy inmediatamente: [URL]
- Si usas la misma contraseña en otros servicios, cámbiala también.
- Estate atento a comunicaciones sospechosas que puedan usar tus datos.

Si tienes preguntas, contacta con nuestro DPO en: dpo@healthy-app.es

Lamentamos los inconvenientes causados y nos comprometemos a seguir 
mejorando la protección de tus datos.

El equipo de Healthy
privacy@healthy-app.es
```

---

## 5. Documentación del Incidente

### 5.1 Registro obligatorio (Art. 33.5 RGPD)

Debe mantenerse en el Registro de Incidentes de Seguridad (ver `VULNERABILITIES.md`) con:

- Fecha y hora de detección
- Fecha y hora de inicio estimada
- Descripción de la naturaleza de la violación
- Categorías y número aproximado de interesados afectados
- Categorías y número aproximado de registros de datos personales afectados
- Consecuencias probables
- Medidas adoptadas o propuestas para remediar
- Fecha de notificación a AEPD (si aplica)
- Fecha de notificación a usuarios (si aplica)
- Nombre e ID del Incident Manager

### 5.2 Herramientas de documentación
- Crear issue privado en el repositorio del proyecto con etiqueta `security-incident`
- Guardar logs en storage cifrado fuera del sistema afectado
- Documentar comunicaciones con la AEPD y respuestas recibidas

---

## 6. Medidas Correctoras

Una vez contenido el incidente, implementar:

1. **Análisis forense:** Determinar el vector de entrada y el alcance real con certeza
2. **Parcheo:** Corregir la vulnerabilidad explotada antes de restaurar el servicio
3. **Rotación de credenciales:** Rotar TODAS las credenciales de entornos afectados
4. **Revisión de logs:** Determinar qué datos fueron accedidos y cuándo
5. **Test de regresión:** Verificar que el fix es efectivo sin romper funcionalidad
6. **Actualización de documentación:** Actualizar `SECURITY_AUDIT.md` y `VULNERABILITIES.md`

---

## 7. Post-mortem y Mejora

### 7.1 Reunión post-mortem (48-72h después de la contención)

Participantes: Incident Manager, DPO, equipo técnico responsable, CTO/CEO si aplica.

Agenda:
1. Línea de tiempo del incidente (detección → contención → resolución)
2. Causa raíz identificada (5 Whys)
3. ¿Qué funcionó bien en la respuesta?
4. ¿Qué podría haberse hecho mejor?
5. Acciones de mejora concretas con responsable y fecha límite

### 7.2 Lecciones aprendidas

Documentar en `SECURITY_AUDIT.md` las lecciones aprendidas y las mejoras implementadas como consecuencia del incidente.

---

## 8. Contactos de Emergencia

| Rol | Nombre | Contacto | Disponibilidad |
|---|---|---|---|
| Incident Manager principal | [PLACEHOLDER] | [email] / [teléfono] | 24/7 |
| DPO (Delegado de Protección de Datos) | [PLACEHOLDER] | dpo@healthy-app.es / [teléfono] | Horario laboral + guardia |
| CTO / Responsable técnico | [PLACEHOLDER] | [email] / [teléfono] | 24/7 |
| Proveedor de hosting (AWS/Supabase) | Soporte enterprise | [panel de soporte] | 24/7 |
| Asesoría legal externa | [PLACEHOLDER] | [email] / [teléfono] | Horario laboral |
| AEPD — Consultas | AEPD | 901 100 099 | Horario laboral |
| AEPD — Notificaciones urgentes | AEPD Sede Electrónica | https://sedeagpd.gob.es | 24/7 (portal) |
