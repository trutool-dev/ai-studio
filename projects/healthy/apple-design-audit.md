# Apple Design Audit — Healthy App
**Fecha:** 2026-10-11
**Agente:** apple-design
**Archivos auditados:** 36

---

## Resumen ejecutivo

La app Healthy tiene una base sólida: tokens de diseño bien organizados, componentes con press feedback vía `Animated.timing` + `Pressable` y uso de `expo-blur` en el tab bar. Sin embargo, toda la capa de animación usa la API `Animated` del core de React Native en lugar de Reanimated, lo que significa que las animaciones compiten con el JS thread y degradan en dispositivos de gama media. Faltan completamente: haptics, reduced motion, la wrapper `GestureHandlerRootView`, `react-native-gesture-handler`, `expo-haptics`, y el flag `CADisableMinimumFrameDurationOnPhone` para 120 fps. El tab bar implementa un bounce de escala en lugar de ser estático, violando el principio de frecuencia de uso. El potencial de mejora es alto con un esfuerzo moderado: la estructura visual ya es buena y las correcciones críticas son principalmente de capa de animación y no de layout.

---

## Hallazgos críticos (impacto alto — rompen la sensación nativa)

### C-01: Toda la capa de animación usa Core Animated (JS thread)
- **Archivo:** Múltiples — `Button.tsx` línea 17, `Card.tsx` línea 16, `WorkoutCard.tsx` líneas 77-80, `MetricCard.tsx` líneas 77-80, `Toast.tsx` líneas 47-63, `ProgressRing.tsx` línea 105, `ProgressBar.tsx` línea 21, `Input.tsx` línea 20, `MainTabNavigator.tsx` líneas 60-64, `TrainingScreen.tsx` líneas 133-138, `OnboardingComplete.tsx` líneas 43-46
- **Principio violado:** Animate-expo regla 2 — Reanimated, not core `Animated`
- **Problema:** Cada `Animated.timing` / `Animated.spring` corre en el JS thread. Cuando el usuario navega, fetcha datos o renderiza listas largas, estas animaciones se pausan o se chopean visiblemente. En el `ExerciseRow` (WorkoutCard.tsx línea 179) hay incluso un `Animated.parallel` con `useNativeDriver: false` para la interpolación de color del checkbox, lo que fuerza la animación al JS thread con layout pass.
- **Corrección:** Migrar a `useSharedValue` + `useAnimatedStyle` de Reanimated 4. Para colores usar interpolación con `interpolateColor`. Los `withTiming` de Reanimated corren en el UI thread worklet.

### C-02: GestureHandlerRootView ausente en el root
- **Archivo:** `src/navigation/RootNavigator.tsx` línea 77 (el `NavigationContainer` no está envuelto)
- **Principio violado:** Animate-expo setup checklist — `GestureHandlerRootView` wraps the app root
- **Problema:** `react-native-gesture-handler` no está instalado y el root no tiene `GestureHandlerRootView`. Cualquier gesto implementado en el futuro (swipe-to-dismiss, drag, pull-to-refresh personalizado) fallará silenciosamente o se comportará mal.
- **Corrección:** Instalar `react-native-gesture-handler`. En `RootNavigator.tsx`, envolver el `NavigationContainer` con `<GestureHandlerRootView style={{ flex: 1 }}>`.

### C-03: Tab bar con bounce de escala — debe ser estático
- **Archivo:** `src/navigation/MainTabNavigator.tsx` líneas 60-64
- **Principio violado:** Animate-expo paso 1 — tabs 100+/día: NO animation. `animation: 'none'`
- **Problema:** El `handlePress` del tab bar ejecuta `Animated.sequence([timing(0.85), timing(1)])`. Los tabs se usan 100+ veces al día — cualquier animación de escala en este elemento viola el gate de frecuencia y añade latencia percibida al cambio de tab.
- **Corrección:** Eliminar completamente la animación de escala en `handlePress`. El feedback ya está dado por el cambio de icono (outline → filled) + punto indicador. Si se desea un feedback mínimo, solo opacidad instantánea en press-in, no escala.

### C-04: `CADisableMinimumFrameDurationOnPhone` ausente en app.json
- **Archivo:** `app.json` línea 15 (sección `ios`)
- **Principio violado:** Animate-expo 120fps — `CADisableMinimumFrameDurationOnPhone: true`
- **Problema:** Sin este flag, los iPhone Pro/Max con ProMotion (120Hz) ejecutan la app a 60fps por defecto. Toda la fluidez de las animaciones Reanimated queda a la mitad de su potencial en los dispositivos que más la aprovechan.
- **Corrección:** Añadir `"infoPlist": { "CADisableMinimumFrameDurationOnPhone": true }` dentro de `"ios": {}` en app.json.

