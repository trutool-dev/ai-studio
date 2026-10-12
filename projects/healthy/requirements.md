# Requirements — Healthy App

## Descripción del proyecto
Healthy es una aplicación móvil de salud y bienestar personalizada
mediante IA. Adapta planes de nutrición y entrenamiento a cada usuario
a través de un onboarding inteligente y mejora continua basada en
el progreso real del usuario.

## Tipo de proyecto
- App móvil (iOS + Android) con React Native + Expo
- API REST con Node.js + Express
- Base de datos PostgreSQL
- Personalización con Claude API

## Usuarios objetivo
- Personas con sobrepeso que quieren perder peso
- Jóvenes que quieren ganar músculo
- Personas mayores que quieren mantenerse activas
- Cualquier persona que quiera mejorar su salud

## Diferenciadores clave
- IA que personaliza según complexión, edad, peso y objetivos
- Combina nutrición y entrenamiento en un único plan
- Interfaz simple y visual estilo Apple
- El plan evoluciona según el progreso del usuario
- Onboarding inteligente de 7 pasos

## Funcionalidades principales

### Autenticación
- Registro con email y teléfono
- Verificación por código de 6 dígitos al email
- Creación de contraseña tras verificación
- Login con email y contraseña
- Recuperación de contraseña por email
- Sesiones con JWT y refresh tokens

### Onboarding (7 pasos)
1. Objetivo principal (perder peso, ganar músculo, mantenimiento, salud)
2. Perfil físico (edad, peso, altura, complexión, género)
3. Estilo de vida (profesión, horario, nivel de estrés)
4. Preferencias de entrenamiento (días, duración, equipamiento, experiencia)
5. Nutrición (tipo de dieta, restricciones, presupuesto)
6. Salud (condiciones médicas, lesiones)
7. Motivación (motivación principal, intentos previos)

### Plan personalizado
- Generado por Claude API tras el onboarding
- Combina plan de entrenamiento y nutrición
- Cálculo de TMB, TDEE y macros con Mifflin-St Jeor
- Se regenera automáticamente según el progreso

### Entrenamiento
- Sesiones diarias con ejercicios personalizados
- Timer de descanso entre series
- Registro de peso y repeticiones
- Historial de sesiones completadas

### Nutrición
- Plan de comidas diario personalizado
- Registro de comidas con búsqueda de alimentos
- Escáner de código de barras
- Seguimiento de macros y calorías

### Progreso
- Registro de peso y medidas corporales
- Fotos de progreso en timeline
- Gráficas de evolución
- Logros desbloqueables
- Racha de días activos

### Logs diarios
- Registro de agua, sueño y pasos
- Nivel de energía y estado de ánimo
- Historial de logs

## Stack tecnológico
- Frontend: React Native + Expo + TypeScript + NativeWind
- Backend: Node.js + Express + Prisma
- Base de datos: PostgreSQL + Redis
- IA: Claude API (claude-sonnet-4-6)
- Auth: Supabase
- Cloud: AWS
- CI/CD: GitHub Actions + Expo EAS

## Requisitos no funcionales
- App disponible en iOS y Android
- Tiempo de respuesta API < 500ms
- Cobertura de tests mínima 80%
- Cumplimiento RGPD obligatorio
- Soporte modo oscuro
- Accesibilidad WCAG AA

## Estado actual del proyecto
- ✅ Schema de base de datos completo
- ✅ Backend con todos los endpoints (stubs)
- ✅ Sistema de diseño con tokens y componentes
- ✅ Servicio de IA con Claude API
- ✅ Frontend con todas las pantallas
- ✅ 217 tests en verde
- ✅ Docker y CI/CD configurados
- ✅ Documentación legal RGPD
- ⏳ Migraciones de Prisma pendientes
- ⏳ Variables de entorno reales pendientes
- ⏳ Conexión frontend-backend pendiente