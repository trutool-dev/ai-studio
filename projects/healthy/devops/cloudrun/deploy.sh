#!/usr/bin/env bash
# deploy.sh — Despliega la landing de Healthy en Google Cloud Run
#
# Uso:
#   cd projects/healthy/devops/cloudrun
#   ./deploy.sh
#
# Variables configurables:
#   PROJECT_ID   → ID del proyecto GCP (por defecto lee de gcloud config)
#   SERVICE_NAME → Nombre del servicio Cloud Run
#   REGION       → Región de despliegue
#   IMAGE        → Nombre de la imagen en Artifact Registry
#
# Requisitos previos: ver README.md en este mismo directorio.

set -euo pipefail

# ── Configuración ──────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
SERVICE_NAME="${SERVICE_NAME:-healthy-landing}"
REGION="${REGION:-europe-west1}"
IMAGE_NAME="landing"
REPO="gcr.io/${PROJECT_ID}/${IMAGE_NAME}"

# Ruta al directorio de la landing (relativa a la raíz del repo)
# El contexto de build incluye los archivos de landing + los ficheros de este directorio
LANDING_DIR="projects/healthy/landing"

# ── Validaciones ───────────────────────────────────────────────────────────────
if [[ -z "${PROJECT_ID}" ]]; then
  echo "ERROR: PROJECT_ID no configurado."
  echo "Ejecuta: gcloud config set project <TU_PROJECT_ID>"
  echo "O exporta: export PROJECT_ID=<TU_PROJECT_ID>"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      Deploy Healthy Landing → Google Cloud Run       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Proyecto GCP : ${PROJECT_ID}"
echo "  Servicio     : ${SERVICE_NAME}"
echo "  Región       : ${REGION}"
echo "  Imagen       : ${REPO}"
echo ""

# ── Paso 1: Build y push de la imagen con Cloud Build ─────────────────────────
# Se ejecuta desde la RAÍZ del repositorio para que el contexto incluya
# tanto landing/ como los archivos Dockerfile/nginx.conf de este directorio.
echo "▶ Paso 1/2 — Cloud Build: construyendo y publicando imagen..."
echo ""

# Copiamos Dockerfile y nginx.conf temporalmente al directorio de landing
# para que el contexto de build sea self-contained.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
LANDING_ABS="${REPO_ROOT}/${LANDING_DIR}"

echo "  Contexto de build : ${LANDING_ABS}"
echo ""

# Copiar los archivos de configuración al directorio de landing (temporal)
cp "${SCRIPT_DIR}/Dockerfile"  "${LANDING_ABS}/Dockerfile"
cp "${SCRIPT_DIR}/nginx.conf"  "${LANDING_ABS}/nginx.conf"
cp "${SCRIPT_DIR}/.dockerignore" "${LANDING_ABS}/.dockerignore"

# Build con Cloud Build (no requiere Docker local)
gcloud builds submit "${LANDING_ABS}" \
  --tag "${REPO}:latest" \
  --project="${PROJECT_ID}"

# Limpiar archivos temporales
rm -f "${LANDING_ABS}/Dockerfile" \
      "${LANDING_ABS}/nginx.conf" \
      "${LANDING_ABS}/.dockerignore"

echo ""
echo "  ✓ Imagen publicada: ${REPO}:latest"
echo ""

# ── Paso 2: Despliegue en Cloud Run ───────────────────────────────────────────
echo "▶ Paso 2/2 — Cloud Run: desplegando servicio..."
echo ""

gcloud run deploy "${SERVICE_NAME}" \
  --image "${REPO}:latest" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --project="${PROJECT_ID}"

# ── Resultado ─────────────────────────────────────────────────────────────────
SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                   DEPLOY COMPLETADO                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  URL del servicio: ${SERVICE_URL}"
echo ""
echo "  Verificación:"
echo "    curl -s -o /dev/null -w '%{http_code}' ${SERVICE_URL}"
echo "    (debe responder 200)"
echo ""