### C-05: expo-haptics no instalado — feedback multimodal ausente
- **Archivo:** `package.json` — no aparece `expo-haptics` en dependencias
- **Principio violado:** Principio 13 (Multimodal feedback) — motion + sound + haptics
- **Problema:** Ninguna acción de la app dispara haptics. Al marcar un ejercicio completado, registrar agua, completar una sesión, o seleccionar una opción en onboarding, el usuario no recibe feedback táctil. Esto es especialmente llamativo al "terminar sesión" (TrainingScreen) y al seleccionar el objetivo en onboarding.
- **Corrección:** Instalar `expo-haptics`. Añadir `Haptics.impactAsync(ImpactFeedbackStyle.Light)` en `ExerciseRow.handlePress` (WorkoutCard.tsx línea 176) y `Haptics.notificationAsync(NotificationFeedbackType.Success)` al completar la sesión (TrainingScreen línea 186).

### C-06: Press feedback en Button usa Animated.timing linear — falta spring curve
- **Archivo:** `src/components/ui/Button.tsx` líneas 16-17
- **Principio violado:** Principio 1 (Response) + Animate-expo paso 7 — press feedback scale 0.97 en 100-150ms con easing correcto
- **Problema:** `Animated.timing(scaleAnim, { toValue: v, duration: duration.fast, useNativeDriver: true })` usa easing lineal por defecto. El `duration.fast = 100ms` no produce la sensación "física" del press feedback de Apple. El problema mayor es que es Core Animated, no Reanimated CSS transition.
- **Corrección:** Reescribir con Reanimated: `transitionProperty: 'transform', transitionDuration: '120ms', transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)'` en el estilo base (Reanimated CSS transitions), y `onPressIn` activa `pressed.value = true`. Corre en UI thread y produce el easing correcto.

### C-07: Modal sheets usan `animationType="slide"` nativo sin spring — no interruptibles
- **Archivo:** `TrainingScreen.tsx` línea 61, `ProgressScreen.tsx` líneas 97 y 152
- **Principio violado:** Principio 3 (Interruptibility) + Principio 4 (Springs over timings)
- **Problema:** Los modales usan `<Modal animationType="slide">` del core de RN, que ejecuta una animación de slide lineal pre-scripted no interruptible y sin curva spring. No se puede arrastrar el modal para dismissarlo. No hay rubber-banding ni velocity handoff.
- **Corrección:** Reemplazar con bottom sheets implementados con Reanimated + Gesture Handler (drag-to-dismiss con `Gesture.Pan()`, velocity handoff `e.velocityY` y rubber-banding). El `SetModal` en TrainingScreen y los modales de ProgressScreen son candidatos prioritarios.

### C-08: ProgressRing anima `strokeDashoffset` con `useNativeDriver: false`
- **Archivo:** `src/components/ui/ProgressRing.tsx` líneas 104-112
- **Principio violado:** Animate-expo paso 4 — `useNativeDriver: false` forces JS thread
- **Problema:** `Animated.timing(animVal, { toValue: progress, duration: 900, useNativeDriver: false })` — la animación del anillo SVG corre en el JS thread durante 900ms. En `ActivityRings`, esto son 3 animaciones JS-thread simultáneas, generando potencial jank al scrollear en ProgressScreen.
- **Corrección:** Migrar a Reanimated con `useSharedValue` y `useAnimatedProps` para el `strokeDashoffset`. Usar `withTiming(target, { duration: 600, easing: EASE_OUT })` de Reanimated. Corre en UI thread.

### C-09: `ExerciseRow` checkmark interpola color con `useNativeDriver: false`
- **Archivo:** `src/components/ui/WorkoutCard.tsx` líneas 178-200
- **Principio violado:** Animate-expo paso 4 — color animation forces JS thread layout pass
- **Problema:** `checkAnim` interpola `backgroundColor` de transparente a verde con `useNativeDriver: false`. Cada toggle de ejercicio (acción frecuente en TrainingScreen) lanza una animación color en JS thread durante 220ms.
- **Corrección:** Usar `interpolateColor` de Reanimated con `useAnimatedStyle`. Alternativa más simple: eliminar la animación de color y solo animar `opacity` del checkmark con `withTiming` de Reanimated (`useNativeDriver` equivalente → UI thread).

