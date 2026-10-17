# Guía de contenido — Landing de Healthy

Esta guía es para el equipo de marketing. No hace falta saber programar para editar los textos de la landing. Solo necesitas un editor de texto (VS Code, Sublime, Notepad++) y seguir las instrucciones de cada sección.

---

## ¿Qué es la landing y dónde está?

La landing page es la página web pública de Healthy (`https://healthy.app`). Es el primer punto de contacto con nuevos usuarios.

El archivo está en:

```
projects/healthy/landing/index.html
```

Es un único fichero HTML. Todo el texto, los estilos y la lógica están dentro de ese fichero. Para editar el contenido basta con abrir el fichero, localizar la sección correcta y cambiar el texto.

Cuando termines los cambios, avisa al equipo técnico para que publique la versión actualizada. También puedes hacer push a la rama `main` si tienes acceso — el sistema se encarga del resto automáticamente.

---

## Secciones editables

### Hero

**Dónde encontrarla:** busca el comentario `<!-- ── HERO ──` en el fichero.

La sección hero es la primera pantalla que ve el usuario al entrar. Tiene tres textos principales:

**Badge eyebrow** (etiqueta pequeña verde encima del título):

```html
<p class="hero-eyebrow reveal">
  <span>NUEVO — IA de salud personalizada</span>
</p>
```

Cambia el texto dentro de `<span>...</span>`. Mantenlo corto (menos de 6 palabras).

**Título principal:**

```html
<h1 class="hero-headline reveal reveal-delay-1">
  Tu cuerpo.<br />
  Tu <em>mejor</em><br />
  versión.
</h1>
```

Edita el texto libremente. La etiqueta `<em>mejor</em>` pone esa palabra en verde — úsala para destacar la palabra más importante. Los `<br />` crean saltos de línea.

**Subtítulo:**

```html
<p class="hero-sub reveal reveal-delay-2">
  IA que aprende cómo eres, diseña tu entrenamiento,
  optimiza tu nutrición y mide tu progreso real.
</p>
```

Reemplaza el texto. Máximo 2-3 líneas.

**Botones CTA:**

```html
<a href="#download" class="btn-primary">
  Descargar Healthy
  <span>→</span>
</a>
<a href="#entrenamiento" class="btn-outline">
  Ver cómo funciona
</a>
```

Cambia el texto visible de cada botón. No modifiques los atributos `href`, `class` ni la etiqueta `<span>→</span>`.

**No toques:** el div `hero-ambient`, las clases `reveal`, `reveal-delay-*`, ni el bloque de mockups de teléfono (`hero-mockup`).

---

### Estadísticas

**Dónde encontrarla:** busca el comentario `<!-- ── ESTADÍSTICAS ──`.

Hay 4 métricas en fila. Cada una tiene un número (`.stat-value`) y una etiqueta (`.stat-label`):

```html
<div class="stat-item">
  <div class="stat-value">50<span>K+</span></div>
  <div class="stat-label">Usuarios activos</div>
</div>
```

- Cambia `50` por el número que quieras mostrar.
- La parte en `<span>...</span>` (como `K+`, `M+`, `.9`, `%`) se muestra en verde — es el sufijo o unidad.
- Cambia el texto de `.stat-label` por la descripción de la métrica.

Hay 4 bloques `stat-item` con esta estructura. Puedes actualizar todos o solo los que cambien.

**No toques:** las clases de layout ni el wrapper `.stats-grid`.

---

### Feature Entrenamiento

**Dónde encontrarla:** busca el comentario `<!-- ── FEATURE: ENTRENAMIENTO ──`.

```html
<p class="label-tag reveal">Entrenamiento</p>
<h2 class="feature-headline reveal reveal-delay-1">
  Cada sesión,<br />diseñada para ti.
</h2>
<p class="feature-body reveal reveal-delay-2">
  La IA analiza tu historial...
</p>
<ul class="feature-list reveal reveal-delay-3">
  <li>Planes de fuerza, HIIT, yoga y cardio</li>
  <li>Ajuste dinámico según tu progresión</li>
  <li>Timer de descanso y feedback en tiempo real</li>
  <li>Vídeos guía para cada ejercicio</li>
</ul>
```

