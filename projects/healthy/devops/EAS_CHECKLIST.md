# EAS Build & Submit — Checklist operativo (TAREA-8)

**Generado por:** orquestador  
**Fecha:** 2026-07-14  
**Estado:** PENDIENTE — requiere cuentas Apple y Google del usuario

---

## Resumen de lo que requiere el usuario

| Requisito | iOS | Android |
|-----------|:---:|:-------:|
| Cuenta Expo (expo.dev) | SI | SI |
| Apple Developer Program ($99/año) | SI | NO |
| Google Play Developer ($25 único) | NO | SI |
| Dispositivo Mac para credenciales iOS | Recomendado | NO |

---

## Prerrequisitos — verificar antes de empezar

### 1. Herramientas locales

```bash
# Verificar Node.js >= 18
node --version

# Instalar EAS CLI globalmente
npm install -g eas-cli

# Verificar versión instalada
eas --version
# Esperado: eas-cli/7.x.x o superior
```

### 2. Cuenta Expo

- Registrarse o hacer login en [expo.dev](https://expo.dev)
- La cuenta debe ser la propietaria del proyecto Healthy (o tener permisos de admin)
- Tier gratuito es suficiente para preview builds

```bash
eas login
# Introducir email y contraseña de expo.dev
# Verificar: eas whoami
```

### 3. Cuenta Apple Developer (solo iOS)

- URL: [developer.apple.com](https://developer.apple.com)
- Coste: $99/año
- **Tiempo de activación:** 24-48 horas si es cuenta nueva
- Permisos necesarios: Account Holder o Admin
- Qué se necesita de App Store Connect:
  - Bundle ID registrado: `com.healthy.app` (o el que esté en `app.json`)
  - App creada en App Store Connect (para TestFlight)

### 4. Google Play Developer (solo Android)

- URL: [play.google.com/console](https://play.google.com/console)
- Coste: $25 (pago único)
- **Tiempo de activación:** inmediato tras verificación
- Qué se necesita:
  - Aplicación creada en Google Play Console
  - Package name: `com.healthy.app` (o el que esté en `app.json`)
  - Keystore: EAS lo genera automáticamente si no existe

---

## Configuración del proyecto (hacer una sola vez)

### 1. Vincular proyecto a Expo

Desde `projects/healthy/frontend/`:

```bash
cd projects/healthy/frontend
eas build:configure
```

Esto actualiza `app.json` con el `projectId` de Expo. Si el proyecto ya existe en expo.dev,
seleccionarlo de la lista; si no existe, crearlo.

Verificar que `app.json` contiene:
```json
{
  "expo": {
    "owner": "TU_CUENTA_EXPO",
    "slug": "healthy",
    "ios": {
      "bundleIdentifier": "com.healthy.app"
    },
    "android": {
      "package": "com.healthy.app"
    },
    "extra": {
      "eas": {
        "projectId": "XXXXX-XXXXX-XXXXX"
      }
    }
  }
}
```

### 2. Configurar credenciales

```bash
# Desde projects/healthy/frontend/
eas credentials
```

**Para iOS:**
- Seleccionar plataforma: iOS
- EAS puede gestionar automáticamente los certificados (recomendado: "Expo managed")
- Si ya tienes un certificado de distribución en Apple Developer, puedes subir el `.p12`
- Genera automáticamente el provisioning profile

**Para Android:**
- Seleccionar plataforma: Android
- Dejar que EAS genere el keystore automáticamente (recomendado)
- El keystore se almacena de forma segura en los servidores de Expo
- IMPORTANTE: guardar una copia del keystore — sin él no se pueden subir actualizaciones

---

## Primer build — perfil preview

```bash
# Desde projects/healthy/frontend/
# Build para ambas plataformas (recomendado)
eas build --platform all --profile preview

# Solo Android (más rápido para una primera prueba)
eas build --platform android --profile preview

# Solo iOS (requiere Apple Developer)
eas build --platform ios --profile preview
```

**Tiempo estimado:** 10-20 minutos por plataforma en colas de Expo.

**Ver progreso:**
```bash
eas build:list
# O ir a: https://expo.dev/accounts/TU_CUENTA/projects/healthy/builds
```

---

## Descargar e instalar el build

```bash
# Ver URL de descarga del último build completado
eas build:view
```

### Android APK
- Descargar el APK desde la URL generada
- En el dispositivo: Configuración → Seguridad → "Instalar apps de origen desconocido"
- Instalar el APK descargado

### iOS IPA (TestFlight)
- Desde App Store Connect → TestFlight → subir el IPA (o que EAS lo suba via `eas submit`)
- Añadir testers internos en TestFlight
- Los testers recibirán un email con link de instalación

---

## Conectar al backend de staging

La URL del backend de staging se configura como variable de entorno en EAS:

```bash
# Desde projects/healthy/frontend/
eas secret:create --scope project --name API_URL --value "https://backend-staging-01ee.up.railway.app"
```

Verificar en `eas.json` que el perfil `preview` referencia esta variable:

```json
{
  "build": {
    "preview": {
      "env": {
        "API_URL": "$API_URL"
      }
    }
  }
}
```

---

## Publicar en App Store (producción)

Este paso se ejecuta en TAREA-9 / go-live. Se dispara automáticamente al crear el tag `v1.0.0`:

```bash
# Manual (si el workflow no se dispara automáticamente)
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```

---

## Qué hacer si falla en iOS

| Error | Causa | Solución |
|-------|-------|---------|
| `No profile for device` | Dispositivo no registrado en Apple Developer | Añadir el UDID en Apple Developer → Devices → Register Device |
| `Certificate expired` | Certificado de distribución caducado | `eas credentials` → iOS → Manage certificates → Revoke + Create new |
| `Provisioning profile invalid` | Profile no incluye el bundle ID correcto | Regenerar profile en Apple Developer o via `eas credentials` |
| `Apple account requires 2FA` | La cuenta Apple tiene 2FA activado | Generar App-Specific Password en appleid.apple.com para el build |
| `Bundle ID not registered` | `com.healthy.app` no está en Apple Developer | Ir a Apple Developer → Identifiers → Register App ID |
| Build en cola > 30 min | Colas de Expo saturadas | Normal en horas pico; esperar o intentar `--local` (requiere Xcode en Mac) |

---

## Qué hacer si falla en Android

| Error | Causa | Solución |
|-------|-------|---------|
| `Keystore not found` | No se configuraron las credenciales | `eas credentials` → Android → Keystore → Generate new |
| `Package name already taken` | `com.healthy.app` ya existe en Play Store de otra cuenta | Cambiar package name en `app.json` → `android.package` |
| `Upload failed` | Error al subir a Google Play | Verificar que la app fue creada en Play Console y el package name coincide |
| `SHA-1 fingerprint mismatch` | Keystore diferente al registrado en Firebase (si aplica) | Actualizar fingerprint en Firebase o usar el keystore original |
| Build falla en `node_modules` | Dependencias nativas incompatibles con Expo SDK | Ejecutar `npx expo install --fix` y volver a intentar el build |

---

## Registro de builds (actualizar tras ejecutar)

| Fecha | Perfil | Plataforma | Build ID | Estado | Notas |
|-------|--------|------------|----------|--------|-------|
| — | preview | android | — | PENDIENTE | — |
| — | preview | ios | — | PENDIENTE | — |
| — | production | android | — | PENDIENTE (go-live) | — |
| — | production | ios | — | PENDIENTE (go-live) | — |

---

## Referencias

- Guía completa: `projects/healthy/devops/EAS_BUILD.md`
- Submit a stores: `projects/healthy/devops/EAS_SUBMIT.md`
- Workflow CI/CD: `projects/healthy/devops/.github/workflows/eas-build.yml`
- Workflow submit: `projects/healthy/devops/.github/workflows/eas-submit.yml` (trigger: tag `v*.*.*`)
