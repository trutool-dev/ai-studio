# Onboarding UI — DS-03

## Objetivo
Definir el flujo visual coherente de 7 pasos del onboarding con barra de progreso consistente, transiciones suaves y coherencia de tokens de diseño.

## Estructura del Onboarding

### Flujo de 7 pasos
1. **Objetivo principal** — ¿Cuál es tu objetivo? (perder peso, ganar músculo, mantenerse activo, mejorar hábitos)
2. **Perfil base** — Datos personales (edad, sexo, altura, peso)
3. **Estilo de vida** — Actividad física actual (sedentario, ligero, moderado, intenso)
4. **Salud** — Condiciones de salud (lesiones, enfermedades crónicas, alergias)
5. **Motivación** — ¿Por qué? Razón principal del cambio
6. **Preferencias** — Preferencias (dieta, horarios de comida, tipo de ejercicio)
7. **Revisión** — Resumen de datos y generación del plan

---

## Especificación Visual

### Pantalla Base — OnboardingLayout

**Propósito:** Layout reutilizable para todas las pantallas de onboarding

**Estructura de Pantalla:**
```
┌─────────────────────────────────────────┐
│  [←]          [█████████░░░░░░░░░░]    │  ← Header (altura 60dp)
├─────────────────────────────────────────┤
│                                         │
│  ¿Cuál es tu objetivo?                  │  ← Título (titleMedium, 24px)
│  Elige uno — tu plan se construirá      │  ← Subtítulo (bodyNormal, 14px)
│                                         │
│                                         │
│  [Card 1]  [Card 2]                     │  ← Contenido flexible
│  [Card 3]  [Card 4]                     │
│                                         │
│  (scrollable area)                      │
│                                         │
├─────────────────────────────────────────┤
│  [Continuar]                            │  ← Footer (altura 80dp)
└─────────────────────────────────────────┘
```

