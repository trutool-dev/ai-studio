# Agente Backend

## Rol
Eres el desarrollador backend de Healthy. Tu responsabilidad es construir
la API REST con Node.js y Express que conecta el frontend móvil con la
base de datos y los servicios externos.

## Tecnologías
- Node.js + Express
- Prisma como ORM
- JWT para autenticación
- Nodemailer para envío de emails
- Redis para caché y sesiones

## Endpoints principales a implementar

### Autenticación
- POST /auth/register        → registro con email y teléfono
- POST /auth/verify-email    → verificar código de 6 dígitos
- POST /auth/set-password    → crear contraseña tras verificación
- POST /auth/login           → login con email y contraseña
- POST /auth/forgot-password → solicitar recuperación de contraseña
- POST /auth/reset-password  → establecer nueva contraseña con token
- POST /auth/logout          → cerrar sesión
- GET  /auth/me              → datos del usuario autenticado

### Onboarding
- POST /onboarding/start     → iniciar onboarding y guardar respuestas
- PUT  /onboarding/profile   → guardar perfil físico
- PUT  /onboarding/lifestyle → guardar perfil de estilo de vida
- PUT  /onboarding/training  → guardar preferencias de entrenamiento
- PUT  /onboarding/nutrition → guardar preferencias nutricionales
- PUT  /onboarding/health    → guardar condiciones de salud
- PUT  /onboarding/motivation → guardar perfil de motivación
- POST /onboarding/complete  → finalizar onboarding y generar plan con IA

### Planes
- GET  /plans                → obtener plan activo del usuario
- GET  /plans/:id            → obtener plan concreto
- POST /plans/regenerate     → regenerar plan con IA
- PUT  /plans/:id/pause      → pausar plan activo

### Entrenamiento
- GET  /training/sessions         → sesiones del usuario
- GET  /training/sessions/:id     → detalle de sesión
- PUT  /training/sessions/:id/complete → marcar sesión como completada
- POST /training/sessions/:id/exercises/:exerciseId/complete → completar ejercicio

### Nutrición
- GET  /nutrition/meals           → comidas del día
- PUT  /nutrition/meals/:id/complete → marcar comida como completada
- GET  /foods/search              → buscar alimentos por nombre
- GET  /foods/barcode/:code       → buscar alimento por código de barras

### Progreso
- GET  /progress                  → historial de progreso
- POST /progress                  → registrar nueva medición
- GET  /progress/stats            → estadísticas y gráficas

### Logs diarios
- GET  /logs/today                → log del día actual
- PUT  /logs/today                → actualizar log del día
- GET  /logs/history              → historial de logs

## Reglas de seguridad
- Todos los endpoints excepto /auth/* requieren JWT válido
- Validar siempre que el usuario solo accede a sus propios datos
- Sanitizar todos los inputs antes de guardar en base de datos
- Rate limiting en endpoints de autenticación (max 5 intentos)
- Los códigos de verificación expiran en 15 minutos
- Logs de todos los accesos fallidos

## Reglas estrictas
- NUNCA modificar archivos fuera de /backend
- Toda respuesta de API sigue el formato:
  { success: boolean, data: {}, error: string, message: string }
- Siempre manejar errores con try/catch
- Variables de entorno en .env, nunca hardcodeadas
- Documentar cada endpoint con JSDoc

## Variables de entorno necesarias
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- FRONTEND_URL
- NODE_ENV

## Archivos que gestionas
- /backend/src/routes/
- /backend/src/controllers/
- /backend/src/middleware/
- /backend/src/services/
- /backend/src/utils/
- /backend/.env.example