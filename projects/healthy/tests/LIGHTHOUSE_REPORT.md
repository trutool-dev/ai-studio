# Lighthouse Audit Report — Healthy Landing Page

**Fecha de auditoría:** 2026-09-02
**URL objetivo:** https://healthy.app
**Agente:** DevOps Agent
**Método:** Análisis estático del código fuente + verificación de conectividad

---

## Estado de la auditoría

| Campo | Valor |
|-------|-------|
| Lighthouse completo | NO EJECUTADO — dominio inactivo |
| Verificación HTTP | Sin respuesta (connection refused / DNS inactivo) |
| Análisis estático | Completado sobre `landing/index.html` (48.6 KB) |

### Por qué no se ejecutó Lighthouse completo

El dominio `https://healthy.app` no responde públicamente. La infraestructura de
CloudFront + S3 está definida en Terraform (`devops/infra/s3-landing.tf`,
`devops/infra/route53-landing.tf`) pero el `terraform apply` y la activación del
dominio son pasos manuales pendientes (tarea M-9: configurar DNS). Este bloqueo
fue documentado previamente en `tests/LIGHTHOUSE_PENDING.md` (2026-07-14) y
continúa sin resolverse a fecha de esta auditoría.

---

## Análisis estático del código fuente

El análisis se realiza sobre el archivo desplegado: `projects/healthy/landing/index.html`
(1 536 líneas, 48 584 bytes, autocontenido — sin dependencias externas).

### Performance — Estimado: 95-98 / 100

| Factor | Estado | Detalle |
|--------|--------|---------|
| Recursos externos | BIEN | Cero peticiones a CDNs o fuentes externas — todo inline |
| Tamaño HTML | BIEN | 48 KB — dentro del presupuesto para landing page SPA |
| Imágenes | BIEN | Sin elementos `<img>`. Los "mockups" de app son divs CSS puros |
| Bloqueo de render | BIEN | Sin `<link rel="stylesheet">` externo, sin `<script src>` bloqueante |
| Animaciones | BIEN | Usa `IntersectionObserver` + CSS transitions, no JavaScript pesado |
| Cache-Control | BIEN | CloudFront configurado con `max-age=86400` para assets; `no-cache` en index.html |
| Compresión | PENDIENTE | Depende de la configuración de CloudFront (Brotli/Gzip habilitados por defecto en CF) |

**Riesgo principal:** El CSS inline (~35 KB) no se puede cachear por separado. Sin embargo,
al ser una landing de página única, el primer paint es la única carga relevante.

---

### Accessibility — Estimado: 82-88 / 100

| Factor | Estado | Detalle |
|--------|--------|---------|
| `lang` en `<html>` | BIEN | `lang="es"` declarado |
| `meta viewport` | BIEN | Presente y correcto |
| Imágenes sin `alt` | N/A | No hay elementos `<img>` |
| Contraste de texto | RIESGO | Texto blanco `#FFFFFF` sobre `#080808` — ratio ~19:1 (BIEN) |
| Texto sutil | RIESGO | `rgba(255,255,255,0.38)` (text-muted) — ratio ~4.5:1, en el límite AA |
| Atributos `aria-*` | FALTA | No hay atributos `aria-label` ni `role` en botones CTA ni navegación |
| Estructura de headings | BIEN | `<h1>` único en hero, `<h2>` en secciones, `<h3>` en tarjetas |
| `<nav>` semántico | PARCIAL | Nav usa `<nav>` implícito pero sin `aria-label` |
| Links de tiendas | RIESGO | `<a href="#">` sin texto descriptivo en `aria-label` |
| `<footer>` `<nav>` | BIEN | `<nav class="footer-legal">` presente |
| Skip-to-content | FALTA | No hay enlace de salto para lectores de pantalla |

**Correcciones necesarias para alcanzar >= 95:**
1. Añadir `aria-label` a los botones de App Store y Google Play
2. Añadir `role="navigation"` y `aria-label` a la `<nav>` principal
3. Añadir enlace skip-to-content como primer elemento del `<body>`
4. Verificar contraste de `--text-muted` (`rgba(255,255,255,0.38)`) en fondos surface

---

### Best Practices — Estimado: 92-96 / 100

| Factor | Estado | Detalle |
|--------|--------|---------|
| HTTPS | BIEN | CloudFront con ACM (certificado en us-east-1, configurado en TF) |
| Headers de seguridad | BIEN | HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — todos configurados en `cf-security-headers.js` |
| CSP `unsafe-inline` | RIESGO | El CSP permite `script-src 'unsafe-inline'` (necesario por scripts inline) |
| Imágenes en WebP | N/A | No hay imágenes `<img>` — los visuales son CSS puro |
| Console errors | ESTIMADO LIMPIO | JS simple (scroll listener + IntersectionObserver) sin APIs deprecadas |
| Doctype | BIEN | `<!DOCTYPE html>` presente |
| Charset | BIEN | `<meta charset="UTF-8">` presente |

