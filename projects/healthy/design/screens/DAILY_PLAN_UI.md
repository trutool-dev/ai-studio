# Daily Plan Screen — DS-04

## Objetivo
Definir la jerarquía visual clara para la pantalla de plan diario, diferenciando entre entrenamiento (training) y nutrición (nutrition) usando los componentes WorkoutCard y MetricCard del sistema de diseño.

---

## Estructura General de Pantalla

### Layout Master (Home Screen)

```
┌────────────────────────────────────────┐
│  Buenos días, Antonio 👋         🔥 12  │  ← Header (altura 80dp)
│  sábado, 8 de junio                    │
├────────────────────────────────────────┤
│                                        │
│   ┌──────────────┐                     │
│   │   📊 1234    │                     │  ← Anillo de calorías (120x120)
│   │   kcal       │                     │
│   └──────────────┘                     │
│   Calorías de hoy                      │
│   Objetivo: 2000 kcal                  │
│   Restantes: 500 kcal ✓                │
│                                        │
├────────────────────────────────────────┤
│  Proteína      Carbos       Grasa      │  ← Macros (3 columnas)
│  120/160g      220/250g     70/80g     │
├────────────────────────────────────────┤
│                                        │
│  🏋️  ENTRENAMIENTO DE HOY             │  ← Sección con icono + título
│  Upper Body                            │
│  45 min · Pecho, Espalda               │
│  5/8 ejercicios                        │
│  ────────────────────── 62%            │
│                                        │
├────────────────────────────────────────┤
│  🍽️  COMIDAS                           │  ← Sección con icono + título
│  Desayuno   Almuerzo   Merienda  Cena │  ← Tabs/Chips
│   ✓          ✓           ○         ○  │
│                                        │
│  [Card: Desayuno - Omeleta y pan]     │
│  850 kcal · Proteína 45g               │
│                                        │
├────────────────────────────────────────┤
│  📈 LOG DIARIO (Agua, Sueño)          │
│  [💧 2L / 2.5L]  [😴 7h / 8h]        │
│                                        │
└────────────────────────────────────────┘
```

---

## Secciones Principales

### 1. Header (Cabecera Personalizada)

**Altura:** 80 dp (incluyendo safe area)

**Componentes:**
```
[Saludo]                          [Racha]
Buenos días, Antonio 👋           🔥 12
sábado, 8 de junio
```

