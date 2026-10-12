# EAS Submit — Publicar Healthy en App Store y Google Play

Guía para enviar la app compilada a las stores oficiales usando Expo EAS Submit.

---

## Requisitos

### iOS — App Store Connect
- Cuenta **Apple Developer Program** activa ($99/año en [developer.apple.com](https://developer.apple.com))
- App creada en [App Store Connect](https://appstoreconnect.apple.com)
- **API Key** de App Store Connect con rol de App Manager o superior

### Android — Google Play
- Cuenta **Google Play Console** activa ($25 único en [play.google.com/console](https://play.google.com/console))
- App creada en Google Play Console (al menos como borrador)
- **Service Account JSON** con permisos de Release Manager en la app

---

## 1. Generar App Store Connect API Key (iOS)

1. Ir a [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → pestaña **Keys**
2. Clic en **Generate API Key** (`+`)
3. Nombre: `healthy-eas-submit`
4. Acceso: **App Manager**
5. Clic en **Generate**
6. Descargar el archivo `.p8` (solo disponible **una vez** — guardarlo en lugar seguro)
7. Anotar:
   - **Key ID**: aparece en la lista de claves (10 caracteres, ej: `ABCDE12345`)
   - **Issuer ID**: visible en la parte superior de la página de claves (UUID)

Añadir al proyecto como secretos de GitHub:
- `APPLE_APP_STORE_CONNECT_API_KEY_ID` → el Key ID
- `APPLE_APP_STORE_CONNECT_API_KEY_ISSUER_ID` → el Issuer ID
- `APPLE_APP_STORE_CONNECT_API_KEY_CONTENT` → el contenido del archivo `.p8` (pegar el texto completo incluyendo `-----BEGIN PRIVATE KEY-----`)

---

## 2. Generar Google Play Service Account JSON (Android)

### Paso 1 — Crear service account en Google Cloud

1. Ir a [Google Play Console](https://play.google.com/console) → **Setup** → **API access**
2. Clic en **Link to a Google Cloud Project** (o crear uno nuevo)
3. En Google Cloud Console, ir a **IAM & Admin** → **Service Accounts**
4. Clic en **Create Service Account**
   - Nombre: `healthy-eas-submit`
   - ID: `healthy-eas-submit@TU-PROYECTO.iam.gserviceaccount.com`
5. Clic en **Create and continue**
6. No asignar roles en este paso (los permisos se dan desde Play Console)
7. Clic en **Done**
8. En la lista, hacer clic en la cuenta creada → pestaña **Keys** → **Add Key** → **JSON**
9. Descargar el archivo JSON (guardarlo en lugar seguro)

### Paso 2 — Dar permisos en Google Play Console

1. Volver a Play Console → **Setup** → **API access**
2. Buscar la service account recién creada y clic en **Manage Play Console permissions**
3. Permisos mínimos necesarios:
   - **Release** → Release apps to testing tracks
   - **Release** → Manage testing tracks and release
4. Aplicar a la app Healthy específicamente (no a toda la cuenta)

Añadir al proyecto:
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` → el contenido completo del JSON descargado

---

## 3. Configurar credenciales en EAS

```bash
cd projects/healthy/frontend

# Ver y gestionar credenciales interactivamente
eas credentials
```

EAS puede gestionar automáticamente los certificados de iOS (modo `managed`) o usar los propios (modo `local`). Para producción, se recomienda el modo `managed` para renovación automática.

---

## 4. Ejecutar el submit manualmente

### Prerequisito: tener un build de producción listo

```bash
# Ver los builds disponibles
eas build:list --status=finished --profile=production

# Anotar el ID del build a enviar
```

### Submit a ambas plataformas

```bash
cd projects/healthy/frontend

eas submit --platform all --profile production
```

EAS pregunta qué build usar (seleccionar el más reciente o indicar el ID).

### Submit solo a una plataforma

```bash
# Solo App Store
eas submit --platform ios --profile production

# Solo Google Play
eas submit --platform android --profile production
```

---

## 5. Tracks de publicación

| Track | Descripción | Comando |
|-------|-------------|---------|
| `internal` | Solo testers internos (recomendado para primeras versiones) | Por defecto en `eas.json` |
| `alpha` | Hasta 2000 testers externos (Android) | Cambiar `track` en `eas.json` |
| `beta` | TestFlight (iOS) / Open testing (Android) | `--track beta` |
| `production` | Publicación pública | Requiere revisión previa en App Store |

---

## 6. GitHub Actions — Pipeline EAS Submit

El workflow `eas-submit.yml` envía automáticamente a las stores al crear un tag `v*.*.*`.

**Archivo:** `devops/.github/workflows/eas-submit.yml`

Flujo del pipeline:
1. Se dispara al crear un tag `v1.0.0`, `v1.2.3`, etc.
2. Compila el build de producción con EAS
3. Envía a App Store Connect (TestFlight) y Google Play (internal track)
4. Notifica el resultado

---

## 7. Checklist antes del primer submit

- [ ] `app.json` tiene `bundleIdentifier` correcto para iOS (`app.healthy.app`)
- [ ] `app.json` tiene `package` correcto para Android (`app.healthy.app`)
- [ ] App creada en App Store Connect con el mismo Bundle ID
- [ ] App creada en Google Play Console con el mismo package name
- [ ] Service Account JSON añadido como secreto de GitHub
- [ ] API Key de App Store Connect añadida como secretos de GitHub
- [ ] El `eas.json` tiene configurado el `appleId`, `ascAppId` y `appleTeamId` correctos
- [ ] Build de producción compilado correctamente