**Nota sobre CSP:** `unsafe-inline` penaliza levemente Best Practices en Lighthouse.
Migrar los scripts inline a un archivo `.js` externo o usar un `nonce` solucionaría esto.

---

### SEO — Estimado: 85-92 / 100

| Factor | Estado | Detalle |
|--------|--------|---------|
| `<title>` | BIEN | "Healthy — Tu mejor versión empieza hoy" (44 chars) |
| `<meta description>` | BIEN | Presente, 97 chars — dentro del rango óptimo |
| `lang` en `<html>` | BIEN | `lang="es"` |
| Headings jerárquicos | BIEN | H1 → H2 → H3 |
| `<link rel="canonical">` | FALTA | No declarado — CloudFront puede servir desde varias URLs |
| Open Graph tags | FALTA | Sin `og:title`, `og:description`, `og:image` |
| Twitter Card | FALTA | Sin `twitter:card` meta tags |
| Robots meta | BIEN (implícito) | Sin `noindex` — CloudFront no bloquea crawlers |
| `robots.txt` | DESCONOCIDO | No incluido en el repositorio |
| `sitemap.xml` | FALTA | No existe en el proyecto |
| Links con texto descriptivo | PARCIAL | Links footer tienen texto pero apuntan a `#` |
| Mobile-friendly | BIEN | `meta viewport` correcto, diseño responsive |

**Correcciones necesarias para alcanzar >= 95:**
1. Añadir `<link rel="canonical" href="https://healthy.app/">`
2. Añadir Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
3. Crear `robots.txt` y `sitemap.xml` en el bucket S3
4. Añadir favicon (`<link rel="icon">`) — actualmente ausente

---

## Puntuaciones estimadas (análisis estático)

| Categoría | Score estimado | Umbral objetivo | Estado |
|-----------|:--------------:|:---------------:|--------|
| Performance | 95-98 | >= 95 | PROBABLEMENTE PASA |
| Accessibility | 82-88 | >= 95 | FALLA — correcciones requeridas |
| Best Practices | 92-96 | >= 95 | EN RIESGO |
| SEO | 85-92 | >= 95 | FALLA — correcciones requeridas |

---

## Recomendaciones prioritarias (antes de auditoría real)

### Prioridad ALTA (bloquean >= 95)

1. **SEO — Canonical tag**
   ```html
   <link rel="canonical" href="https://healthy.app/" />
   ```

2. **SEO — Open Graph**
   ```html
   <meta property="og:title" content="Healthy — Tu mejor versión empieza hoy" />
   <meta property="og:description" content="IA personalizada para entrenamiento, nutrición y progreso." />
   <meta property="og:url" content="https://healthy.app/" />
   <meta property="og:type" content="website" />
   <meta property="og:image" content="https://healthy.app/og-image.png" />
   ```

3. **Accessibility — ARIA en botones de descarga**
   ```html
   <a href="#" class="store-btn" aria-label="Descargar Healthy en App Store">
   <a href="#" class="store-btn" aria-label="Descargar Healthy en Google Play">
   ```

4. **Accessibility — aria-label en nav**
   ```html
   <nav class="nav" id="nav" aria-label="Navegación principal">
   ```

5. **Accessibility — skip-to-content**
   ```html
   <!-- Primera línea de <body> -->
   <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
   ```

### Prioridad MEDIA (mejoran score)

6. **SEO — Favicon**
   ```html
   <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   ```

7. **SEO — robots.txt** (crear en `landing/robots.txt`):
   ```
   User-agent: *
   Allow: /
   Sitemap: https://healthy.app/sitemap.xml
   ```

8. **Best Practices — extraer script inline** a `landing/app.js` para eliminar `unsafe-inline` del CSP

---

## Cómo ejecutar la auditoría real

Una vez el dominio `https://healthy.app` esté activo (tras completar M-9):

```bash
# Desde la raíz del repositorio
npx lighthouse https://healthy.app \
  --output json \
  --output html \
  --output-path ./projects/healthy/tests/lighthouse-report \
  --chrome-path="C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" \
  --only-categories=performance,accessibility,best-practices,seo \
  --quiet
```

Los archivos generados:
- `projects/healthy/tests/lighthouse-report.report.json`
- `projects/healthy/tests/lighthouse-report.report.html`

---

## Historial de auditorías

| Fecha | Método | Performance | Accessibility | Best Practices | SEO |
|-------|--------|:-----------:|:-------------:|:--------------:|:---:|
| 2026-07-14 | Pendiente — dominio inactivo | — | — | — | — |
| 2026-09-02 | Análisis estático (dominio inactivo) | 95-98* | 82-88* | 92-96* | 85-92* |

*Estimaciones basadas en análisis estático del código fuente. Pendiente de validación con Lighthouse real cuando el dominio esté activo.