**Tokens:**
- **Saludo:** `textStyles.titleMedium` (24px, semibold, black)
- **Fecha:** `textStyles.bodyNormal` (14px, regular, midGray)
- **Racha badge:**
  - Background: `colors.primary.lightGreen` (#DCFCE7)
  - Padding: `spacing.sm` (8px) vertical, `spacing.md` (16px) horizontal
  - borderRadius: `borderRadius.pill` (100px)
  - Emoji: 20px
  - Número: `textStyles.label` (12px, medium, uppercase, green)

**Dinámica:**
- Saludo cambia según hora: antes 12 = "Buenos días", 12-20 = "Buenas tardes", 20+ = "Buenas noches"
- Fecha: formato `ddd, D 'de' MMMM` en español
- Racha: número de días consecutivos de actividad

---

### 2. Anillo de Calorías (Calorie Ring — Apple Watch style)

**Altura:** 180 dp total (120 dp ring + labels)

**Componente:** DailyProgressRing

```
     ┌─────────┐
    │  1234    │  ← Center text (titleLarge, 32px, bold)
    │  kcal    │  ← Label (caption, 12px, midGray)
     └─────────┘
```

**Especificación:**
- **Ring exterior:** 120 dp de diámetro
- **Grosor anillo:** 12 dp
- **Color fondo:** `colors.neutral.lightGray` (#F3F4F6), opacity 0.3
- **Color progreso:** `colors.primary.green` (#22C55E)
- **Animación:** Fill suave al cargar (duration.medium, 300ms)
- **Texto central:** `textStyles.titleLarge` (32px, bold, black)
- **Label:** `textStyles.caption` (12px, regular, midGray)

**Interactividad:**
- Presionar anillo → detalle de calorías (modal o screen)
- Mostrar: consumed, target, remaining

**Progreso:**
```
Percentage = min(consumed / target, 1.0)
Si percentage > 1.0 → mostrar "Excedido" en rojo suave
```

---

### 3. Info de Calorías

**Layout vertical bajo el anillo:**

```
Calorías de hoy
Objetivo: 2000 kcal
Restantes: 500 kcal ✓
```

**Tokens:**
- Línea 1: `textStyles.bodyNormal` (14px, semibold, darkGray)
- Línea 2: `textStyles.caption` (12px, regular, midGray)
- Línea 3: `textStyles.caption` (12px, regular, darkGray) + checkmark verde si positive

**Colores:**
- Si restantes > 0: texto `colors.neutral.darkGray`, checkmark `colors.primary.green`
- Si restantes ≤ 0: texto `colors.semantic.error` (rojo), sin checkmark

---

### 4. Macros (Protein, Carbs, Fat)

**Layout:** 3 columnas iguales

```
Proteína      Carbos        Grasa
120/160g      220/250g      70/80g
```

**Componente:** MacroCard × 3

**Especificación MacroCard:**
- **Ancho:** 33% del contenedor (con padding `spacing.sm` entre)
- **Altura:** 100 dp
- **Background:** `colors.neutral.offWhite` (#F9FAFB)
- **borderRadius:** `borderRadius.card` (20px)
- **Padding:** `spacing.md` (16px)
- **Sombra:** `shadows.card`

**Contenido:**
- **Icono:** 32px, color (pasado por prop):
  - Proteína: `colors.semantic.info` (azul #3B82F6)
  - Carbos: `colors.semantic.warning` (naranja #F59E0B)
  - Grasas: `colors.semantic.error` (rojo #EF4444)
- **Label:** `textStyles.label` (12px, medium, uppercase, midGray)
- **Valor actual:** `textStyles.bodyLarge` (16px, bold, black)
- **Separador:** `/`
- **Target:** `textStyles.caption` (12px, regular, midGray)

**Barra de progreso opcional:**
```
[████████░░░] 75%
```
- Altura: 4px
- BorderRadius: 100px
- Color: heredar del icono

---

### 5. Sección Entrenamiento (Training Section)

**Header de Sección:**
```
🏋️  ENTRENAMIENTO DE HOY
```

**Tokens:**
- Icono: 24px, `colors.neutral.darkGray`
- Título: `textStyles.label` (12px, medium, uppercase, gray)
- Spacing: `spacing.md` (16px) entre secciones

**Componente Principal:** WorkoutCard

```
┌─────────────────────────────────────┐
│ 🏋️  Upper Body                 5/8  │
│     45 min · Pecho, Espalda         │
│                                     │
│     ███████████░░░░░░░ 62%          │
└─────────────────────────────────────┘
```

**WorkoutCard Especificación:**
- **borderRadius:** `borderRadius.card` (20px)
- **Padding:** `spacing.md` (16px)
- **Background:** `colors.neutral.white` (#FFFFFF)
- **Borde:** 1px solid `colors.neutral.lightGray` (#F3F4F6)
- **Sombra:** `shadows.card`
- **Height:** 120 dp

**Contenido:**
- **Fila 1 (Titulo + Progress):**
  - Icono: 24px, verde
  - Nombre: `textStyles.titleSmall` (18px, semibold, black)
  - Fraction: `textStyles.label` (12px, medium, midGray) — "5/8"
  
- **Fila 2 (Meta):**
  - Duration + Muscle groups: `textStyles.caption` (12px, regular, midGray)
  
- **Fila 3 (Progreso):**
  - ProgressBar: 100% ancho - 2×padding
  - Altura: 6px
  - BorderRadius: 100px
  - Color: `colors.primary.green`
  - Background: `colors.neutral.lightGray`
  - Porcentaje: `textStyles.caption` (12px, semibold, green) a la derecha

**Interactividad:**
- Presionar card → ir a TrainingScreen con detalles del entrenamiento
- Feedback: scale 0.97 al presionar (button feedback)

**Estados:**
| Estado | Background | Borde |
|--------|------------|-------|
| Normal | white | lightGray |
| Completed | lightGreen | green |
| Empty | offWhite | lightGray |

---

### 6. Sección Nutrición (Nutrition Section)

**Header de Sección:**
```
🍽️  COMIDAS
```

**Estructura:**
```
Desayuno ✓   Almuerzo ✓   Merienda   Cena
```

**Tabs/Chips:**
- **Active (completada):** Checkmark verde, background `colors.primary.lightGreen`
- **Incomplete:** Círculo gris, background transparent
- **Current selection:** Underline verde 4px

**Componente Principal:** MealCard (repetida para cada comida)

```
┌─────────────────────────────────────┐
│ 🍳 Desayuno                         │
│ Omeleta, pan tostado, café          │
│ 850 kcal · P: 45g | C: 75g | F: 25g │
│ Completado a las 08:30              │
└─────────────────────────────────────┘
```

**MealCard Especificación:**
- **borderRadius:** `borderRadius.card` (20px)
- **Padding:** `spacing.md` (16px)
- **Background:** `colors.neutral.white` (#FFFFFF)
- **Borde:** 1px solid `colors.neutral.lightGray` (#F3F4F6)
- **Sombra:** `shadows.card`
- **Height:** 110 dp

**Contenido:**
- **Fila 1:**
  - Icono: 24px, color semántico
  - Nombre comida: `textStyles.titleSmall` (18px, semibold, black)
  - Badge tiempo: `textStyles.caption` (12px, gray) — "08:30"

- **Fila 2:**
  - Alimentos: `textStyles.caption` (12px, regular, midGray, max 2 líneas)

- **Fila 3 (Macros):**
  - Calorías: `textStyles.bodyNormal` (14px, semibold, black)
  - Macros inline: `textStyles.caption` (12px, regular, midGray)
  - Ejemplo: "850 kcal · P: 45g | C: 75g | F: 25g"

**Estados:**
| Estado | Background | Indicator |
|--------|------------|-----------|
| Completed | white | ✓ verde |
| Incomplete | offWhite | ○ gris |
| Overdue | white | ⚠ naranja |

---

### 7. Widget de Log Diario (Daily Log Widget)

**Ubicación:** Sección al pie

```
📈 LOG DIARIO
┌──────────────────┬──────────────────┐
│ 💧 Agua          │ 😴 Sueño         │
│ 2.0L / 2.5L      │ 7h 20min / 8h    │
│ [+0.5L]          │ [Log]            │
└──────────────────┴──────────────────┘
```

**Componente:** DailyLogWidget

**Especificación:**
- **Layout:** 2 columnas iguales
- **Gap:** `spacing.md` (16px)
- **Height:** 120 dp total

**Card Individual:**
- **borderRadius:** `borderRadius.card` (20px)
- **Padding:** `spacing.md` (16px)
- **Background:** `colors.neutral.offWhite` (#F9FAFB)
- **Sombra:** `shadows.card`

**Contenido:**
- **Icono:** 32px
- **Label:** `textStyles.label` (12px, uppercase, gray)
- **Valor actual:** `textStyles.bodyLarge` (16px, bold, black)
- **Target:** `textStyles.caption` (12px, gray)
- **Button quick add:** pequeño botón [+] o [Log]

---

## Coherencia de Jerarquía Visual

### Niveles de Importancia (Z-order)

1. **Máxima prioridad:** Anillo de calorías (centro visual)
2. **Alta:** Entrenamiento del día (WorkoutCard)
3. **Media-Alta:** Macros (3 cards compactas)
4. **Media:** Comidas (MealCard stackable)
5. **Media-Baja:** Log diario (complementario)
6. **Baja:** Racha, detalles secundarios

### Espaciado Vertical

```
Header (80dp)
  ↓ spacing.lg (24px)
Calorie Ring (180dp)
  ↓ spacing.md (16px)
Macro Cards (100dp)
  ↓ spacing.lg (24px)
Training Section Header + Card (120dp)
  ↓ spacing.lg (24px)
Nutrition Section Header + Tabs (40dp)
  ↓ spacing.md (16px)
Meal Cards (110dp each × visible count)
  ↓ spacing.lg (24px)
Daily Log Widget (120dp)
  ↓ spacing.lg (24px) — safe area bottom
```

**Total estimado:** 1000-1200 dp (scrollable)

---

## Consistencia de Tokens

### Colores Utilizados
- ✓ Backgrounds: `colors.neutral.white`, `colors.neutral.offWhite`
- ✓ Texto: `colors.neutral.black`, `colors.neutral.darkGray`, `colors.neutral.midGray`
- ✓ Acciones: `colors.primary.green`, `colors.primary.darkGreen`, `colors.primary.lightGreen`
- ✓ Semánticos: `colors.semantic.info` (azul), `colors.semantic.warning` (naranja), `colors.semantic.error` (rojo)

### BorderRadius
- ✓ Cards: `borderRadius.card` (20px)
- ✓ Badges: `borderRadius.pill` (100px)
- ✓ Progress bars: `borderRadius.pill` (100px)

### Tipografía
- ✓ Titles: `textStyles.titleMedium` (24px) o `textStyles.titleSmall` (18px)
- ✓ Body: `textStyles.bodyNormal` (14px) o `textStyles.bodyLarge` (16px)
- ✓ Labels: `textStyles.label` (12px, uppercase)
- ✓ Captions: `textStyles.caption` (12px)

### Shadows
- ✓ Cards: `shadows.card`
- ✓ Botones CTA: `shadows.button`

---

## Animaciones en Pantalla

### Entrada de Pantalla
```
Scroll anim: Si user scrollea down
- Collapse header (reducir hauteur gradient)
- Fade out racha badge
- Pin section headers
```

### Actualización de Datos
```
1. Cargar: skeleton screens (no spinner)
2. Al recibir: fade in (150ms)
3. Actualizar progreso: anima anillo (300ms)
```

### Interacciones
```
WorkoutCard pressed → scale 0.97 (100ms)
MealCard pressed → scale 0.97 (100ms)
Log widget button → haptic feedback + increment animation
```

---

## Resumen de Componentes Utilizados

| Componente | Ubicación | Qty | Responsabilidad |
|------------|-----------|-----|-----------------|
| DailyProgressRing | Anillo | 1 | Visualizar % calorías |
| MacroCard | Macros | 3 | Mostrar proteína, carbos, grasa |
| WorkoutCard | Training | 1 | Resumen entrenamiento del día |
| MealCard | Nutrition | 4 | Resumen cada comida |
| DailyLogWidget | Log | 1 | Agua + Sueño |
| ProgressBar | Dentro cards | 3+ | Barra de % |
| Button | CTAs | varios | Navegación |

---

## Entregables

- [x] Jerarquía visual clara: anillo → macros → entrenamiento → nutrición → log
- [x] Componentes WorkoutCard especificados
- [x] Componentes MetricCard especificados
- [x] Espaciado consistente con tokens del sistema
- [x] Colores semánticos aplicados correctamente
- [x] Animaciones documentadas
- [x] Estados visuales definidos

**Estado:** ✓ Completado para referencia del Frontend Agent
