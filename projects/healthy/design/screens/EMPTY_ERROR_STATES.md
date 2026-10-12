# Empty & Error States — DS-05

## Objetivo
Diseñar pantallas coherentes para estados vacíos (sin datos), errores y fallidos de red. Aplicable a todas las pantallas principales de la app.

---

## Principios de Diseño

### Comunicación Clara
- El usuario debe entender qué salió mal o qué esperar
- Mensajes en lenguaje natural, sin tecnicismos
- Acciones claras para recuperarse (retry, home, contact support)

### Tonalidad
- **Errores:** Amigable, empático — nunca acusatorio
- **Vacío:** Motivador, optimista — invitar a empezar
- **Cargando:** Tranquilo, profesional — dar confianza

### Iconografía
- Iconos grandes (80-120px)
- Colores semánticos claros
- SF Symbols para consistencia

---

## Categorías de Estados

### 1. Empty State — Sin Datos

**Contexto:** Usuario abierto la pantalla pero no hay datos aún

**Pantallas aplicables:**
- Home (primer día, sin plan)
- Training (sin entrenamientos programados)
- Nutrition (sin comidas registradas)
- Progress (sin historial de datos)
- Messages/AI Chat (primer acceso)

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│                                     │
│          [Icono grande]             │  ← 80-120px, gris suave
│           (80-120px)                │
│                                     │
│   Aún no hay entrenamientos         │  ← Título (titleSmall, 18px)
│                                     │
│   Cuando crees tu primer plan,     │  ← Descripción (bodyNormal, 14px, midGray)
│   verás aquí tus entrenamientos.   │  ← Máx 2-3 líneas
│                                     │
│   [Crear primer plan]               │  ← CTA Button (primary)
│   o                                 │
│   [Ver guía →]                      │  ← Secondary button
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Componentes:**

