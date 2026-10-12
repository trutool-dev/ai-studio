# Lighthouse Check — Pendiente de dominio activo

**Generado por:** orquestador  
**Fecha:** 2026-07-14  
**Estado:** PENDIENTE — el dominio `healthy.app` no responde aún (DNS/CloudFront no activo)

---

## Contexto

La landing page de Healthy está alojada en S3 + CloudFront. El dominio `healthy.app`
aparece configurado en los documentos de infraestructura (`docs/architecture-web.md`,
`docs/landing-deploy.md`) pero aún no responde públicamente (verificado con curl el
2026-07-14: HTTP 000 — sin conexión).

Lighthouse v13 está disponible en el entorno de desarrollo (`npx lighthouse --version`
devuelve `13.4.0`) y Google Chrome está instalado. En cuanto el dominio esté activo,
el check puede ejecutarse directamente desde este equipo.

---

## URL objetivo

```
https://healthy.app
```

---

## Comando completo para ejecutar Lighthouse

Una vez que `https://healthy.app` esté activo, ejecutar **desde la raíz del repo**:

```bash
npx lighthouse https://healthy.app \
  --output json \
  --output html \
  --output-path ./projects/healthy/tests/lighthouse-report \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```

Esto genera dos archivos:
- `projects/healthy/tests/lighthouse-report.report.json`
- `projects/healthy/tests/lighthouse-report.report.html`

---

## Comando alternativo (si Chrome no está en PATH)

En Windows, especificar la ruta al ejecutable de Chrome:

```bash
npx lighthouse https://healthy.app \
  --output json \
  --output html \
  --output-path ./projects/healthy/tests/lighthouse-report \
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```

---

## Umbral de aceptación (TAREA-9 / PR-6)

| Categoría | Umbral mínimo |
|-----------|:------------:|
| Performance | ≥ 95 |
| Accessibility | ≥ 95 |
| Best Practices | ≥ 95 |
| SEO | ≥ 95 |

---

## Verificar resultado rápido desde JSON

```bash
# Extraer scores del JSON generado
node -e "
const r = require('./projects/healthy/tests/lighthouse-report.report.json');
const cats = r.categories;
console.log('Performance:', Math.round(cats.performance.score * 100));
console.log('Accessibility:', Math.round(cats.accessibility.score * 100));
console.log('Best Practices:', Math.round(cats['best-practices'].score * 100));
console.log('SEO:', Math.round(cats.seo.score * 100));
"
```

---

## Pasos para documentar en TAREA-9

Cuando el check pase ≥ 95 en las 4 categorías:

1. Copiar el JSON y HTML a `projects/healthy/tests/lighthouse-report.*`
2. Crear `projects/healthy/docs/LIGHTHOUSE_FINAL.md` con los scores obtenidos
3. Marcar el criterio Lighthouse en `devops/GO_LIVE_CHECKLIST.md` como completado

---

## Posibles problemas y soluciones

| Problema | Causa probable | Solución |
|----------|---------------|---------|
| Score Performance < 95 | Recursos sin comprimir o sin caché | Verificar headers CloudFront: `Cache-Control: max-age=86400`, `Content-Encoding: gzip/br` |
| Score Accessibility < 95 | Atributos alt faltantes o contraste insuficiente | Revisar `landing/index.html` — añadir `alt`, corregir ratios de color |
| Score SEO < 95 | Meta description o canonical faltantes | Añadir `<meta name="description">` y `<link rel="canonical">` en `landing/index.html` |
| Score Best Practices < 95 | Imágenes en formatos legacy (JPG en lugar de WebP) | Convertir imágenes a WebP; asegurar HTTPS en todos los recursos |
| `Error: Unable to connect to Chrome` | Chrome no encontrado en PATH | Usar `--chrome-path` con la ruta absoluta |

---

## Trigger automático sugerido (post go-live)

Una vez el dominio esté activo, añadir este step en `.github/workflows/deploy-landing.yml`:

```yaml
- name: Lighthouse CI
  run: |
    npx lighthouse https://healthy.app \
      --output json \
      --output-path /tmp/lh-report \
      --chrome-flags="--headless --no-sandbox" \
      --only-categories=performance,accessibility,best-practices,seo \
      --quiet
    node -e "
      const r = require('/tmp/lh-report.report.json');
      const cats = r.categories;
      const scores = {
        performance: Math.round(cats.performance.score * 100),
        accessibility: Math.round(cats.accessibility.score * 100),
        bestPractices: Math.round(cats['best-practices'].score * 100),
        seo: Math.round(cats.seo.score * 100)
      };
      console.log('Lighthouse scores:', JSON.stringify(scores));
      const failing = Object.entries(scores).filter(([,v]) => v < 95);
      if (failing.length > 0) {
        console.error('FAIL: scores below 95:', failing);
        process.exit(1);
      }
      console.log('PASS: all scores >= 95');
    "
```
