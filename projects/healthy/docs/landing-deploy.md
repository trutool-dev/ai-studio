# Landing Deploy — Healthy

Guía para actualizar y desplegar la landing page de Healthy. La landing publicada es
`landing/index4.html`: un HTML sin build step (Tailwind por CDN + CSS y JS inline) que se
sirve con nginx en un servicio de **Railway**.

---

## Estructura

```
landing/
├── index4.html            ← landing publicada (se sirve en /)
├── public/
│   ├── images/            ← logo, portada, iconos   → /images/...
│   ├── videos/            ← vídeos de fondo (.mp4)  → /videos/...
│   └── frames/            ← 151 frames del canvas scroll-scrub de Nutrición
├── Dockerfile             ← imagen nginx que empaqueta index4.html + public/
├── nginx.conf.template    ← config nginx (puerto ${PORT} de Railway, caché, cabeceras)
└── .dockerignore          ← excluye node_modules, dist, src y variantes no publicadas
```

`index.html`, `index2.html`, `index3.html`, `index4/`, `src/` y `dist/` son variantes o
prototipos que **no** se publican.

### Rutas de assets

| Recurso | Ruta en `index4.html` | Servido desde |
|---|---|---|
| Imágenes | `/images/...` | `public/images/` |
| Vídeos | `/videos/...` | `public/videos/` |
| Frames del canvas | `public/frames/frame_XXXX.jpg` (relativa, `FRAMES_PATH`) | `public/frames/` — nginx hace alias de `/public/` a la raíz |

> No uses `npm run build` (Vite) para publicar: el build mueve los frames a `/frames/`
> pero el JS inline sigue pidiendo `public/frames/`, y la animación de Nutrición se rompe.

---

## Probar en local

```bash
cd projects/healthy/landing
docker build -t healthy-landing .
docker run --rm -e PORT=8080 -p 8080:8080 healthy-landing
# abrir http://localhost:8080
```

Comprobaciones rápidas:

```bash
curl -I http://localhost:8080/                              # 200, Cache-Control: no-cache
curl -I http://localhost:8080/videos/fitness_workout.mp4    # 200, video/mp4
curl -I http://localhost:8080/public/frames/frame_0001.jpg  # 200, image/jpeg
```

---

## Despliegue en Railway

### Configuración del servicio (una sola vez)

| Ajuste | Valor |
|---|---|
| Servicio | `healthy-landing` (mismo proyecto Railway que el backend) |
| Root Directory | `projects/healthy/landing` |
| Builder | Dockerfile (Railway lo detecta automáticamente) |
| Variables | Ninguna obligatoria — Railway inyecta `PORT` y nginx escucha en él |
| Dominio | Generar dominio `*.up.railway.app` o añadir dominio propio (Settings → Networking) |

### Desplegar

- **Automático:** con el repositorio de GitHub conectado al servicio, cada push a la rama
  configurada con cambios en `projects/healthy/landing/` lanza un nuevo deploy.
- **Manual (desde la raíz del repo):**

```bash
railway up --service healthy-landing --detach
```

### Verificar

```bash
curl -I https://<dominio-landing>/
curl -s https://<dominio-landing>/ | grep '<title>'
```

El status debe ser `200` y la respuesta debe llevar `Cache-Control: no-cache` en el HTML.

---

## Dominio propio

1. Railway → servicio `healthy-landing` → Settings → Networking → **Custom Domain**.
2. Railway muestra el registro CNAME a crear.
3. Crear ese CNAME en el panel DNS del proveedor del dominio.
4. Railway emite el certificado TLS automáticamente cuando el DNS propaga.

---

## Rollback

Railway → servicio `healthy-landing` → **Deployments** → seleccionar un deploy anterior →
**Redeploy**. El cambio es inmediato; el HTML no se cachea, así que no hay invalidación que hacer.