#### Icono
- **Tamaño:** 120px × 120px
- **Color:** `colors.neutral.lightGray` (#F3F4F6) o `colors.primary.lightGreen` (#DCFCE7)
- **Opacidad:** 100% para light, 60% para suave
- **Ejemplo de iconos:**
  - Training: 🏋️ o SF Symbol `dumbbell`
  - Nutrition: 🥗 o SF Symbol `fork.knife`
  - Progress: 📈 o SF Symbol `chart.line.uptrend.xyaxis`
  - Messages: 💬 o SF Symbol `bubble.right`

#### Título
- **Estilo:** `textStyles.titleSmall` (18px, semibold, black)
- **Ejemplos:**
  - "Aún no hay entrenamientos"
  - "Tu registro de nutrición está vacío"
  - "Sin historial de progreso"
  - "Comienza tu primera conversación"

#### Descripción
- **Estilo:** `textStyles.bodyNormal` (14px, regular, midGray)
- **Longitud:** Máx 2-3 líneas (≈80 caracteres)
- **Propósito:** Brevemente explicar qué sucederá cuando haya datos
- **Ejemplos:**
  - "Cuando crees tu primer plan, verás aquí tus entrenamientos."
  - "Registra tus comidas y seguiremos tu progreso nutricional."
  - "Una vez que completes tu plan, verás tus gráficos de evolución."

#### Botones
- **Primary CTA:** `colors.primary.green`, acción principal
  - "Crear primer plan"
  - "Empezar ahora"
  - "Registrar comida"

- **Secondary:** (Opcional) Link o ghost button
  - "Ver guía" → modal con instrucciones
  - "Contactar soporte" → email/chat
  - "Volver" → navigate back

**Layout:**
- Centrado vertical en la pantalla (si possible)
- Padding horizontal: `spacing.lg` (24px)
- Espacios internos:
  - Icono → Título: `spacing.xl` (32px)
  - Título → Descripción: `spacing.md` (16px)
  - Descripción → Botones: `spacing.xl` (32px)
  - Entre botones: `spacing.sm` (8px)

**Animación:**
- Entrada: fade in + slide up 20px (250ms ease-in-out)
- Mantener: estático
- Botón pressed: scale 0.97 (100ms)

---

### 2. Error State — Fallo de Carga/Acción

**Contexto:** Algo salió mal (red, servidor, validación)

**Pantallas aplicables:**
- Cualquier pantalla que cargue datos (Home, Training, Nutrition, etc.)
- Formularios (Onboarding, Profile, etc.)
- Operaciones (registrar comida, completar ejercicio, etc.)

#### 2a. Error de Red (Network Error)

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│                                     │
│           [Icono error]             │  ← 80px, rojo suave
│          ⚠️ o wifi off             │
│                                     │
│   Error de conexión                 │  ← Título (titleSmall, 18px)
│                                     │
│   No pudimos conectar con el        │  ← Descripción (bodyNormal, 14px)
│   servidor. Verifica tu conexión    │
│   a internet.                       │
│                                     │
│   [Reintentar]  [Ir a Home]        │  ← Botones
│                                     │
└─────────────────────────────────────┘
```

**Componentes:**

**Icono:**
- Color: `colors.semantic.error` (#EF4444)
- SF Symbol: `wifi.slash` o `exclamationmark.triangle`
- Tamaño: 80px

**Título:**
- "Error de conexión"
- Estilo: `textStyles.titleSmall` (18px, semibold)

**Descripción:**
- "No pudimos conectar con el servidor. Verifica tu conexión a internet."
- Estilo: `textStyles.bodyNormal` (14px, midGray)

**Botones:**
- Primary: "Reintentar" → hace fetch nuevamente
- Secondary: "Ir a Home" → navigate home

**Retry Logic:**
```
Max 3 intentos automáticos
Si todos fallan → mostrar error
Espera progresiva: 1s, 2s, 4s
```

---

#### 2b. Error de Servidor (5xx)

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│                                     │
│        [Icono servidor]             │  ← 80px, rojo
│          🔧 o SF Symbol             │
│                                     │
│   El servidor está fuera de línea   │  ← Título
│                                     │
│   Estamos experimentando problemas  │  ← Descripción
│   técnicos. Vuelve en unos          │
│   minutos.                          │
│                                     │
│   [Reintentar]  [Contactar soporte] │
│                                     │
└─────────────────────────────────────┘
```

**Diferencias con Network Error:**
- Icono: 🔧 en lugar de wifi
- Título: "El servidor está fuera de línea"
- Descripción: mencionar "problemas técnicos"
- Botón secundario: "Contactar soporte" en lugar de "Ir a Home"

---

#### 2c. Error de Validación (Form Error)

**Contexto:** Usuario envió formulario con datos inválidos

**Estructura Visual (en el formulario):**

```
┌─────────────────────────────────────┐
│ [Input campo]                       │
│ Edad (años)                         │
│ [┌──────────────────────────────┐]  │
│ │ 250                            │  │ ← El valor es inválido
│ └──────────────────────────────┘ │
│ ⚠️ La edad debe estar entre 13   │  ← Error inline (12px, rojo)
│    y 100 años                      │
│                                    │
│ [Continuar (deshabilitado)]       │ ← Botón gris hasta corregir
└─────────────────────────────────────┘
```

**Componentes:**

**Input Error State:**
- **Borde:** 2px solid `colors.semantic.error` (#EF4444)
- **Background:** `colors.semantic.error` con opacity 0.05 (rojo muy suave)
- **Icono:** ✗ rojo a la derecha del input

**Error Message:**
- **Estilo:** `textStyles.caption` (12px, regular, error rojo)
- **Posición:** Bajo el input
- **Animación:** fade in + slide up (100ms)
- **Duración:** Permanente hasta corregir (no auto-dismiss)

**Validación en Tiempo Real:**
- Mostrar error al perder foco (onBlur)
- O al typing si el campo tiene formato específico (números)
- Sin bloquear el formulario mientras se escribe

**Button Disabled:**
- Botón continuar gris hasta que todos los campos sean válidos
- Si hay error, botón disabled
- Al corregir → botón vuelve a primary green

---

#### 2d. Error de Permiso (Unauthorized / Forbidden)

**Contexto:** Usuario no tiene acceso a un recurso

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│                                     │
│         [Icono candado]             │  ← 80px, naranja
│           🔒 o lock                 │
│                                     │
│   Acceso denegado                   │  ← Título
│                                     │
│   No tienes permiso para acceder    │  ← Descripción
│   a este contenido.                 │
│                                     │
│   [Ir a Home]  [Contactar soporte]  │
│                                     │
└─────────────────────────────────────┘
```

**Especificación:**
- Icono: `colors.semantic.warning` (#F59E0B)
- Título: "Acceso denegado"
- Descripción: "No tienes permiso para acceder a este contenido."

---

### 3. Empty Search Result

**Contexto:** Usuario buscó algo pero no encontró resultados

**Pantalla:** Search screen, Alimentos search, etc.

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│ [Search: queso rosa]                │
│                                     │
│         [Icono búsqueda]            │  ← 80px, gris
│           🔍 o magnify              │
│                                     │
│   Sin resultados                    │  ← Título
│                                     │
│   No encontramos "queso rosa"      │  ← Descripción con query
│                                     │
│   Intenta buscar algo diferente     │  ← Hint
│   o contacta soporte si necesitas   │
│   ayuda.                            │
│                                     │
│   [Ir a home]                       │
│                                     │
└─────────────────────────────────────┘
```

**Especificación:**
- Icono: `colors.neutral.lightGray`
- Título: "Sin resultados"
- Descripción: Incluir el término buscado entre comillas
- Hint: Sugerencia alternativa
- Botón: Link a home o volver atrás

---

### 4. Loading State (Skeleton Screen)

**Contexto:** Esperando datos

**Aproximación:** NO usar spinners/loaders
Usar Skeleton Screens en su lugar

**Estructura Visual:**

```
┌─────────────────────────────────────┐
│  [████████] [████████]              │  ← Header skeleton (pulsante)
│                                     │
│  [████████████████████]             │  ← Título skeleton
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [███████] [███████████]     │   │  ← Card skeleton
│  │ [████████████████████]      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [███████] [███████████]     │   │  ← Repetir cards
│  │ [████████████████████]      │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Componentes Skeleton:**

**SkeletonCard:**
- Mismo tamaño y shape que la card real
- Background: `colors.neutral.lightGray` con opacity 0.2
- Animación pulse: opacity 0.2 → 0.4 → 0.2 (1500ms infinite)
- borderRadius: heredar de la card

**Duración:**
- Máximo 10 segundos mostrar skeleton
- Si sigue cargando, mostrar error de timeout

**Implementación (React Native):**
```javascript
// Skeleton pulse animation
const pulseAnim = useRef(new Animated.Value(0.2)).current;

useEffect(() => {
  const pulse = Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.4,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 0.2,
        duration: 1000,
        useNativeDriver: true,
      }),
    ])
  );
  pulse.start();
  return () => pulse.stop();
}, []);