**Tokens Aplicados:**
- **Fondo:** `colors.neutral.white` (#FFFFFF)
- **Padding horizontal:** `spacing.lg` (24px)
- **Padding vertical (header):** `spacing.md` (16px)
- **Padding vertical (footer):** `spacing.lg` (24px)
- **Gap entre elementos:** `spacing.md` (16px)

### Barra de Progreso

**Especificación:**
- **Altura:** 4px
- **Color fondo:** `colors.neutral.lightGray` (#F3F4F6)
- **Color progreso:** `colors.primary.green` (#22C55E)
- **Estilos:**
  - `borderRadius: 100px` (full rounded)
  - Animación suave al cambiar: `300ms ease-in-out`
  - Sombra suave: `0 2px 4px rgba(0,0,0,0.04)`

**Cálculo Visual:**
- Paso 1 de 7 → 14% de ancho
- Paso 7 de 7 → 100% de ancho
- Animación al navegar: duration `300ms`

**Código:**
```javascript
// En ProgressBar.tsx
width: (currentStep / totalSteps) * 100%
transition: width 300ms ease-in-out
```

### Botón Retroceso (Back Button)

**Especificación:**
- **Tamaño:** 36x36 dp
- **Icono:** "←" o SF Symbol `chevron.left`
- **Color:** `colors.neutral.darkGray` (#1F2937)
- **Presión:** Escala 0.97, 100ms (feedback button.primary)
- **Accesibilidad:** `accessibilityRole="button"`, `accessibilityLabel="Retroceder"`

### Variantes de Contenido

#### Variante 1: Selección (Cards)

**SelectCard Component:**
```
┌─────────────────────────────┐
│  [Icon]                     │
│  Opción                     │  ← borderRadius: 20px
│  Descripción                │  ← padding: 16px
│  ✓                          │  ← checkmark verde si selected
└─────────────────────────────┘
```

**Tokens:**
- **borderRadius:** `borderRadius.card` (20px)
- **Padding:** `spacing.md` (16px)
- **Background normal:** `colors.neutral.offWhite` (#F9FAFB)
- **Background selected:** `colors.primary.lightGreen` (#DCFCE7)
- **Borde selected:** 2px solid `colors.primary.green` (#22C55E)
- **Sombra:** `shadows.card`
- **Icono:** 40px, color: `colors.neutral.darkGray`
- **Checkmark:** 20px, color: `colors.primary.green`, posición: bottom-right

**Animación:**
- Al presionar: escala 0.95, 100ms (feedback táctil)
- Al seleccionar: background fade, 150ms ease-in-out

#### Variante 2: Inputs

**Input Component (para datos):**
- **Altura:** `componentHeight.input` (56px)
- **borderRadius:** `borderRadius.input` (12px)
- **Padding:** `spacing.md` (16px)
- **Background:** `colors.neutral.offWhite` (#F9FAFB)
- **Borde:** 1px solid `colors.neutral.lightGray` (#F3F4F6)
- **Borde activo:** 2px solid `colors.primary.green` (#22C55E)
- **Texto:** `textStyles.bodyNormal` (14px, regular)
- **Label:** `textStyles.label` (12px, medium, uppercase, color midGray)
- **Error text:** `textStyles.caption` (12px, color: error rojo)

#### Variante 3: Toggle/Radio

**Para opciones como sexo, nivel de actividad:**
```
⭕ Opción 1     🔵 Opción 2
```

- **Checkmark/Circle:** 20x20 dp
- **Spacing entre opciones:** `spacing.lg` (24px)
- **Feedback:** Escala 0.97 al presionar

---

## Transiciones Entre Pantallas

### Navegación Forward (Continuar)
```
Pantalla Actual                 Nueva Pantalla
[A]                             [B]
Opacity: 1 ─→ 0.8  ┐
Scale: 1    ─→ 0.95┤ 250ms     Opacity: 0 ─→ 1     ┐
Translate: 0 ┘      │          Scale: 1.05 ─→ 1    ├ 250ms ease-in-out
                    └──────────→Translate: 30px ┘
```

### Navegación Backward (Retroceso)
```
Pantalla Actual                 Pantalla Anterior
[A]                             [B]
Opacity: 1 ─→ 0.8  ┐
Scale: 1    ─→ 1.05┤ 250ms     Opacity: 0 ─→ 1     ┐
Translate: 0 ┘      │          Scale: 0.95 ─→ 1    ├ 250ms ease-in-out
                    └──────────→Translate: -30px ┘
```

**Duración:** `duration.normal` (250ms) para fade+slide, luego `duration.medium` (300ms) para transición completa

---

## Pantallas Específicas

### Paso 1: Objetivo Principal
**Componente:** SelectCard × 4
**Icono:** Emoji o SF Symbol (32px)
- 🔥 Perder peso
- 💪 Ganar músculo
- 🧘 Mantenerme activo
- 🌱 Mejorar hábitos

**Layout:** 2x2 grid
**Gap:** `spacing.md` (16px)

### Paso 2: Perfil Base
**Componentes:** Input × 4
- Edad (number input, rango 13-100)
- Sexo (radio group: masculino/femenino/otro)
- Altura (cm, number)
- Peso (kg, number)

**Disposición:** Vertical, inputs de ancho completo

### Paso 3: Estilo de Vida
**Componente:** SelectCard × 4 o Radio Group
- Sedentario (poco o ningún ejercicio)
- Ligero (1-2 días/semana)
- Moderado (3-4 días/semana)
- Intenso (5-7 días/semana)

### Paso 4: Salud
**Componentes:** Checkboxes + Inputs
- ☐ Lesiones actuales (text input si checked)
- ☐ Enfermedades crónicas (text input si checked)
- ☐ Alergias (text input si checked)

### Paso 5: Motivación
**Componente:** Textarea de texto libre
- Placeholder: "Cuéntanos qué te motiva a cambiar..."
- Max 500 caracteres
- Contador: `${chars}/500` en caption gris

### Paso 6: Preferencias
**Componentes:** Toggle + SelectCard
- Dieta: Balanceada / Baja en carbos / Vegetariana / Vegana
- Horarios comida: Desayuno (hora) / Almuerzo (hora) / Cena (hora)
- Tipo ejercicio: Fuerza / Cardio / Flexibilidad / Mixto

### Paso 7: Revisión (OnboardingComplete)
**Layout:**
```
Resumen del Plan
───────────────────────
Objetivo: Perder peso
Edad: 28 años
Sexo: Masculino
Altura: 178 cm
Peso: 85 kg
Actividad: Moderada

[Aceptar]  [Editar]
```

---

## Consistencia de Tokens

### Checklist de Coherencia
- ✓ Todos los títulos usan `textStyles.titleMedium` (24px, semibold)
- ✓ Todos los subtítulos usan `textStyles.bodyNormal` (14px, regular, midGray)
- ✓ Todos los SelectCard usan `borderRadius.card` (20px)
- ✓ Todos los Inputs usan `borderRadius.input` (12px)
- ✓ Todos los gaps usan `spacing.md` (16px)
- ✓ Padding horizontal consistente: `spacing.lg` (24px)
- ✓ Todos los botones primarios usan `colors.primary.green` (#22C55E)
- ✓ Todas las animaciones usan `duration.normal` (250ms) para fade+slide
- ✓ Sombras en cards: `shadows.card`
- ✓ Fondo consistente: `colors.neutral.white` (#FFFFFF)

### Estados de Componentes

**SelectCard states:**
| Estado | Background | Borde | Checkmark |
|--------|------------|-------|-----------|
| Normal | offWhite | lightGray | oculto |
| Hover | offWhite | darkGray | oculto |
| Selected | lightGreen | green | visible |
| Disabled | lightGray | lightGray | oculto |

**Button states:**
| Estado | Background | Text |
|--------|------------|------|
| Normal | primary.green | white |
| Hover | darkGreen | white |
| Pressed | darkGreen | white |
| Disabled | lightGray | midGray |

---

## Microinteracciones

### Al Seleccionar Card
```
1. Press: scale → 0.95 (100ms)
2. Release: scale → 1 (100ms)
3. Background animate: offWhite → lightGreen (150ms ease-in-out)
4. Checkmark fade in: opacity 0 → 1 (100ms)
```

### Al Presionar Continuar
```
1. Button feedback: scale 0.97 (100ms)
2. Si válido:
   - Button loading spinner (150ms)
   - Transición a siguiente pantalla (250ms)
   - Barra de progreso anima (300ms)
3. Si inválido:
   - Shake animation del campo (200ms)
   - Error message fade in (150ms)
```

### Validación en Tiempo Real
- Inputs numéricos: validación al soltar el campo
- Edad: rango 13-100, mostrar error si fuera
- Altura: rango 140-230 cm
- Peso: rango 30-250 kg
- **Sin spinner inline**, solo feedback visual

---

## Animaciones en CSS/RN

### React Native
```javascript
// Transición entre pantallas
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: duration.normal,
  useNativeDriver: true,
}).start();

// SelectCard selection
Animated.sequence([
  Animated.timing(scaleAnim, {
    toValue: 0.95,
    duration: duration.fast,
    useNativeDriver: true,
  }),
  Animated.timing(scaleAnim, {
    toValue: 1,
    duration: duration.fast,
    useNativeDriver: true,
  }),
]).start();
```

### Web (Tailwind/CSS)
```css
.card {
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.card:active {
  transform: scale(0.95);
}

.card.selected {
  @apply bg-green-50 border-green-500;
}
```

---

## Resumen de Entregables

- [x] Estructura OnboardingLayout definida (7 pasos)
- [x] Barra de progreso especificada (4px, animada)
- [x] SelectCard component definido (20px radius, 3 estados)
- [x] Input component definido (12px radius, validaciones)
- [x] Transiciones especificadas (250-300ms)
- [x] Microinteracciones detalladas
- [x] Consistencia de tokens verificada
- [x] Estados visuales documentados

**Estado:** ✓ Completado para referencia del Frontend Agent
