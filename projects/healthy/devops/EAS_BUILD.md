# EAS Build — Compilar la app Healthy

Guía completa para compilar la app React Native con Expo EAS Build.

---

## Requisitos previos

- Node.js 20+
- Cuenta en [expo.dev](https://expo.dev) (gratuita)
- El `app.json` del proyecto configurado con `owner`, `slug` y `bundleIdentifier` / `package`

---

## 1. Instalar EAS CLI

```bash
npm install -g eas-cli
```

Verificar la versión instalada:

```bash
eas --version
# eas-cli/7.x.x ...
```

---

## 2. Login en Expo

```bash
eas login
```

Introducir las credenciales de expo.dev. El token se almacena localmente en `~/.expo/`.

---

## 3. Vincular el proyecto (primera vez)

Desde la carpeta `frontend/`:

```bash
cd projects/healthy/frontend
eas build:configure
```

Esto actualiza `app.json` con el `projectId` de Expo y crea el `eas.json` si no existe.

---

## 4. Perfiles disponibles (`eas.json`)

| Perfil | Uso | Distribución |
|--------|-----|--------------|
| `development` | Desarrollo local con Expo Go personalizado | Interna (TestFlight / APK directo) |
| `preview` | Pruebas en dispositivos reales sin stores | Interna (APK directo en Android) |
| `production` | Build final para App Store y Google Play | Stores |

---

## 5. Primer build — perfil preview (recomendado para probar)

Desde `projects/healthy/frontend/`:

```bash
# Build para ambas plataformas
eas build --platform all --profile preview

# Solo Android (más rápido para probar)
eas build --platform android --profile preview

# Solo iOS (requiere cuenta Apple Developer activa)
eas build --platform ios --profile preview
```

EAS sube el código a los servidores de Expo y compila en la nube. El proceso tarda ~10-15 minutos.

---

## 6. Ver el estado de los builds

### En el navegador

Ir a [expo.dev/accounts/YOUR_ACCOUNT/projects/healthy/builds](https://expo.dev) y seleccionar el proyecto.

### Por CLI

```bash
eas build:list
```

Ver los últimos 10 builds con su estado (queued, building, finished, errored).

---

## 7. Descargar e instalar el build

```bash
# Ver detalles del último build
eas build:view

# El CLI muestra el QR code o URL de descarga al terminar
```

- **Android APK**: instalar directamente desde el link descargado.
- **iOS IPA**: instalar via TestFlight o usando Apple Configurator.

---

## 8. Build de desarrollo (con Dev Client)

El perfil `development` genera una versión de Expo Go personalizada con los módulos nativos del proyecto:

```bash
eas build --platform android --profile development
```

Luego arrancar el servidor de desarrollo:

```bash
npx expo start --dev-client
```

---

## 9. GitHub Actions — Pipeline EAS Build

El workflow `eas-build.yml` compila automáticamente en cada merge a `develop`.

**Archivo:** `devops/.github/workflows/eas-build.yml`

El pipeline:
1. Hace checkout del código
2. Instala dependencias
3. Autentica con Expo via token
4. Ejecuta `eas build --platform all --profile preview --non-interactive`

Ver el workflow completo en `devops/.github/workflows/eas-build.yml`.

---

## 10. Variables de entorno en EAS

Las variables de entorno se configuran en el `eas.json` bajo `build.{profile}.env` o en el dashboard de Expo (para valores secretos):

```bash
# Añadir secreto en EAS (para valores que no deben estar en el repo)
eas secret:create --scope project --name API_URL --value "https://api.healthy.app"
```

Ver todos los secretos configurados:

```bash
eas secret:list
```

---

## Solución de problemas frecuentes

| Error | Causa | Solución |
|-------|-------|----------|
| `Project not found` | `projectId` incorrecto en `app.json` | Ejecutar `eas build:configure` de nuevo |
| `iOS certificate expired` | Certificado de distribución caducado | `eas credentials` → renovar |
| `Android keystore not found` | Sin keystore configurado | `eas credentials` → generar nuevo |
| `Build timeout` | Build tardó más de 30 min | Revisar dependencias nativas; usar caché de `node_modules` |