### C-10: `RecoveryScore` anima un valor que nunca se usa visualmente
- **Archivo:** `src/components/ui/MetricCard.tsx` líneas 147-155, 169
- **Principio violado:** Animate-expo paso 1 — código muerto que consume JS thread 1000ms
- **Problema:** `Animated.timing(scoreAnim, { toValue: score, duration: 1000, useNativeDriver: false })` — esta animación se ejecuta pero `scoreAnim` nunca se conecta a ningún estilo ni prop animada. El score se muestra directamente como `{score}%` en texto estático (línea 169). Es dead code que consume ciclos del JS thread durante 1000ms.
- **Corrección:** Eliminar `scoreAnim`, el `useRef` y el `useEffect` completos. Si se desea un contador animado, implementar correctamente con Reanimated y `useAnimatedProps` en un `Text` animado.

---

## Hallazgos moderados (impacto medio — mejoran la experiencia)

### M-01: `Input` — label flotante anima fontSize (layout pass en cada frame)
- **Archivo:** `src/components/ui/Input.tsx` líneas 17-25
- **Principio violado:** Animate-expo paso 4 — animating fontSize triggers layout pass
- **Problema:** `labelSize` interpola `fontSize` de 16 a 11. `fontSize` es una propiedad de layout, fuerza un layout recalculation en cada frame de la animación (duration: 250ms). En formularios largos (onboarding con múltiples inputs) cada focus/blur lanza un layout pass.
- **Corrección:** Animar solo `transform: [{ scale }]` + `translateY` con `useNativeDriver: true` en Core Animated, o mejor con Reanimated. El efecto visual floating label es equivalente pero sin layout pass.

### M-02: `ProgressBar` — anima `width` con porcentaje string (layout pass)
- **Archivo:** `src/components/ui/ProgressBar.tsx` líneas 21-23
- **Principio violado:** Animate-expo paso 4 — never animate width/height/margin/flex
- **Problema:** `widthAnim.interpolate` produce valores `'0%'` a `'100%'` para `width`. Animar `width` con string porcentajes requiere que RN recalcule layout en cada frame.
- **Corrección:** Usar `transform: [{ scaleX: progress }]` con `transformOrigin: 'left'` (o equivalente en RN). La barra relleno tiene ancho 100% del track, así que `scaleX` de 0 a 1 es correcto y corre en el compositor.

### M-03: `SelectCard` — sin press feedback en onboarding
- **Archivo:** `src/screens/onboarding/SelectCard.tsx` línea 12
- **Principio violado:** Animate-expo paso 7 — `scale: 0.97` en 100-150ms en cualquier pressable
- **Problema:** `SelectCard` usa `Pressable` sin ningún press feedback visual más allá del cambio de estado `selected`. En onboarding se pulsan estas tarjetas con intención, merecen feedback inmediato.
- **Corrección:** Añadir `style={({ pressed }) => [s.card, selected && s.selected, pressed && s.pressed, style]}` con `s.pressed: { transform: [{ scale: 0.97 }] }`. O usar Reanimated con `onPressIn/onPressOut`.

### M-04: `MealCard` — expansión sin transición (jarring change)
- **Archivo:** `src/components/ui/MealCard.tsx` líneas 49-75
- **Principio violado:** Principio 7 (Spatial consistency) — cambios de estado abruptos
- **Problema:** `expanded` cambia con `setState` y el detalle aparece/desaparece sin transición. El layout "salta" empujando el contenido de abajo.
- **Corrección:** Usar `Layout animation` de Reanimated: añadir `layout={LinearTransition}` al card wrapper, y `entering={FadeIn.duration(200)}` + `exiting={FadeOut.duration(150)}` al panel de detalle.

### M-05: `DailyLogWidget` — botón `+250ml` sin press feedback ni haptic
- **Archivo:** `src/components/ui/DailyLogWidget.tsx` línea 38
- **Principio violado:** Principio 13 (Multimodal) + Animate-expo paso 7
- **Problema:** El `Pressable` del botón "+250ml" no tiene `onPressIn/onPressOut` para scale feedback, ni haptic. Es una acción de commit (registro de agua).
- **Corrección:** Añadir scale 0.97 en press-in + `Haptics.impactAsync(ImpactFeedbackStyle.Light)` en onPress.