- `.label-tag`: etiqueta pequeña verde encima del título (una o dos palabras).
- `.feature-headline`: título de la sección. Usa `<br />` para controlar los saltos de línea.
- `.feature-body`: párrafo descriptivo. 2-4 líneas.
- `.feature-list li`: cada `<li>` es un bullet con punto verde. Puedes añadir o eliminar items.

**No toques:** el bloque `.feature-visual` (la pantalla de mockup de la derecha) ni las clases de animación.

---

### Feature Nutrición

**Dónde encontrarla:** busca el comentario `<!-- ── FEATURE: NUTRICIÓN ──`.

Misma estructura que la sección anterior:

- `.label-tag` → etiqueta
- `.feature-headline` → título
- `.feature-body` → párrafo
- `.feature-list li` → bullets

**No toques:** el bloque `.feature-visual` con los anillos de macros y el listado de comidas.

---

### Feature Progreso

**Dónde encontrarla:** busca el comentario `<!-- ── FEATURE: PROGRESO ──`.

Misma estructura que las dos anteriores.

**No toques:** el bloque `.feature-visual` con la pantalla de recuperación estilo WHOOP.

---

### Manifesto

**Dónde encontrarla:** busca el comentario `<!-- ── MANIFESTÓ ──`.

```html
<blockquote class="manifesto-quote reveal">
  "La salud no es un <em>destino</em>.<br />
  Es un sistema."
</blockquote>
<p class="manifesto-attr reveal reveal-delay-1">Healthy — diseñado para durar.</p>
```

- `.manifesto-quote`: la cita principal. La palabra en `<em>...</em>` se muestra en verde.
- `.manifesto-attr`: la atribución debajo de la cita (tagline de marca).

**No toques:** las clases `reveal`, la etiqueta `<blockquote>` ni los atributos de clase.

---

### Descarga

**Dónde encontrarla:** busca el comentario `<!-- ── DESCARGA ──`.

```html
<h2 class="download-headline reveal reveal-delay-1">
  Descarga Healthy.<br />Es gratis.
</h2>
<p class="download-sub reveal reveal-delay-2">
  Empieza con tu plan personalizado en menos de 5 minutos.
  Sin tarjeta de crédito.
</p>
```

- `.download-headline`: título de la sección de descarga.
- `.download-sub`: subtítulo bajo el titular.

**Botones de tiendas:** cuando las apps estén publicadas, actualiza los atributos `href` con las URLs reales:

```html
<a href="#" class="store-btn">          ← cambia href="#" por la URL real de App Store
  <span class="store-btn-icon"></span>
  <span class="store-btn-text">
    <span class="store-btn-pre">Descargar en</span>
    App Store
  </span>
</a>
<a href="#" class="store-btn">          ← cambia href="#" por la URL real de Google Play
  <span class="store-btn-icon">▶</span>
  <span class="store-btn-text">
    <span class="store-btn-pre">Disponible en</span>
    Google Play
  </span>
</a>
```

Ejemplo de URLs reales:
- App Store: `https://apps.apple.com/app/healthy/id1234567890`
- Google Play: `https://play.google.com/store/apps/details?id=com.healthy.app`

**No toques:** las clases `store-btn`, `store-btn-icon`, `store-btn-text`, `store-btn-pre`.

---

### Footer

**Dónde encontrarla:** busca el comentario `<!-- ── FOOTER ──`.

**Tagline de marca:**

```html
<p class="footer-tagline">
  IA personalizada para tu salud. Entrenamiento, nutrición
  y progreso — todo en una app.
</p>
```

**Links de Producto, Compañía y Soporte:** hay tres grupos `.footer-links-group`. Cada grupo tiene un título y varios links:

