# Guía de publicación — Healthy App

Guía paso a paso para publicar la app Healthy en Google Play Internal Testing (M-8)
y los pasos post-publicación hasta el lanzamiento en producción.

> Ultima actualización: 2026-10-10 — Orquestador

---

## A. Publicación en Google Play — Internal Testing (M-8)

### Requisitos previos

- APK disponible: build `5befc66f` (commit `9d8522a`) — perfil `preview`
  - URL de descarga: https://expo.dev/artifacts/eas/WqEK5PmpORXPgcL1DFnT-6hQ-YRAZlxsrVjqcU-Xo6c.apk
- Cuenta Google Play Console activa ($25 pago único en https://play.google.com/console)
- M-7 completada — APK instalado y verificado en dispositivo Android real

### Paso 1 — Acceder a Google Play Console

1. Ir a https://play.google.com/console
2. Iniciar sesión con la cuenta de Google asociada al proyecto
3. Si es la primera vez: completar el registro de desarrollador ($25 tarifa única)

### Paso 2 — Crear la app (si no existe aún)

1. En el panel principal, clic en **Crear app**
2. Rellenar el formulario:
   - **Nombre de la app**: `Healthy`
   - **Idioma predeterminado**: Español (España)
   - **Tipo de app**: App
   - **¿Es gratuita o de pago?**: Gratuita
3. Aceptar las políticas del programa para desarrolladores
4. Clic en **Crear app**

### Paso 3 — Completar el perfil de la app

En el panel de la app, ir a **Ficha de Play Store** → **Ficha principal de la tienda**:

1. **Nombre corto** (máx. 30 chars): `Healthy`
2. **Descripción corta** (máx. 80 chars):
   `Tu plan de salud y fitness personalizado con inteligencia artificial`
3. **Descripción larga**: ver sección B de esta guía
4. **Icono de la app**: imagen PNG 512×512px — ver checklist sección C
5. **Capturas de pantalla**: mínimo 2, recomendado 4-8 — ver checklist sección C
6. **Categoría**: Salud y forma física
7. Clic en **Guardar**

### Paso 4 — Configurar la clasificación de contenido

En **Contenido de la app** → **Clasificación de contenido**:

1. Clic en **Iniciar cuestionario**
2. Responder las preguntas (la app no contiene violencia, contenido adulto ni compras)
3. Clasificación esperada: **Para todos (PEGI 3)** o equivalente regional
4. Guardar y aplicar

### Paso 5 — Política de privacidad

En **Contenido de la app** → **Política de privacidad**:

1. Introducir la URL de la política de privacidad
   - Si la landing page (https://healthy.app) incluye sección legal: usar esa URL con el ancla correspondiente
   - Si no existe aún: CREAR una política de privacidad antes de publicar (requisito obligatorio de Google Play)
   - La política debe mencionar: datos de salud recopilados, uso de IA, almacenamiento, derechos RGPD

### Paso 6 — Subir el APK a Internal Testing

1. En el menú lateral, ir a **Pruebas** → **Pruebas internas**
2. Clic en **Crear nueva versión**
3. En la sección **App bundles y APKs**, clic en **Añadir desde el almacenamiento de artefactos** o **Subir**
4. Subir el archivo `.apk` descargado de Expo (build `5befc66f`)
   - Descargar primero en local desde: https://expo.dev/artifacts/eas/WqEK5PmpORXPgcL1DFnT-6hQ-YRAZlxsrVjqcU-Xo6c.apk
5. Rellenar las **Notas de la versión** (changelog):
   ```
   Versión 1.0.0 — Primera versión de prueba interna
   - App de salud y fitness con planes personalizados por IA
   - Onboarding completo con 8 pasos
   - Plan de entrenamiento y nutrición generado por Claude AI
   ```
6. Clic en **Guardar** y luego en **Revisar versión**
7. Clic en **Iniciar implementación en prueba interna**

### Paso 7 — Añadir tester interno

1. En **Pruebas** → **Pruebas internas** → pestaña **Testers**
2. Clic en **Crear lista de testers** o seleccionar una existente
3. Añadir email: `trutool@gmail.com`
4. Guardar

### Paso 8 — El tester acepta la invitación y descarga la app

1. Google Play envía un email de invitación a `trutool@gmail.com`
2. Abrir el email en el dispositivo Android
3. Clic en el enlace de invitación → se abre el Play Store con la app
4. Aceptar ser tester
5. Instalar la app desde Play Store
6. Probar el flujo completo: registro → onboarding → generación de plan → entrenamiento

> **Nota:** Los builds de Internal Testing no requieren revisión de Google. La app está disponible para los testers en minutos.

---

## B. Datos de la app para Google Play

| Campo | Valor |
|-------|-------|
| Nombre de la app | Healthy |
| Nombre del paquete | `com.healthy.app` (definido en `frontend/app.json`) |
| Versión | 1.0.0 (versionCode: 1) |
| Tipo | App gratuita |
| Categoría | Salud y forma física |
| Clasificación de contenido | Para todos |
| Idioma predeterminado | Español (España) |
| Build ID (EAS) | `5befc66f-5958-40f2-86a2-60d1b5ae4861` |
| Commit del APK | `9d8522a` |

### Descripción corta (80 chars máx.)

```
Tu plan de salud y fitness personalizado con inteligencia artificial
```

### Descripción larga

```
Healthy es tu entrenador personal impulsado por inteligencia artificial.
Analiza tu perfil, objetivos y condición física para crear un plan
completamente personalizado de entrenamiento y nutrición.

ENTRENAMIENTO INTELIGENTE
- Plan de ejercicios adaptado a tu nivel, equipamiento y tiempo disponible
- Más de 1.300 ejercicios con instrucciones detalladas y animaciones
- Sesiones diseñadas para maximizar resultados según tu objetivo

NUTRICIÓN PERSONALIZADA
- Plan de alimentación calculado según tu metabolismo y objetivos
- Macronutrientes ajustados: proteínas, carbohidratos y grasas
- Adaptado a restricciones dietéticas: vegetariano, vegano, sin gluten...

IA QUE APRENDE CONTIGO
- Planes generados por Claude AI (Anthropic) con tu contexto completo
- Regeneración del plan cuando tu progreso se estanca
- Ajustes automáticos por lesiones o condiciones médicas

SEGUIMIENTO Y PROGRESO
- Registro diario de entrenamientos, comidas y métricas corporales
- Gráficas de evolución para ver tu progreso
- Historial completo de sesiones

PRIVACIDAD Y SEGURIDAD
- Tus datos de salud están cifrados y protegidos
- Cumple con el RGPD (Reglamento General de Protección de Datos)
- Sin publicidad, sin venta de datos
```

### Política de privacidad

- URL necesaria antes de publicar en Google Play
- Opciones:
  1. Añadir sección /privacidad en la landing https://healthy.app
  2. Crear documento separado accesible públicamente
- La política debe cubrir: datos de salud (Art. 9 RGPD), IA, almacenamiento en Railway/AWS, derechos del usuario

---

## C. Checklist antes de publicar (M-8)

### Obligatorio

- [ ] **M-7 completada** — APK instalado y funcional en dispositivo Android real
- [ ] **Cuenta Google Play Console** — activa con tarifa de desarrollador pagada ($25)
- [ ] **Icono de la app** — PNG 512×512px sin transparencia
  - Ubicación esperada: `projects/healthy/frontend/assets/icon.png`
  - Verificar que existe y tiene las dimensiones correctas
  - Si no cumple requisitos: crear versión 512×512px para Play Store
- [ ] **Capturas de pantalla** (mínimo 2 por tipo de dispositivo)
  - Formato: PNG o JPEG, relación de aspecto 16:9 o 9:16, máx. 8MB
  - Cómo obtenerlas: hacer screenshots en el dispositivo Android durante M-7
  - Pantallas recomendadas: Onboarding, Home con plan activo, Entrenamiento, Nutrición
- [ ] **Descripción corta** (80 chars) — ver sección B
- [ ] **Descripción larga** — ver sección B
- [ ] **Política de privacidad** — URL pública accesible
- [ ] **Clasificación de contenido** — cuestionario completado en Play Console

### Recomendado

- [ ] **Gráfico de función** — imagen 1024×500px para destacar la app (opcional pero recomendado)
- [ ] **Email de soporte** — indicar `trutool@gmail.com` como contacto
- [ ] **Backend staging operativo** — verificar `GET /health` responde OK
- [ ] **Seed de ejercicios ejecutado** (M-4) — para que la app tenga datos completos

---

## D. Pasos post-publicación (M-13, M-14 y siguientes)

Una vez M-8 completada y la app verificada en Internal Testing:

### M-13 — Aprobar PR develop → main

```bash
# En GitHub: abrir Pull Request develop → main
# URL del repo: github.com/Trutool/ai-studio
# Revisar y aprobar el PR
# Mergear usando "Squash and merge" o "Merge commit"
```

### M-14 — Crear tag v1.0.0

```bash
# Ejecutar desde la raíz del repo tras el merge a main
git tag v1.0.0
git push origin v1.0.0
```

El tag `v1.0.0` dispara automáticamente el workflow `eas-submit.yml` en GitHub Actions
si está configurado. Ver `devops/EAS_SUBMIT.md` para los requisitos de credenciales.

### A-4 — Deploy a Railway producción

El merge a `main` dispara automáticamente el deploy de producción vía GitHub Actions.
Verificar en: https://backend-staging-01ee.up.railway.app/health

### M-9 — Configurar DNS api.healthy.app

1. Acceder al panel DNS del registrador del dominio `healthy.app`
2. Añadir registro CNAME: `api` → URL del servicio Railway en producción
3. Verificar propagación: `nslookup api.healthy.app`
4. Actualizar la variable `API_URL` en `eas.json` para builds futuros

### Publicación pública en Google Play (post Internal Testing)

Una vez el Internal Testing está validado:

1. Play Console → **Pruebas** → **Pruebas cerradas (Alfa)** → crear nueva versión con el mismo APK
2. Cuando esté listo para lanzamiento: **Producción** → crear nueva versión
3. Rellenar el formulario de revisión de Google (puede tardar 1-3 días hábiles)

---

## Referencias

- Google Play Console: https://play.google.com/console
- EAS Submit (automatización): `devops/EAS_SUBMIT.md`
- Guía de despliegue backend: `docs/deployment-guide.md`
- APK build actual: https://expo.dev/accounts/trutool/projects/healthy/builds
- Backend staging: https://backend-staging-01ee.up.railway.app/health