### M-06: `TouchableOpacity` usado en lugar de `Pressable` en auth y pantallas principales
- **Archivo:** `LoginScreen.tsx` líneas 50, 65, 74, 84; `RegisterScreen.tsx` líneas 43, 58; `SetPasswordScreen.tsx` línea 68; `ForgotPasswordScreen.tsx` líneas 31, 45; `ProfileScreen.tsx` líneas 245, 260; `ProgressScreen.tsx` línea 236; `TrainingScreen.tsx` líneas 88, 90
- **Principio violado:** Principio 1 (Response) — consistencia de API interactiva
- **Problema:** `TouchableOpacity` usa el legacy gesture system de RN. `Pressable` con `onPressIn` es más responsivo y permite control programático del estado pressed. Inconsistencia con el resto de la app que usa `Pressable`.
- **Corrección:** Reemplazar todos los `TouchableOpacity` por `Pressable`. Añadir feedback visual donde corresponda.

### M-07: `OnboardingLayout` — botón back con touch target de 36pt (< 44pt mínimo)
- **Archivo:** `src/screens/onboarding/OnboardingLayout.tsx` línea 22
- **Principio violado:** Animate-expo paso 7 — 44×44pt mínimo touch target
- **Problema:** `backBtn: { width: 36, height: 36 }` — 8pt por debajo del mínimo de 44pt.
- **Corrección:** Cambiar a `width: 44, height: 44` o añadir `hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}`.

### M-08: Tipografía — `bodyLarge` y `bodyNormal` con `letterSpacing: 0`
- **Archivo:** `src/theme/typography.ts` líneas 14-15
- **Principio violado:** Principio 15 (Typography) — letterSpacing es size-specific, nunca cero en body text
- **Problema:** `bodyLarge` (16pt) y `bodyNormal` (14pt) tienen `letterSpacing: 0`. Apple usa tracking levemente positivo en body text para mejorar legibilidad. `caption` (12pt) también tiene 0 cuando debería ser ligeramente positivo.
- **Corrección:** `bodyLarge: letterSpacing: 0.15`, `bodyNormal: letterSpacing: 0.1`, `caption: letterSpacing: 0.25`. Los títulos ya tienen tracking negativo correcto (bien implementado).

### M-09: `HomeScreen` — tarjeta de entrenamiento sin press feedback
- **Archivo:** `src/screens/app/HomeScreen.tsx` líneas 132-150
- **Principio violado:** Animate-expo paso 7 — todo pressable necesita scale 0.97
- **Problema:** El `Pressable` de la tarjeta de entrenamiento no tiene `onPressIn/onPressOut`.
- **Corrección:** Usar Reanimated: `const scale = useSharedValue(1)` + `onPressIn={() => { scale.value = withSpring(0.97) }}` + `onPressOut={() => { scale.value = withSpring(1) }}`.

### M-10: `TrainingScreen` — pulso de progreso en JS thread compite con scroll
- **Archivo:** `src/screens/app/TrainingScreen.tsx` líneas 130-139
- **Principio violado:** Animate-expo paso 6 — no JS thread animations during user interaction
- **Problema:** Cuando `pct > 0.5`, se lanza un loop infinito `Animated.loop + sequence` en el JS thread. Este loop compite con el scroll de la lista de ejercicios y el fetch de datos.
- **Corrección:** Migrar a Reanimated con `withRepeat(withSequence(withSpring(1.05, { duration: 600 }), withSpring(1, { duration: 600 })), -1)`. Corre en UI thread y no bloquea el JS thread.

### M-11: `MealCard` tags de motivación (OnboardingMotivation) sin press feedback
- **Archivo:** `src/screens/onboarding/OnboardingMotivation.tsx` líneas 68-79
- **Principio violado:** Animate-expo paso 7
- **Problema:** Los chips de motivación (`Pressable` en `tags`) no tienen feedback de escala en press-in.
- **Corrección:** Añadir `style={({ pressed }) => [s.tag, motivations.includes(m.id) && s.tagSel, pressed && { opacity: 0.75 }]}`.

### M-12: `WorkoutCard` ExerciseRow scale con timing en lugar de spring
- **Archivo:** `src/components/ui/WorkoutCard.tsx` líneas 186-189
- **Principio violado:** Principio 4 (Springs over timings)
- **Problema:** Feedback de scale al marcar ejercicio usa `Animated.sequence([timing(0.92, 80ms), timing(1, 150ms)])` — dos timings lineales sin físicas.
- **Corrección:** Reemplazar con Reanimated: `withSequence(withSpring(0.92, { duration: 100, dampingRatio: 1 }), withSpring(1, { duration: 200, dampingRatio: 0.7 }))`.

