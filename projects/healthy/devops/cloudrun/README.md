# Despliegue de la landing en Google Cloud Run

Esta guía te permite desplegar la landing de Healthy en Google Cloud Run usando una imagen Docker con `nginx:alpine`. El resultado es una URL HTTPS pública gestionada por Google.

---

## Qué se despliega

Los archivos estáticos de `projects/healthy/landing/` se empaquetan en una imagen `nginx:alpine` y se publican como un servicio Cloud Run en la región `europe-west1`.

| Componente | Detalle |
|---|---|
| Imagen base | `nginx:alpine` |
| Archivos servidos | `projects/healthy/landing/` (incluye `dist/`, `index.html`, assets) |
| Puerto | 8080 (estándar Cloud Run) |
| Servicio Cloud Run | `healthy-landing` |
| Región | `europe-west1` (configurable) |
| Coste estimado | ~$0–2/mes con tráfico bajo (Cloud Run es pay-per-request) |

---

## Prerrequisitos

### 1. Google Cloud CLI instalada y autenticada

```bash
# Verificar que gcloud está instalada
gcloud --version

# Autenticar con tu cuenta de Google
gcloud auth login

# Autenticar también las credenciales de aplicación (para Cloud Build)
gcloud auth application-default login
```

Si no tienes `gcloud` instalada: https://cloud.google.com/sdk/docs/install

### 2. Proyecto GCP con facturación activa

```bash
# Listar tus proyectos disponibles
gcloud projects list

# Seleccionar el proyecto correcto
gcloud config set project TU_PROJECT_ID
```

Si no tienes un proyecto, créalo en: https://console.cloud.google.com/projectcreate

### 3. APIs habilitadas en el proyecto

```bash
# Habilitar las APIs necesarias (solo la primera vez)
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com
```

### 4. Permisos de la cuenta de servicio de Cloud Build

La cuenta de servicio de Cloud Build (`<PROJECT_NUMBER>@cloudbuild.gserviceaccount.com`) necesita el rol **Cloud Run Admin** para poder desplegar. Puedes añadirlo desde la consola:

- IAM → Cuenta de servicio de Cloud Build → Editar → Añadir rol **Cloud Run Admin** y **Service Account User**

---

## Paso a paso

### Paso 1 — Situarte en la raíz del repositorio

```bash
cd /ruta/a/ai-studio   # la raíz del repo, donde está la carpeta projects/
```

### Paso 2 — (Opcional) Configurar variables

Por defecto el script lee el `PROJECT_ID` de tu configuración de gcloud. Si prefieres especificarlo explícitamente:

```bash
export PROJECT_ID=mi-proyecto-gcp
export REGION=europe-west1          # opcional, ya es el valor por defecto
export SERVICE_NAME=healthy-landing  # opcional, ya es el valor por defecto
```

### Paso 3 — Ejecutar el script de despliegue

```bash
# Dar permisos de ejecución (solo la primera vez)
chmod +x projects/healthy/devops/cloudrun/deploy.sh

# Ejecutar desde la raíz del repo
projects/healthy/devops/cloudrun/deploy.sh
```

El script realiza automáticamente:

1. **Cloud Build** — construye la imagen Docker con los archivos de `landing/` y la publica en `gcr.io/<PROJECT_ID>/landing:latest`
2. **Cloud Run** — despliega el servicio `healthy-landing` con acceso público (`--allow-unauthenticated`)
3. **Resultado** — imprime la URL pública del servicio al finalizar

La primera ejecución tarda ~2-3 minutos. Las siguientes son más rápidas gracias a la caché de capas Docker.

### Paso 4 — Verificar el despliegue

```bash
# La URL aparece al final del script. También puedes consultarla así:
gcloud run services describe healthy-landing \
  --platform managed \
  --region europe-west1 \
  --format='value(status.url)'

# Verificar que responde 200
curl -s -o /dev/null -w '%{http_code}' https://healthy-landing-<hash>-ew.a.run.app
```

---

## Actualizar la landing

Cada vez que modifiques archivos en `projects/healthy/landing/`, vuelve a ejecutar el script:

```bash
projects/healthy/devops/cloudrun/deploy.sh
```

Cloud Run hace el cambio de tráfico de forma instantánea y sin downtime.

---

## Rollback a una versión anterior

Cloud Run guarda el historial de revisiones. Para volver a una versión anterior:

```bash
# Listar revisiones disponibles
gcloud run revisions list \
  --service healthy-landing \
  --region europe-west1

# Enviar el 100% del tráfico a una revisión anterior
gcloud run services update-traffic healthy-landing \
  --region europe-west1 \
  --to-revisions healthy-landing-<REVISION_ANTERIOR>=100
```

---

## Limpieza (eliminar el servicio)

```bash
# Eliminar el servicio Cloud Run
gcloud run services delete healthy-landing \
  --region europe-west1 \
  --platform managed

# Eliminar la imagen del Container Registry (opcional)
gcloud container images delete gcr.io/${PROJECT_ID}/landing --force-delete-tags
```

---

## Estructura de archivos en este directorio

```
devops/cloudrun/
├── Dockerfile       → imagen nginx:alpine con los archivos de landing/
├── nginx.conf       → configuración nginx: puerto 8080, gzip, caché, cabeceras de seguridad
├── .dockerignore    → excluye node_modules, .git, src/ y credenciales
├── deploy.sh        → script de despliegue: Cloud Build + Cloud Run deploy
└── README.md        → esta guía
```

---

## Resolución de problemas frecuentes

| Error | Causa | Solución |
|---|---|---|
| `ERROR: (gcloud.builds.submit) INVALID_ARGUMENT` | APIs no habilitadas | Ejecutar el bloque `gcloud services enable` de los prerrequisitos |
| `PERMISSION_DENIED` en Cloud Build | La cuenta de servicio no tiene rol Cloud Run Admin | Añadir el rol en IAM (ver prerrequisitos, paso 4) |
| `ERROR: Project not set` | `PROJECT_ID` vacío | `gcloud config set project TU_PROJECT_ID` o `export PROJECT_ID=...` |
| La URL responde 404 | nginx no encuentra `index.html` | Verificar que `landing/index.html` existe y no está en `.dockerignore` |
| El servicio tarda en arrancar | Primera petición en instancia fría (min-instances=0) | Normal; considerar `--min-instances 1` para eliminar cold starts |

---

> Generado por el agente orquestador — 2026-07-14
> Tareas relacionadas en `tasks.md`: DO-14, DO-15, DO-16, DO-17