```html
<div class="footer-links-group">
  <p class="footer-links-title">Producto</p>
  <a href="#">Entrenamiento</a>
  <a href="#">Nutrición</a>
  <a href="#">Progreso</a>
  <a href="#">Planes y precios</a>
</div>
```

Cambia los textos de los links y sus `href` cuando las páginas destino estén listas. No cambies los títulos de grupo (Producto / Compañía / Soporte) sin alinearlo con el equipo de diseño.

**Copyright:**

```html
<p>© 2026 Healthy. Todos los derechos reservados.</p>
```

Actualiza el año cuando llegue el momento.

---

## Cómo cambiar el color verde de la marca

Si la identidad de marca cambia, el color verde se controla desde dos variables CSS al inicio del fichero, dentro del bloque `:root`:

```css
:root {
  --green:      #22C55E;   /* verde principal */
  --green-dark: #16A34A;   /* verde en hover y estados activos */
  ...
}
```

Para cambiarlo:

1. Abre `landing/index.html`.
2. Busca `:root {` (está cerca del principio, dentro de `<style>`).
3. Cambia `#22C55E` por el nuevo color en formato hexadecimal.
4. Cambia `#16A34A` por una versión más oscura del mismo color (para hover).

Las variables `--green-glow` y `--green-muted` son versiones con opacidad del verde — si cambias el color base, actualízalas también:

```css
--green-glow:  rgba(34,197,94,0.22);   /* versión semitransparente para brillo */
--green-muted: rgba(34,197,94,0.10);   /* versión muy suave para fondos */
```

Convierte el nuevo color hex a RGB para actualizar esos valores. Por ejemplo, si el nuevo verde es `#0EA5E9` (azul), los valores RGB son `14, 165, 233`:

```css
--green-glow:  rgba(14,165,233,0.22);
--green-muted: rgba(14,165,233,0.10);
```

---

## Cómo añadir una imagen real en los mockups del hero

Actualmente los mockups del hero son elementos HTML con CSS (sin imágenes reales). Cuando tengáis capturas de pantalla de la app, podéis reemplazar el contenido del mockup por una imagen.

Localiza el bloque del mockup central (el teléfono grande) dentro de `<!-- ── HERO ──`:

```html
<div class="mockup-phone large">
  <div class="mockup-phone-notch"></div>
  <div class="mockup-screen mockup-dark-screen">
    <!-- contenido simulado actual -->
  </div>
</div>
```

Reemplaza `<div class="mockup-screen mockup-dark-screen">` y su contenido por:

```html
<img
  src="img/mockup-progress.png"
  alt="Pantalla de progreso de Healthy"
  style="width:100%; height:100%; object-fit:cover; border-radius:40px;"
/>
```

Coloca la imagen en `landing/img/mockup-progress.png` (crea la carpeta `img/` si no existe).

El mismo proceso aplica al teléfono pequeño de la izquierda — reemplaza su `.mockup-screen` con una imagen de la pantalla de home.

Recuerda que al subir imágenes nuevas hay que actualizar el deploy (el equipo técnico redesplegará la landing en Railway).

---

## Checklist antes de publicar

Antes de avisar al equipo técnico para publicar, repasa esta lista:

- [ ] El `<title>` del documento refleja el mensaje actual: `<title>Healthy — Tu mejor versión empieza hoy</title>`
- [ ] La `<meta name="description">` tiene un texto descriptivo y actual (máximo 160 caracteres)
- [ ] Los botones de App Store y Google Play tienen URLs reales (no `href="#"`)
- [ ] El año del copyright en el footer es el correcto (`© 2026`)
- [ ] Todos los links del footer apuntan a páginas que existen (no devuelven 404)
- [ ] Los números de las estadísticas son reales y actualizados
- [ ] No hay texto de placeholder como "Lorem ipsum" ni "TODO"
- [ ] El dominio en la política CSP (si hay una definida en el servidor) incluye `healthy.app`
- [ ] Has revisado el fichero en un navegador local antes de enviar (abre `index.html` directamente desde el explorador de archivos)