### M-13: `Reduced motion` ausente en toda la app
- **Archivo:** Todos los archivos con animaciones
- **Principio violado:** Principio 14 (Reduced motion) + Animate-expo paso 9
- **Problema:** Ningún componente usa `useReducedMotion()` de Reanimated. Los usuarios con "Reduce Motion" activado en iOS/Android seguirán viendo todas las animaciones.
- **Corrección:** Tras migrar a Reanimated, usar `reduceMotion: ReduceMotion.System` en todos los `withSpring/withTiming` críticos. Para animaciones de posición/slide, añadir `const reduced = useReducedMotion()` y condicionar.

---

## Oportunidades de delight (animaciones que elevarían la experiencia)

### D-01: Stagger de entrada en pantallas de onboarding
- **Archivo:** `src/screens/onboarding/OnboardingGoal.tsx`, `OnboardingLifestyle.tsx`, `OnboardingMotivation.tsx`
- **Animación propuesta:** Las `SelectCard` y chips entran con stagger de 50ms usando `entering={FadeInDown.delay(i * 50).duration(300).springify().damping(14)}` de Reanimated Layout Animations. El contenido "cae" de forma natural al navegar forward entre pasos.
- **Principio:** Nº7 (Spatial consistency) — las pantallas tienen una dirección espacial.

### D-02: Tab bar — icono activo con micro-spring de opacidad
- **Archivo:** `src/navigation/MainTabNavigator.tsx`
- **Animación propuesta:** En lugar de la escala bounce actual (que debe eliminarse por C-03), al activar un tab el icono hace un micro-fade: `opacity: withSpring(1, { duration: 150, dampingRatio: 1 })` desde 0.6. Imperceptible en uso, pero da "aliveness" al tab activo.
- **Principio:** Nº8 (Hint in direction of gesture).

### D-03: `OnboardingComplete` — celebración con spring bounce en el success state
- **Archivo:** `src/screens/onboarding/OnboardingComplete.tsx`
- **Animación propuesta:** El círculo de éxito escala desde 0.5 con `withSpring(1, { duration: 500, dampingRatio: 0.6 })` para un bounce memorable. Añadir `Haptics.notificationAsync(NotificationFeedbackType.Success)` sincrónizado. Frecuencia: rare/first-time — justifica el delight budget.
- **Principio:** Nº16.8 (Delight).

### D-04: `ExerciseRow` — checkmark con animación de escala spring + haptic
- **Archivo:** `src/components/ui/WorkoutCard.tsx`
- **Animación propuesta:** Al completar un ejercicio, el check circle hace `withSpring(1.2, { dampingRatio: 0.6 })` seguido de `withSpring(1)` — un "pop" satisfactorio. Sincronizar con `Haptics.impactAsync(ImpactFeedbackStyle.Medium)`. Frecuencia: "tens of times/day" — presupuesto near-imperceptible más haptic.
- **Principio:** Nº13 (Multimodal feedback).

### D-05: `ActivityRings` — entrada con stagger spring al montar ProgressScreen
- **Archivo:** `src/components/ui/ProgressRing.tsx`
- **Animación propuesta:** Al montar, cada anillo inicia en `progress=0` y transiciona al valor real con `withTiming(target, { duration: 800, easing: EASE_OUT })`. Los tres anillos con offset de 120ms (outer→middle→inner). Frecuencia: "occasional" — se ve al navegar a la tab Progreso.
- **Principio:** Nº4 (Springs/timing coherente) + Nº7 (Spatial consistency).

### D-06: `HomeScreen` — crossfade skeleton → contenido real
- **Archivo:** `src/screens/app/HomeScreen.tsx`
- **Animación propuesta:** En lugar del switch abrupto entre skeleton y contenido, el skeleton hace `FadeOut.duration(200)` y el contenido hace `FadeIn.duration(300)` con Reanimated Layout Animations. Previene el "layout jump".
- **Principio:** Nº7 (Spatial consistency) — preventing a jarring change.

---

## Dependencias técnicas necesarias

Lista de paquetes a instalar con `npx expo install`:

- `react-native-gesture-handler` — **NO instalado** — requerido para C-02, sheets (C-07) y gestos futuros
- `expo-haptics` — **NO instalado** — requerido para C-05 y todos los hallazgos de multimodal feedback
- `react-native-reanimated` — **YA instalado** (v4.1.1) — migrar desde Core Animated (C-01 y derivados)
- `react-native-worklets` — **YA instalado** (v0.5.1) — ya disponible
- `expo-blur` — **YA instalado** (v15.0.8) — ya en uso en MainTabNavigator (correcto)
- `lottie-react-native` — **NO instalado** — opcional, solo para D-03 si se añade Lottie

---

## Tareas generadas: 39 tareas en 6 fases
