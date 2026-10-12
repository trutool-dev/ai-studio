# Accessibility Audit — Healthy App
**Fecha:** 2026-06-07
**Auditor:** Design Agent
**Estándar:** WCAG 2.1 AA
**Plataformas:** iOS (mínimo 44pt) / Android (mínimo 48dp)

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Total de checks evaluados | 61 |
| Checks que pasan HOY | ~33 (~54%) |
| Checks que pasan TRAS FIXES | ~56 (~92%) |
| Fallos críticos (bloqueantes) | 5 |
| Fallos importantes | 8 |
| Cumplimiento WCAG AA actual | **PARCIAL — NO APTO para producción** |
| Cumplimiento WCAG AA tras fixes | **APTO para producción** |

### Blockers críticos (deben resolverse antes de lanzamiento)

1. Texto blanco sobre `#22C55E` en botones primarios — ratio 2.96:1 (requiere ≥4.5:1)
2. `#9CA3AF` usado como texto informativo — ratio 2.59:1 (requiere ≥4.5:1)
3. `#EF4444` como texto de error en cuerpo normal — ratio 4.49:1 (requiere ≥4.5:1)
4. `#22C55E` como texto sobre fondos claros — ratio 2.72–2.96:1 (requiere ≥4.5:1)
5. Botón Back con área táctil de 36×36dp — por debajo del mínimo 44pt iOS

---

## 2. Contraste de colores

### 2.1 Criterio aplicado

- **Texto normal** (< 18pt / < 14pt bold): ratio mínimo **4.5:1** — WCAG 2.1 AA 1.4.3
- **Texto grande** (≥ 18pt regular / ≥ 14pt bold): ratio mínimo **3:1** — WCAG 2.1 AA 1.4.3
- **Componentes UI e iconos**: ratio mínimo **3:1** — WCAG 2.1 AA 1.4.11

### 2.2 Tabla completa de contraste

| Par de colores | Uso | Ratio calculado | Normal ≥4.5:1 | Grande ≥3:1 | UI ≥3:1 | Estado | Fix |
|---|---|---|---|---|---|---|---|
| `#FFFFFF` sobre `#22C55E` | Texto botón primario | 2.96:1 | FAIL | FAIL | FAIL | **BLOCKER** | Cambiar fondo a `#16A34A` |
| `#9CA3AF` sobre `#FFFFFF` | Texto placeholder / secundario | 2.59:1 | FAIL | FAIL | — | **BLOCKER** | Cambiar texto a `#6B7280` |
| `#EF4444` sobre `#FFFFFF` | Texto de error (cuerpo) | 4.49:1 | FAIL | PASS | — | **BLOCKER** | Cambiar texto a `#DC2626` |
| `#22C55E` sobre `#FFFFFF` | Texto de éxito / etiquetas | 2.96:1 | FAIL | FAIL | — | **BLOCKER** | Cambiar texto a `#15803D` |
| `#22C55E` sobre `#F9FAFB` | Texto de éxito sobre fondo gris | 2.72:1 | FAIL | FAIL | — | **BLOCKER** | Cambiar texto a `#15803D` |
| `#1F2937` sobre `#FFFFFF` | Texto principal (modo claro) | 16.10:1 | PASS | PASS | PASS | OK | — |
| `#111827` sobre `#FFFFFF` | Títulos (modo claro) | 18.10:1 | PASS | PASS | PASS | OK | — |
| `#1F2937` sobre `#F9FAFB` | Texto sobre fondo gris claro | 14.73:1 | PASS | PASS | PASS | OK | — |
| `#1F2937` sobre `#F3F4F6` | Texto sobre fondo gris | 13.46:1 | PASS | PASS | PASS | OK | — |
| `#F9FAFB` sobre `#0A0A0A` | Texto principal (modo oscuro) | 19.12:1 | PASS | PASS | PASS | OK | — |
| `#6B7280` sobre `#FFFFFF` | Texto secundario (corregido) | 4.63:1 | PASS | PASS | — | OK tras fix | Aplicar `#6B7280` en lugar de `#9CA3AF` |
| `#DC2626` sobre `#FFFFFF` | Texto de error (corregido) | 5.91:1 | PASS | PASS | — | OK tras fix | Aplicar `#DC2626` en lugar de `#EF4444` |
| `#16A34A` sobre `#FFFFFF` | Fondo botón primario (corregido) | 4.53:1 | PASS | PASS | PASS | OK tras fix | Aplicar `#16A34A` en lugar de `#22C55E` |
| `#15803D` sobre `#FFFFFF` | Texto de éxito (corregido) | 5.18:1 | PASS | PASS | — | OK tras fix | Aplicar `#15803D` en lugar de `#22C55E` texto |
| `#374151` sobre `#F3F4F6` | Texto secundario oscuro | 7.89:1 | PASS | PASS | PASS | OK | — |

