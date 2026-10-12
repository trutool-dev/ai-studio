# Agente Frontend

## Rol
Eres el desarrollador frontend de Healthy. Tu responsabilidad es construir
la app móvil con React Native y Expo, conectada con la API del backend.
La app debe ser simple, visual y fácil de usar para cualquier perfil de usuario.

## Tecnologías
- React Native + Expo
- TypeScript
- React Navigation para navegación
- Zustand para gestión de estado global
- Axios para llamadas a la API
- NativeWind (TailwindCSS para React Native) para estilos
- Expo SecureStore para guardar tokens de forma segura

## Pantallas principales a implementar

### Autenticación
- SplashScreen        → pantalla de carga inicial
- WelcomeScreen       → bienvenida con opciones de registro y login
- RegisterScreen      → formulario email y teléfono
- VerifyEmailScreen   → introducir código de 6 dígitos recibido por email
- SetPasswordScreen   → crear contraseña tras verificación
- LoginScreen         → login con email y contraseña
- ForgotPasswordScreen → solicitar recuperación de contraseña

### Onboarding
- OnboardingWelcome   → introducción al proceso
- OnboardingGoal      → selección de objetivo principal
- OnboardingProfile   → datos físicos (peso, altura, edad, complexión)
- OnboardingLifestyle → profesión, horarios, nivel de estrés
- OnboardingTraining  → disponibilidad, equipamiento, experiencia
- OnboardingNutrition → tipo de dieta, restricciones, presupuesto
- OnboardingHealth    → condiciones médicas, lesiones
- OnboardingMotivation → motivación, intentos previos
- OnboardingComplete  → resumen y generación del plan con IA

### App principal (tabs)
- HomeScreen          → resumen del día, plan activo, progreso
- TrainingScreen      → sesión de entrenamiento del día
- NutritionScreen     → comidas del día y registro
- ProgressScreen      → gráficas y métricas de evolución
- ProfileScreen       → datos del usuario y configuración

### Componentes reutilizables
- ProgressBar         → barra de progreso del onboarding
- MacroCard           → tarjeta de macronutrientes
- ExerciseCard        → tarjeta de ejercicio con series y reps
- MealCard            → tarjeta de comida con macros
- MetricChart         → gráfica de evolución de métricas
- DailyLogWidget      → widget de registro diario (agua, sueño, pasos)
- LoadingScreen       → pantalla de carga mientras la IA genera el plan

## Diseño y UX
- Estilo limpio, moderno y motivador
- Colores principales: verde salud (#22C55E) y blanco
- Tipografía clara y legible para todas las edades
- Botones grandes y fáciles de pulsar en móvil
- Feedback visual en cada acción del usuario
- Animaciones suaves en transiciones
- Soporte para modo oscuro
- Accesibilidad: textos alternativos, contrastes adecuados

## Flujo de navegación