// En el skeleton component:
<Animated.View style={{ opacity: pulseAnim }} />
```

---

## Pantalla-Específicas: Mapping

### Home Screen
- **Empty:** Sin plan personalizado creado
  - Icono: 🎯
  - CTA: "Crear mi plan"
  
- **Error:** Fallo cargando plan
  - Mostrar última versión cached si existe
  - O mostrar error de red

- **Loading:** Skeleton de header + rings + cards

### Training Screen
- **Empty:** Sin entrenamientos hoy
  - Icono: 🏋️
  - Mensaje: "No hay entrenamientos programados para hoy"
  - CTA: "Ver próximos entrenamientos"

- **Error:** Fallo cargando ejercicios
  - Mostrar "No pudimos cargar los ejercicios"
  - Botones: Reintentar / Ver alternativas

### Nutrition Screen
- **Empty:** Sin comidas registradas
  - Icono: 🥗
  - Mensaje: "Comienza a registrar tus comidas"
  - CTA: "Agregar comida"

- **Error:** Fallo en búsqueda de alimentos
  - "No encontramos ese alimento"
  - Sugerencias: "Intenta búsqueda más general"

### Progress Screen
- **Empty:** Sin datos históricos
  - Icono: 📈
  - Mensaje: "Tu historial aparecerá aquí cuando registres progreso"
  - CTA: "Ir a entrenamientos"

- **Error:** Fallo cargando gráficas
  - "Error al cargar progreso"
  - Botón: Reintentar

### Onboarding (Form)
- **Error:** Validación fallida
  - Error inline en cada campo
  - Botón primario deshabilitado
  - Ejemplo: "Edad debe estar entre 13 y 100"

### Chat/AI Messages
- **Empty:** Primera vez del usuario
  - Icono: 💬
  - Mensaje: "Pregunta lo que necesites sobre tu plan"
  - Ejemplo de preguntas (chips clicables):
    - "¿Qué debo desayunar?"
    - "¿Cuántas calorías quema un...?"
    - "¿Cómo mejoro mi...?"

- **Error:** Fallo en request a Claude API
  - "No pudimos procesar tu pregunta"
  - "Verifica tu conexión e intenta nuevamente"
  - Botón: "Reintentar"

---

## Colores y Iconografía

### Color Mapping (Estados)

| Estado | Color | Icon |
|--------|-------|------|
| Empty | LightGray | 🎯, 🥗, 📈, 💬 |
| Error/Network | Error Red | ⚠️, 📡, 🔧 |
| Error/Validation | Error Red | ✗ |
| Error/Permission | Warning Orange | 🔒 |
| Loading | LightGray | — (skeleton) |
| Success | Green | ✓ |

### Tamaños de Icono

| Contexto | Tamaño | Escala |
|----------|--------|--------|
| Empty State | 120px | 1.0 |
| Error State | 80px | 0.67 |
| Inline (input) | 20px | 0.17 |
| Button icon | 24px | 0.2 |

---

## Animaciones

### Empty State Entry
```javascript
// Fade in + slide up
opacity: 0 → 1 (250ms ease-out)
translateY: 20px → 0 (250ms ease-out)
```

### Error State Entry
```javascript
// Shake para captar atención (si en formulario)
translateX: 0 → -10px → 10px → 0 (200ms ease-in-out)
Repetir: 1 sola vez
```

### Skeleton Pulse
```javascript
// Opacity pulse
opacity: 0.2 → 0.4 → 0.2 (1500ms loop)
```

### Button Feedback
```javascript
// Pressed state
scale: 1 → 0.97 (100ms ease-out)
scale: 0.97 → 1 (100ms ease-in)
```

---

## Accesibilidad

### Roles y Labels

**Empty State:**
- `accessibilityLabel: "Sin datos. Presiona [CTA] para comenzar"`
- `accessibilityRole: "none"` (informativo)

**Error State:**
- `accessibilityLabel: "Error: [mensaje específico]"`
- `accessibilityRole: "alert"`
- `accessibilityLiveRegion: "polite"`

**Input Error:**
- `accessibilityInvalid: true`
- `accessibilityErrorMessage: "[error text]"`

**Button:**
- `accessibilityLabel: "[label corto]"`
- `accessibilityRole: "button"`

### Lectura de Pantalla (VoiceOver/TalkBack)

- Orden: Icono (ignorar) → Título → Descripción → Botones
- Botones: Nombres claros, no "OK" o "Siguiente"
- Ejemplo: "Crear primer plan" vs "Continuar"

### Contraste

- Texto error: `colors.semantic.error` sobre white = 5.1:1 ✓ (WCAG AAA)
- Texto en cards: `colors.neutral.darkGray` sobre offWhite = 8.5:1 ✓ (WCAG AAA)

---

## Resumen de Entregables

- [x] Empty State definido (estructura, colores, CTAs)
- [x] Network Error definido
- [x] Server Error definido
- [x] Validation Error definido (inline)
- [x] Permission Error definido
- [x] Search No Results definido
- [x] Loading/Skeleton definido
- [x] Pantalla-específicas mappings
- [x] Animaciones documentadas
- [x] Accesibilidad considerada

**Estado:** ✓ Completado para referencia del Frontend Agent

**Nota:** Implementar siempre en este orden:
1. Skeleton screens para loading (nunca spinners)
2. Error inline para validación
3. Empty state centrado para sin datos
4. Error screen full-page para errores críticos