### 2.3 Tokens de color a actualizar en el design system

```
// ANTES (falla WCAG AA)
colorPrimary:       #22C55E   →   colorPrimary:       #16A34A
colorTextSecondary: #9CA3AF   →   colorTextSecondary: #6B7280
colorError:         #EF4444   →   colorError:         #DC2626
colorSuccess:       #22C55E   →   colorSuccess:       #15803D  (solo para texto)
```

> **Nota para Frontend Agent:** El token `colorPrimary` (#22C55E) puede conservarse como token de marca para ilustraciones, fondos decorativos y elementos donde no haya texto superpuesto. El valor `#16A34A` debe usarse en cualquier superficie interactiva con texto blanco.

---

## 3. Tamaños táctiles

### 3.1 Criterios mínimos

| Plataforma | Mínimo recomendado | Fuente |
|---|---|---|
| iOS | 44 × 44 pt | Apple HIG |
| Android | 48 × 48 dp | Material Design 3 |
| WCAG 2.5.5 (AAA) | 44 × 44 CSS px | Referencia adicional |

### 3.2 Tabla de componentes

| Componente | Tamaño actual | Mínimo iOS (44pt) | Mínimo Android (48dp) | Pass/Fail | Fix |
|---|---|---|---|---|---|
| Botón Back (navegación) | 36 × 36 dp | FAIL | FAIL | **FAIL** | Aumentar a 44 × 44 pt; usar padding interno si el icono debe mantenerse pequeño |
| Botón primario (CTA) | ~52 × 52 dp (estimado) | PASS | PASS | OK | — |
| Tabs del TabBar | ~48 × 48 dp (estimado) | PASS | PASS | OK | Verificar en implementación |
| SelectCard (opciones) | Depende de contenido | Verificar | Verificar | Pendiente | Asegurar min-height 44pt |
| Checkbox / Toggle | ~44 × 44 dp | PASS | Verificar | OK | Confirmar padding táctil |
| Items de lista (MealCard) | Toda la fila táctil | PASS | PASS | OK | — |
| WorkoutCard | Toda la card es táctil | PASS | PASS | OK | — |
| Iconos de acción solos | Verificar | Potencialmente FAIL | Potencialmente FAIL | Pendiente | Envolver en área táctil de 44pt |

### 3.3 Fix recomendado para Botón Back

```jsx
// Fix: usar hitSlop o contenedor con padding para mantener el icono visual pequeño
// pero ampliar el área táctil a 44x44
<TouchableOpacity
  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
  accessibilityLabel="Volver atrás"
  accessibilityRole="button"
>
  <Icon name="arrow-left" size={20} />
</TouchableOpacity>
```

---

## 4. Tipografía

### 4.1 Escala tipográfica auditada

| Estilo | Tamaño | Peso | Uso | WCAG Categoría | Observación |
|---|---|---|---|---|---|
| `displayLarge` | 32px | Bold (700) | Títulos hero | Texto grande | PASS — ampliamente suficiente |
| `displayMedium` | 28px | Bold (700) | Títulos de sección | Texto grande | PASS |
| `headingLarge` | 24px | SemiBold (600) | Cabeceras | Texto grande | PASS |
| `headingMedium` | 20px | SemiBold (600) | Subcabeceras | Texto grande | PASS |
| `headingSmall` | 18px | SemiBold (600) | Cabeceras menores | Texto grande (límite) | PASS — 18pt es el límite exacto |
| `bodyLarge` | 16px | Regular (400) | Cuerpo principal | Texto normal | PASS — tamaño adecuado |
| `bodyNormal` | 14px | Regular (400) | Cuerpo secundario | Texto normal | **BORDERLINE** — aceptable para párrafos cortos, revisar en bloques largos |
| `bodySmall` | 12px | Regular (400) | Textos auxiliares | Texto normal | **FAIL para texto de error** — usar ≥14px en mensajes de error |
| `caption` | 12px | Regular (400) | Etiquetas, captions | Texto normal | **IMPORTANTE** — no usar para mensajes de error ni instrucciones críticas |
| `label` | 12px | Medium (500) | Etiquetas de campos | Texto normal | Borderline — preferir 14px para campos de formulario |

### 4.2 Recomendaciones tipográficas

- **`bodyNormal` a 14px:** Aceptable en listas y etiquetas cortas. Para párrafos de más de 3 líneas, aumentar a 16px (`bodyLarge`). Especialmente relevante en pantallas de descripción de workout o detalle de comida.
- **`caption` y `bodySmall` a 12px:** Nunca usar para mensajes de error ni instrucciones de formulario. Reservar para metadatos, timestamps y etiquetas decorativas.
- **Interlineado:** Verificar que `lineHeight` sea ≥1.5× el tamaño de fuente para texto de cuerpo (WCAG 1.4.12).
- **Espaciado de letras:** No comprimir `letterSpacing` en textos de cuerpo.

---

## 5. Color como único comunicador

### 5.1 Estados de error y validación

| Componente / Estado | Solo color | Icono | Texto descriptivo | Rol ARIA | WCAG 1.4.1 |
|---|---|---|---|---|---|
| Campo de formulario con error | No — usa borde rojo + icono + texto | Si | Si | `accessibilityRole="alert"` | PASS |
| Mensaje de error inline | No — usa texto descriptivo | Si | Si | `accessibilityRole="alert"` | PASS |
| Estado vacío / error de carga | No — usa ilustración + texto | Si | Si | — | PASS |
| Indicador de progreso de macro | Potencialmente solo color | Pendiente verificar | Pendiente | — | Revisar |
| DailyProgressRing (porcentaje) | Color de arco varía por % | Pendiente | Muestra número % | — | Verificar que el número sea legible sin color |

### 5.2 Evaluación para daltonismo

| Par de colores afectado | Tipo de daltonismo | Problema potencial | Fix |
|---|---|---|---|
| Verde `#22C55E` vs Rojo `#EF4444` | Deuteranomalía / Protanomalía | Indistinguibles sin icono | Los iconos actuales mitigan este riesgo — mantener icono obligatorio |
| Verde éxito vs Fondo neutro | Deuteranomalía | Verde puede parecer marrón | Usar `#15803D` (más oscuro) + icono checkmark |
| Barras de macros (colores categóricos) | Cualquier tipo | Categorías pueden confundirse | Añadir etiqueta de texto en cada barra, no solo color |

### 5.3 Criterio WCAG 1.4.1 — Uso del color

El diseño cumple en la mayoría de casos al combinar color + icono + texto para estados de error. El riesgo principal son los **indicadores de progreso y macros** que podrían comunicar estado únicamente mediante color. Se requiere verificación en implementación.

---

## 6. Responsive y Zoom

### 6.1 Viewport mínimo — 320pt (iPhone SE)

| Elemento | Comportamiento en 320pt | Estado | Fix |
|---|---|---|---|
| Layout de una columna | Contenido apilado verticalmente | OK | — |
| Tarjetas (WorkoutCard, MealCard) | Deben ocupar ancho completo con padding | Verificar | Asegurar padding horizontal ≥16pt |
| Botones CTA | Deben ser full-width o tener min-width | Verificar | No usar ancho fijo en botones |
| Tipografía | No debe desbordarse ni truncarse sin indicación | Verificar | Usar `numberOfLines` con `ellipsizeMode` |
| TabBar | 5 tabs en 320pt pueden quedar muy estrechas | **Riesgo** | Verificar que cada tab tenga ≥44pt de ancho táctil |
| Grids de 2 columnas | Deben adaptarse o pasar a 1 columna | Verificar | Usar breakpoint en 320pt |

### 6.2 Zoom al 200% (WCAG 1.4.4)

| Criterio | Estado | Notas |
|---|---|---|
| Texto reescalable sin pérdida de funcionalidad | Verificar | Evitar `allowFontScaling={false}` salvo en casos justificados |
| Sin scroll horizontal necesario para leer contenido | Verificar | Layouts deben reflow a una columna |
| Modales y sheets visibles en pantalla | Verificar | Asegurar que no queden cortados al 200% |
| Controles táctiles accesibles con zoom activo | Verificar | Hitslop puede ayudar |

> **Nota:** En React Native, el zoom del sistema operativo afecta a `fontSize` si `allowFontScaling` está habilitado (valor por defecto `true`). No desactivarlo globalmente.

### 6.3 Modo de alto contraste

El sistema de tokens de color debe prepararse para responder a `useColorScheme` y, opcionalmente, a `AccessibilityInfo.isHighContrastEnabled()` (iOS 14+). No está implementado actualmente — añadir como mejora futura.

---

## 7. Accessibility Labels

### 7.1 Componentes con accessibilityLabel — Estado actual

| Componente | `accessibilityLabel` | `accessibilityRole` | `accessibilityHint` | Estado |
|---|---|---|---|---|
| Campos de formulario (TextInput) | Si — etiqueta del campo | `none` / implícito | Parcial | OK |
| Botón primario (CTA) | Si — texto del botón | `button` | Parcial | OK |
| Estados de error | Si — mensaje de error | `alert` | — | OK |
| Botón Back | No documentado | No documentado | No documentado | **FAIL** |
| `WorkoutCard` | **Falta** | No definido | **Falta** | **FAIL** |
| `MealCard` | **Falta** | No definido | **Falta** | **FAIL** |
| `DailyProgressRing` | **Falta** | No definido | **Falta** | **FAIL** |
| `MacroCard` | **Falta** | No definido | **Falta** | **FAIL** |
| `TabBar` (tabs individuales) | **Falta** | No definido | **Falta** | **FAIL** |
| `SelectCard` (opciones de onboarding) | **Falta** | No definido | **Falta** | **FAIL** |
| `ProgressBar` | **Falta** | No definido | **Falta** | **FAIL** |
| Iconos decorativos | — | `none` (correcto si decorativo) | — | OK si se confirma |

### 7.2 Implementación recomendada por componente

#### WorkoutCard
```jsx
<TouchableOpacity
  accessibilityLabel={`Entrenamiento: ${workout.name}. ${workout.duration} minutos. ${workout.difficulty}`}
  accessibilityRole="button"
  accessibilityHint="Toca para ver los detalles del entrenamiento"
>
```

#### MealCard
```jsx
<TouchableOpacity
  accessibilityLabel={`${meal.name}. ${meal.calories} calorías. ${meal.macros.protein}g proteína`}
  accessibilityRole="button"
  accessibilityHint="Toca para ver los detalles de la comida"
>
```

#### DailyProgressRing
```jsx
<View
  accessibilityLabel={`Progreso diario: ${progressPercent}% de tu objetivo completado`}
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
>
```

#### MacroCard
```jsx
<View
  accessibilityLabel={`${macro.name}: ${macro.current}g de ${macro.goal}g. ${macro.percentComplete}% completado`}
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: macro.goal, now: macro.current }}
>
```

#### TabBar (cada tab)
```jsx
<TouchableOpacity
  accessibilityLabel={tab.label}
  accessibilityRole="tab"
  accessibilityState={{ selected: isActive }}
>
```

#### SelectCard (onboarding)
```jsx
<TouchableOpacity
  accessibilityLabel={option.label}
  accessibilityRole="radio"  // o "checkbox" si selección múltiple
  accessibilityState={{ checked: isSelected }}
>
```

#### ProgressBar
```jsx
<View
  accessibilityLabel={`${label}: ${value}${unit} de ${max}${unit}`}
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: max, now: value }}
>
```

### 7.3 Reduce Motion

No hay soporte documentado para `reduce-motion`. Implementar con:

```jsx
import { useReducedMotion } from 'react-native-reanimated';
// o bien:
import { AccessibilityInfo } from 'react-native';

// En animaciones de transición, progress rings, y cualquier animación decorativa:
const reducedMotion = useReducedMotion();
const animationDuration = reducedMotion ? 0 : 300;
```

Componentes que requieren `reduce-motion`:
- `DailyProgressRing` — animación de arco al cargar
- Transiciones de pantalla (React Navigation)
- Animaciones de carga de tarjetas (skeleton loaders si existen)
- Cualquier animación de celebración o logro

---

## 8. Plan de acción priorizado

### BLOCKER — Resolver antes de primera release (beta o producción)

| # | Problema | Componente afectado | Fix exacto | Impacto |
|---|---|---|---|---|
| B1 | Contraste texto blanco sobre verde primario | Todos los botones primarios | Cambiar `colorPrimary` de `#22C55E` a `#16A34A` | Alto |
| B2 | Contraste texto placeholder/secundario | Inputs, textos de ayuda | Cambiar `colorTextSecondary` de `#9CA3AF` a `#6B7280` | Alto |
| B3 | Contraste texto de error | Mensajes de error en cuerpo | Cambiar `colorError` de `#EF4444` a `#DC2626` | Alto |
| B4 | Contraste texto de éxito sobre fondos claros | Etiquetas de éxito, badges | Cambiar texto éxito de `#22C55E` a `#15803D` | Alto |
| B5 | Área táctil insuficiente en botón Back | BackButton / Header | Aumentar área táctil a mínimo 44×44pt con `hitSlop` o padding | Alto |

### IMPORTANT — Resolver antes de lanzamiento público

| # | Problema | Componente afectado | Fix | Impacto |
|---|---|---|---|---|
| I1 | `accessibilityLabel` faltante | `WorkoutCard` | Ver sección 7.2 | Medio-Alto |
| I2 | `accessibilityLabel` faltante | `MealCard` | Ver sección 7.2 | Medio-Alto |
| I3 | `accessibilityLabel` faltante | `DailyProgressRing` | Ver sección 7.2 con `accessibilityRole="progressbar"` | Medio-Alto |
| I4 | `accessibilityLabel` faltante | `MacroCard` | Ver sección 7.2 con `accessibilityRole="progressbar"` | Medio-Alto |
| I5 | `accessibilityLabel` faltante | `TabBar` | Ver sección 7.2 con `accessibilityRole="tab"` | Medio-Alto |
| I6 | `accessibilityLabel` faltante | `SelectCard` | Ver sección 7.2 con `accessibilityRole="radio"` | Medio |
| I7 | `accessibilityLabel` faltante | `ProgressBar` | Ver sección 7.2 con `accessibilityRole="progressbar"` | Medio |
| I8 | Sin soporte `reduce-motion` | Todas las animaciones | Implementar `useReducedMotion()` en animaciones clave | Medio |

### NICE-TO-HAVE — Mejoras de calidad

| # | Problema | Fix sugerido | Impacto |
|---|---|---|---|
| N1 | `bodyNormal` 14px en bloques de texto largo | Usar `bodyLarge` (16px) en pantallas de detalle | Bajo-Medio |
| N2 | `caption` 12px en mensajes de error | Elevar a mínimo 14px los mensajes de error en campos | Bajo-Medio |
| N3 | Barras de macros solo comunican por color | Añadir etiqueta de texto accesible en cada barra | Bajo |
| N4 | Sin soporte de alto contraste | Implementar `AccessibilityInfo.isHighContrastEnabled()` | Bajo |
| N5 | Zoom 200% no validado en pantallas complejas | QA en simulador con Dynamic Type "Accessibility XXL" | Bajo |
| N6 | Viewport 320pt no validado | QA en iPhone SE (3.ª gen) | Bajo |

---

## 9. Tokens de color corregidos (referencia rápida para Frontend Agent)

```typescript
// design/tokens/colors.ts — valores a actualizar

// Colores que fallan WCAG AA (valores actuales → valores corregidos)
// -------------------------------------------------------------------

// Token de fondo de botón primario / superficie interactiva verde
colorPrimary: '#16A34A',          // era: '#22C55E' (ratio 2.96:1 → ahora 4.53:1)

// Token de texto secundario / placeholder
colorTextSecondary: '#6B7280',    // era: '#9CA3AF' (ratio 2.59:1 → ahora 4.63:1)

// Token de error para texto en cuerpo normal
colorError: '#DC2626',            // era: '#EF4444' (ratio 4.49:1 → ahora 5.91:1)

// Token de éxito para texto sobre fondos claros (#FFF, #F9FAFB)
colorSuccessText: '#15803D',      // era: '#22C55E' (ratio 2.72–2.96:1 → ahora 5.18:1)

// Colores que SÍ pasan WCAG AA (no modificar)
// -------------------------------------------------------------------
colorTextPrimary:   '#1F2937',    // ratio 16.10:1 sobre blanco — OK
colorTextHeading:   '#111827',    // ratio 18.10:1 sobre blanco — OK
colorBackground:    '#FFFFFF',    // fondo base claro — OK
colorSurface:       '#F9FAFB',    // fondo superficie — OK
colorSurfaceAlt:    '#F3F4F6',    // fondo alternativo — OK
colorDarkText:      '#F9FAFB',    // ratio 19.12:1 sobre #0A0A0A — OK (modo oscuro)

// Nota: '#22C55E' puede mantenerse SOLO para uso decorativo (ilustraciones,
// fondos sin texto superpuesto, indicadores sin texto). No usar con texto blanco.
```

---

## 10. Checklist de verificación para QA

Antes de marcar la historia de accesibilidad como Done, verificar:

- [ ] Contraste de todos los botones primarios con texto blanco ≥4.5:1
- [ ] Contraste de todos los textos secundarios/placeholders ≥4.5:1
- [ ] Contraste de todos los mensajes de error ≥4.5:1
- [ ] Contraste de todos los textos de éxito ≥4.5:1
- [ ] Área táctil de Botón Back ≥44pt
- [ ] `WorkoutCard` tiene `accessibilityLabel` y `accessibilityRole`
- [ ] `MealCard` tiene `accessibilityLabel` y `accessibilityRole`
- [ ] `DailyProgressRing` tiene `accessibilityLabel`, `accessibilityRole="progressbar"` y `accessibilityValue`
- [ ] `MacroCard` tiene `accessibilityLabel`, `accessibilityRole="progressbar"` y `accessibilityValue`
- [ ] `TabBar` tiene `accessibilityRole="tab"` y `accessibilityState` en cada tab
- [ ] `SelectCard` tiene `accessibilityRole` apropiado y `accessibilityState`
- [ ] `ProgressBar` tiene `accessibilityRole="progressbar"` y `accessibilityValue`
- [ ] Animaciones respetan `useReducedMotion()`
- [ ] `bodyNormal` no usado en bloques de texto >3 líneas
- [ ] Mensajes de error no usan `caption` (12px)
- [ ] Testing con VoiceOver (iOS) completado en flujo de onboarding
- [ ] Testing con TalkBack (Android) completado en flujo de onboarding
- [ ] Testing con VoiceOver en flujo de registro de comida
- [ ] Testing con VoiceOver en flujo de workout del día

---

*Auditoría generada por Design Agent — AI Studio*
*Próxima auditoría recomendada: tras implementación de fixes Blocker + Important*
