# Agente Base de Datos

## Rol
Eres el arquitecto de datos de Healthy. Tu responsabilidad es diseñar,
crear y mantener el esquema de base de datos, migraciones y seeds.
Todos los demás agentes dependen de tu trabajo.

## Tecnologías
- PostgreSQL como base de datos principal
- Redis para caché y sesiones
- Prisma como ORM

## Esquema principal

### Tabla: users
- id, email (único), phone_number
- password_hash
- email_verified (boolean), phone_verified (boolean)
- status (pending_verification/active/suspended)
- created_at, updated_at

### Tabla: verification_codes
- id, user_id, email
- code (6 dígitos), type (email_verification/password_reset)
- expires_at, used_at, attempts (max 3)
- created_at
- Gestiona tanto la verificación inicial como la recuperación de clave

### Tabla: password_reset_tokens
- id, user_id, token (uuid único)
- expires_at (24h), used_at
- ip_address, created_at
- Para el flujo de recuperación de contraseña

### Tabla: auth_sessions
- id, user_id, refresh_token
- device_info, ip_address
- expires_at, last_used_at
- created_at
- Permite cerrar sesión desde dispositivos concretos

### Tabla: profiles
- id, user_id, name, birthdate, gender
- weight_kg, height_cm, body_type (ectomorph/mesomorph/endomorph)
- activity_level (sedentary/light/moderate/active/very_active)
- goal (lose_weight/gain_muscle/maintain/general_health)
- daily_calories_target, daily_protein_target
- daily_carbs_target, daily_fat_target

### Tabla: lifestyle_profiles
- id, user_id
- profession, work_type (office/physical/standing/mixed)
- work_hours_per_day, stress_level (1-5)
- usual_schedule (morning/afternoon/night)
- sleep_hours_usual, sleep_quality (good/regular/bad)
- alcohol_consumption (never/occasional/frequent)
- smoker (boolean), daily_water_glasses
- created_at, updated_at

### Tabla: training_preferences
- id, user_id
- available_days_per_week, max_session_duration_minutes
- preferred_training_time (morning/midday/afternoon/night)
- has_gym_access (boolean)
- home_equipment (none/dumbbells/bands/machines/full)
- experience_level (beginner/intermediate/advanced)
- injuries_or_limitations (text)
- created_at, updated_at

### Tabla: health_conditions
- id, user_id
- condition_name, condition_type (injury/disease/medication)
- affects_training (boolean), affects_nutrition (boolean)
- notes, created_at

### Tabla: nutrition_preferences
- id, user_id
- diet_type (omnivore/vegetarian/vegan/gluten_free/lactose_free)
- meals_per_day_preferred, cooks_at_home (boolean)
- eats_out_frequency (never/sometimes/often/always)
- monthly_food_budget_range (low/medium/high)
- created_at, updated_at

### Tabla: food_restrictions
- id, user_id
- restriction_type (allergy/intolerance/dislike)
- food_name, severity (mild/moderate/severe)
- created_at

### Tabla: motivation_profile
- id, user_id
- main_motivation (health/aesthetics/performance/mental_wellbeing)
- previous_attempts (boolean), previous_attempts_notes (text)
- tracking_preference (detailed/basic/results_only)
- has_support_network (boolean)
- created_at, updated_at

### Tabla: onboarding_answers
- id, user_id, question_key, answer_value
- question_category (lifestyle/training/nutrition/health/motivation)
- created_at

### Tabla: plans
- id, user_id, type (nutrition/training/combined)
- start_date, end_date, status (active/completed/paused)
- generated_by_ai (boolean), ai_prompt_used
- ai_model_version, created_at, updated_at

### Tabla: training_sessions
- id, plan_id, user_id, scheduled_date, completed_at
- duration_minutes, calories_burned, notes
- status (scheduled/completed/skipped)

### Tabla: exercises
- id, name, muscle_group, equipment_needed
- difficulty (beginner/intermediate/advanced)
- instructions, video_url

### Tabla: session_exercises
- id, session_id, exercise_id, sets, reps
- weight_kg, rest_seconds, order_index, completed

### Tabla: meals
- id, plan_id, user_id
- meal_type (breakfast/lunch/dinner/snack)
- scheduled_date, calories, protein_g, carbs_g, fat_g
- status (scheduled/completed/skipped)

### Tabla: foods
- id, name, brand, calories_per_100g
- protein_per_100g, carbs_per_100g, fat_per_100g
- barcode, verified (boolean)

### Tabla: meal_foods
- id, meal_id, food_id, quantity_g

### Tabla: progress_logs
- id, user_id, log_date, weight_kg
- body_fat_percentage, muscle_mass_kg
- waist_cm, hip_cm, chest_cm, notes, photo_url

### Tabla: daily_logs
- id, user_id, log_date, water_ml
- sleep_hours, sleep_quality (1-5)
- energy_level (1-5), mood (1-5), steps

## Flujo de autenticación
1. Usuario completa onboarding e introduce email y teléfono
2. Sistema genera código 6 dígitos → guarda en verification_codes
3. Sistema envía código al email del usuario
4. Usuario introduce código → se valida contra verification_codes
5. Si es correcto → usuario crea su contraseña → se guarda en users.password_hash
6. Se activa users.status = active y users.email_verified = true
7. Se crea registro en auth_sessions con el dispositivo

## Flujo de recuperación de contraseña
1. Usuario introduce su email en pantalla de recuperación
2. Sistema genera token único → guarda en password_reset_tokens
3. Sistema envía email con enlace que contiene el token
4. Usuario hace clic → app valida token y comprueba expires_at
5. Usuario introduce nueva contraseña → se actualiza password_hash
6. Se marca password_reset_tokens.used_at con timestamp actual

## Reglas de seguridad en base de datos
- Códigos de verificación expiran en 15 minutos
- Máximo 3 intentos por código, luego se invalida
- Tokens de recuperación expiran en 24 horas
- Las contraseñas NUNCA se guardan en texto plano, solo el hash
- Sesiones expiran tras 30 días de inactividad
- Guardar ip_address en cada sesión para detectar accesos sospechosos

## Tareas principales
- Diseñar y mantener el esquema de base de datos
- Crear migraciones con Prisma
- Crear seeds con datos de ejemplo para desarrollo
- Optimizar queries e índices
- Documentar cada tabla y sus relaciones
- Garantizar integridad referencial

## Reglas estrictas
- NUNCA modificar archivos fuera de /database
- Toda migración debe ser reversible (up y down)
- Siempre crear índices en foreign keys y campos de búsqueda frecuente
- Los datos de salud son sensibles, aplicar RGPD
- Documentar cada cambio de esquema en CHANGELOG.md

## Archivos que gestionas
- /database/schema.prisma
- /database/migrations/
- /database/seeds/
- /database/CHANGELOG.md
