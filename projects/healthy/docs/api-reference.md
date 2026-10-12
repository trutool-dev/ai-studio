# API Reference — Healthy

Referencia de todos los endpoints REST de la API de Healthy.

**Base URL (producción):** `https://ai-studio-production-1835.up.railway.app/v1`  
**Base URL (staging):** `https://backend-staging-01ee.up.railway.app/v1`  
**Base URL (desarrollo):** `http://localhost:3000`

Todos los endpoints protegidos requieren el header:
```
Authorization: Bearer <access_token>
```

El prefijo `/v1` se añade en el router principal del backend. En desarrollo las rutas están directamente en la raíz.

---

## Formato de respuesta

### Respuesta de éxito

```json
{
  "success": true,
  "data": { ... },
  "message": "Descripción del resultado"
}
```

### Respuesta de error

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Descripción legible del error"
}
```

---

## Health Check

### GET `/health`

Comprueba el estado del servidor, la base de datos y Redis. No requiere autenticación.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-06-07T10:00:00.000Z",
    "version": "1.0.0",
    "db": "connected",
    "redis": "connected"
  },
  "message": "Servidor operativo"
}
```

**Respuesta 503** si la BD o Redis no responden.

> Nota de seguridad: este endpoint expone la versión del paquete y el estado de los servicios internos. En producción debe protegerse con autenticación básica o limitarse el detalle de la respuesta (VUL-2026-017).

---

## Autenticación (`/auth`)

Todos los endpoints de auth excepto `/auth/me` y `/auth/logout` son públicos. Los sensibles tienen rate limiting: **máx. 5 requests / 15 min / IP**.

---

### POST `/auth/register`

Registra un nuevo usuario con email. Envía un código OTP de 6 dígitos al email para verificación.

**Rate limit:** 5 req / 15min / IP

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "phone_number": "+34600000000"
}
```
`phone_number` es opcional.

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email": "usuario@ejemplo.com"
  },
  "message": "Cuenta creada. Revisa tu email para verificarla."
}
```

**Errores:**
- `409 EMAIL_ALREADY_EXISTS` — ya existe una cuenta con ese email

---

### POST `/auth/verify-email`

Verifica el email con el código OTP de 6 dígitos enviado en el registro.

**Rate limit:** 5 req / 15min / IP

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "code": "123456"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "user_id": "uuid" },
  "message": "Email verificado. Ahora puedes crear tu contraseña."
}
```

**Errores:**
- `400 INVALID_CODE` — código incorrecto
- `400 CODE_MAX_ATTEMPTS` — máximo 3 intentos alcanzados
- `400 CODE_EXPIRED` — el código ha expirado (TTL: 15 minutos)
- `404 NOT_FOUND` — usuario no encontrado

---

### POST `/auth/resend-code`

Reenvía un nuevo código de verificación al email indicado.

**Rate limit:** 5 req / 15min / IP

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta 200:** Siempre devuelve éxito (no confirma si el email existe, por privacidad).

---

### POST `/auth/set-password`

Establece la contraseña del usuario tras verificar el email. Este es el paso final del registro.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiContraseña123"
}
```
`password` debe tener mínimo 8 caracteres.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Contraseña establecida. Ya puedes iniciar sesión."
}
```

**Errores:**
- `400 EMAIL_NOT_VERIFIED` — el email no ha sido verificado todavía
- `404 NOT_FOUND` — usuario no encontrado

---

### POST `/auth/login`

Autentica al usuario con email y contraseña. Devuelve un par de tokens JWT.

**Rate limit:** 5 req / 15min / IP

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiContraseña123"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbG...",
    "refresh_token": "uuid.timestamp",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "status": "active"
    }
  },
  "message": "Sesión iniciada"
}
```
`expires_in` es en segundos (900 = 15 minutos).

**Errores:**
- `401 INVALID_CREDENTIALS` — email o contraseña incorrectos
- `403 ACCOUNT_INACTIVE` — la cuenta no está activa

---

### POST `/auth/forgot-password`

Solicita un email de recuperación de contraseña. El enlace expira en 24 horas.

**Rate limit:** 5 req / 15min / IP

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta 200:** Siempre devuelve éxito (no confirma si el email existe, por privacidad).

---

### POST `/auth/reset-password`

Restablece la contraseña usando el token recibido por email. Invalida todas las sesiones activas del usuario.

**Body:**
```json
{
  "token": "token-del-email",
  "password": "NuevaContraseña123"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Contraseña restablecida. Ya puedes iniciar sesión."
}
```

**Errores:**
- `400 INVALID_TOKEN` — token inválido
- `400 TOKEN_USED` — el enlace ya fue utilizado
- `400 TOKEN_EXPIRED` — el enlace ha expirado

---

### POST `/auth/refresh`

Rota el refresh token y devuelve un nuevo par de tokens. Implementa token rotation: el refresh token anterior queda invalidado.

**Body:**
```json
{
  "refresh_token": "uuid.timestamp"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbG...",
    "refresh_token": "nuevo-uuid.timestamp",
    "token_type": "Bearer",
    "expires_in": 900
  },
  "message": "Token renovado"
}
```

**Errores:**
- `401 INVALID_TOKEN` — refresh token no encontrado
- `401 TOKEN_EXPIRED` — sesión expirada (>30 días), debe hacer login de nuevo
- `403 ACCOUNT_INACTIVE` — cuenta inactiva

---

### POST `/auth/logout`

Invalida la sesión actual (refresh token en BD + entrada en Redis). Requiere autenticación.

**Headers:** `Authorization: Bearer <access_token>`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Sesión cerrada"
}
```

---

### GET `/auth/me`

Devuelve los datos del usuario autenticado incluyendo su perfil físico.

**Headers:** `Authorization: Bearer <access_token>`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "phone_number": "+34600000000",
      "email_verified": true,
      "phone_verified": false,
      "status": "active",
      "created_at": "2026-06-07T10:00:00.000Z",
      "profile": {
        "name": "Ana García",
        "birthdate": "1990-01-15",
        "gender": "female",
        "weight_kg": "65.5",
        "height_cm": "168",
        "goal": "lose_weight",
        "activity_level": "moderate"
      }
    }
  },
  "message": "Datos del usuario"
}
```

---

## Onboarding (`/onboarding`)

Todos los endpoints requieren autenticación. El flujo completo es:
1. `POST /onboarding/start` — iniciar
2. `PUT /onboarding/profile` — paso 1: datos físicos
3. `PUT /onboarding/lifestyle` — paso 2: estilo de vida
4. `PUT /onboarding/training` — paso 3: preferencias de entrenamiento
5. `PUT /onboarding/nutrition` — paso 4: preferencias nutricionales
6. `PUT /onboarding/health` — paso 5: condiciones de salud
7. `PUT /onboarding/motivation` — paso 6: motivación
8. `POST /onboarding/complete` — paso 7: generar plan con IA

Los pasos 2-6 son opcionales para completar el onboarding, pero cuanta más información se proporcione, mejor será el plan generado. Solo `profile` y `training` son obligatorios para `POST /onboarding/complete`.

---

### POST `/onboarding/start`

Inicializa el onboarding para el usuario autenticado. Idempotente.

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "user_id": "uuid" },
  "message": "Onboarding iniciado. Completa los pasos del perfil."
}
```

---

### PUT `/onboarding/profile`

Guarda el perfil físico del usuario (paso 1). Upsert: crea o actualiza.

**Body:**
```json
{
  "name": "Ana García",
  "birthdate": "1990-01-15",
  "gender": "female",
  "weight_kg": 65.5,
  "height_cm": 168,
  "body_type": "mesomorph",
  "activity_level": "moderate",
  "goal": "lose_weight"
}
```

Valores válidos para `gender`: `male`, `female`, `non_binary`, `prefer_not_to_say`  
Valores válidos para `activity_level`: `sedentary`, `light`, `moderate`, `active`, `very_active`  
Valores válidos para `goal`: `lose_weight`, `gain_muscle`, `maintain`, `general_health`

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "profile": { ... } },
  "message": "Perfil guardado correctamente"
}
```

---

### PUT `/onboarding/lifestyle`

Guarda el perfil de estilo de vida (paso 2). Upsert.

**Body:**
```json
{
  "profession": "Desarrollador de software",
  "work_type": "sedentary",
  "work_hours_per_day": 8,
  "stress_level": 3,
  "usual_schedule": "morning",
  "sleep_hours_usual": 7.5,
  "sleep_quality": 3,
  "alcohol_consumption": "occasional",
  "smoker": false,
  "daily_water_glasses": 6
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "lifestyle": { ... } },
  "message": "Estilo de vida guardado correctamente"
}
```

---

### PUT `/onboarding/training`

Guarda las preferencias de entrenamiento (paso 3). Upsert.

**Body:**
```json
{
  "available_days_per_week": 4,
  "max_session_duration_minutes": 60,
  "preferred_training_time": "morning",
  "has_gym_access": true,
  "home_equipment": ["dumbbells", "resistance_bands"],
  "experience_level": "intermediate",
  "injuries_or_limitations": "Dolor lumbar crónico"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "training": { ... } },
  "message": "Preferencias de entrenamiento guardadas"
}
```

---

### PUT `/onboarding/nutrition`

Guarda las preferencias nutricionales (paso 4). Upsert.

**Body:**
```json
{
  "diet_type": "omnivore",
  "meals_per_day_preferred": 4,
  "cooks_at_home": true,
  "eats_out_frequency": "weekly",
  "monthly_food_budget_range": "200-400"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "nutrition": { ... } },
  "message": "Preferencias nutricionales guardadas"
}
```

---

### PUT `/onboarding/health`

Guarda las condiciones de salud y restricciones alimentarias (paso 5). Reemplaza los registros existentes.

**Body:**
```json
{
  "conditions": [
    {
      "condition_name": "Hipertensión",
      "condition_type": "cardiovascular",
      "affects_training": true,
      "affects_nutrition": true,
      "notes": "Controlada con medicación"
    }
  ],
  "food_restrictions": [
    {
      "restriction_type": "allergy",
      "food_name": "Gluten",
      "severity": "high"
    }
  ]
}
```

Ambos arrays son opcionales. Si se pasan vacíos, se eliminan los registros anteriores.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Condiciones de salud guardadas"
}
```

> Nota de seguridad: los campos `condition_name` y `notes` contienen datos de categoría especial (Art. 9 RGPD) y deben cifrarse en reposo (VUL-2026-006).

---

### PUT `/onboarding/motivation`

Guarda el perfil de motivación (paso 6). Upsert.

**Body:**
```json
{
  "main_motivation": "improve_health",
  "previous_attempts": true,
  "previous_attempts_notes": "Intenté dieta Keto pero no la mantuve",
  "tracking_preference": "daily",
  "has_support_network": true
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "motivation": { ... } },
  "message": "Perfil de motivación guardado"
}
```

---

### POST `/onboarding/complete`

Finaliza el onboarding y dispara la generación del plan personalizado con IA (Claude API con prompt caching). Crea las sesiones de entrenamiento y comidas para las próximas semanas. Si la IA no está disponible, genera un plan de fallback por reglas.

Este endpoint puede tardar entre 5 y 15 segundos mientras la IA genera el plan.

Requiere que `PUT /onboarding/profile` y `PUT /onboarding/training` se hayan completado previamente.

**Body (opcional):**
```json
{
  "answers": [
    { "question_key": "primary_goal", "answer_value": "lose 10kg" }
  ]
}
```

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "uuid",
      "status": "active",
      "start_date": "2026-06-07T00:00:00.000Z",
      "end_date": "2026-07-19T00:00:00.000Z",
      "generated_by_ai": true
    },
    "generated_plan": {
      "training_plan": {
        "weeks": 6,
        "weekly_schedule": [ ... ]
      },
      "nutrition_plan": {
        "daily_calories": 1800,
        "meal_suggestions": [ ... ]
      }
    },
    "metabolism": {
      "bmr": 1420,
      "tdee": 1990,
      "target_calories": 1690
    }
  },
  "message": "Onboarding completado. Tu plan personalizado ha sido generado."
}
```

**Errores:**
- `400 PROFILE_REQUIRED` — el perfil físico no está completado
- `400 TRAINING_REQUIRED` — las preferencias de entrenamiento no están completadas

---

## Planes (`/plans`)

Todos los endpoints requieren autenticación.

---

### GET `/plans`

Devuelve el plan activo del usuario con las sesiones de entrenamiento próximas (30 días) y las comidas del día actual.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "uuid",
      "type": "combined",
      "status": "active",
      "start_date": "2026-06-07T00:00:00.000Z",
      "end_date": "2026-07-19T00:00:00.000Z",
      "generated_by_ai": true,
      "training_sessions": [ ... ],
      "meals": [ ... ]
    }
  },
  "message": "Plan activo"
}
```

**Errores:**
- `404 NOT_FOUND` — el usuario no tiene plan activo (completar el onboarding primero)

---

### GET `/plans/:id`

Devuelve el detalle completo de un plan específico, incluyendo todos sus ejercicios (con detalle de cada ejercicio) y todas sus comidas (con alimentos y macros).

**Params:** `id` — UUID del plan

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "uuid",
      "training_sessions": [
        {
          "id": "uuid",
          "scheduled_date": "2026-06-07T00:00:00.000Z",
          "status": "scheduled",
          "session_exercises": [
            {
              "exercise": { "name": "Sentadilla", "muscle_group": "legs", ... },
              "sets": 4,
              "reps": 12,
              "weight_kg": null,
              "completed": false
            }
          ]
        }
      ],
      "meals": [
        {
          "meal_type": "breakfast",
          "scheduled_date": "...",
          "calories": 450,
          "meal_foods": [ ... ]
        }
      ]
    }
  },
  "message": "Plan"
}
```

**Errores:**
- `404 NOT_FOUND` — plan no encontrado o no pertenece al usuario

---

### POST `/plans/regenerate`

Solicita la regeneración del plan con IA, usando el historial de progreso de las últimas 4 semanas para contexto. El plan anterior pasa a estado `paused` y se crea uno nuevo activo.

> Rate limiting: `planRegenerateLimiter` (máx. 3 regeneraciones/usuario/24h) + `apiLimiter` global (100 req/15min). VUL-2026-005 resuelto.

**Body:**
```json
{
  "reason": "manual_request"
}
```

Valores válidos para `reason`: `manual_request`, `goal_change`, `injury`, `plateau`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "plan_id": "uuid",
    "generated_plan": { ... }
  },
  "message": "Plan regenerado correctamente"
}
```

**Errores:**
- `400 ONBOARDING_INCOMPLETE` — el onboarding no está completo

---

### PUT `/plans/:id/pause`

Pausa un plan activo del usuario.

**Params:** `id` — UUID del plan

**Respuesta 200:**
```json
{
  "success": true,
  "data": {},
  "message": "Plan pausado correctamente"
}
```

**Errores:**
- `400 PLAN_ALREADY_PAUSED` — el plan ya está pausado
- `404 NOT_FOUND` — plan no encontrado

---

## Entrenamiento (`/training`)

Todos los endpoints requieren autenticación.

---

### GET `/training/today`

Devuelve las sesiones de entrenamiento programadas para hoy. Alias de `GET /training/sessions?date=<today>`.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "scheduled_date": "2026-06-07T00:00:00.000Z",
        "status": "scheduled",
        "session_exercises": [ ... ]
      }
    ],
    "total": 1
  },
  "message": "Sesiones de entrenamiento"
}
```

---

### GET `/training/sessions`

Lista las sesiones de entrenamiento del usuario con filtros opcionales.

**Query params:**
- `date` — filtrar por fecha (formato `YYYY-MM-DD`)
- `status` — filtrar por estado (`scheduled`, `completed`, `skipped`)

**Respuesta 200:** igual que `/training/today`

---

### GET `/training/sessions/:id`

Devuelve el detalle de una sesión con todos sus ejercicios y el plan al que pertenece.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "scheduled_date": "...",
      "status": "scheduled",
      "duration_minutes": null,
      "calories_burned": null,
      "session_exercises": [
        {
          "id": "uuid",
          "exercise": {
            "id": "uuid",
            "name": "Press de banca",
            "muscle_group": "chest",
            "equipment": "barbell"
          },
          "sets": 3,
          "reps": 10,
          "weight_kg": null,
          "completed": false,
          "order_index": 1
        }
      ],
      "plan": { "id": "uuid", "status": "active" }
    }
  },
  "message": "Detalle de sesión"
}
```

**Errores:**
- `404 NOT_FOUND` — sesión no encontrada

---

### PUT `/training/sessions/:id/complete`

Marca una sesión como completada y registra duración y calorías.

**Body:**
```json
{
  "duration_minutes": 55,
  "calories_burned": 320,
  "notes": "Buen entrenamiento, aumenté el peso en press"
}
```
Todos los campos son opcionales.

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "session": { "id": "uuid", "status": "completed", "completed_at": "...", ... } },
  "message": "Sesión completada correctamente"
}
```

**Errores:**
- `400 SESSION_ALREADY_COMPLETED` — la sesión ya fue completada
- `404 NOT_FOUND` — sesión no encontrada

---

### POST `/training/sessions/:id/exercises/:exerciseId/sets`

Registra una serie completada de un ejercicio dentro de una sesión (peso y repeticiones). También disponible en `/training/sessions/:id/exercises/:exerciseId/complete` por compatibilidad.

**Params:** `id` — UUID de la sesión, `exerciseId` — UUID del ejercicio

**Body:**
```json
{
  "weight_kg": 80,
  "reps": 10
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "session_exercise": {
      "id": "uuid",
      "weight_kg": "80",
      "reps": 10,
      "completed": true
    }
  },
  "message": "Serie registrada correctamente"
}
```

**Errores:**
- `404 NOT_FOUND` — sesión o ejercicio no encontrado

---

## Nutrición (`/nutrition`)

Todos los endpoints requieren autenticación.

---

### GET `/nutrition/today`

Devuelve las comidas programadas para hoy con sus alimentos y macros totales del día. Alias de `GET /nutrition/meals?date=<today>`.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "meals": [
      {
        "id": "uuid",
        "meal_type": "breakfast",
        "scheduled_date": "...",
        "calories": 450,
        "protein_g": "35.5",
        "carbs_g": "45.0",
        "fat_g": "12.0",
        "status": "scheduled",
        "meal_foods": [ ... ]
      }
    ],
    "totals": {
      "calories": 1800,
      "protein_g": 135,
      "carbs_g": 180,
      "fat_g": 60,
      "completed": 2
    },
    "total_meals": 4
  },
  "message": "Comidas del día"
}
```

---

### GET `/nutrition/meals`

Lista las comidas con filtro opcional por fecha.

**Query params:**
- `date` — filtrar por fecha (formato `YYYY-MM-DD`). Por defecto: hoy.

**Respuesta 200:** igual que `/nutrition/today`

---

### PUT `/nutrition/meals/:id/complete`

Marca una comida como completada.

**Params:** `id` — UUID de la comida

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "meal": { "id": "uuid", "status": "completed", ... } },
  "message": "Comida marcada como completada"
}
```

**Errores:**
- `400 MEAL_ALREADY_COMPLETED` — la comida ya fue completada
- `404 NOT_FOUND` — comida no encontrada

---

## Alimentos (`/foods`)

Todos los endpoints requieren autenticación. Las búsquedas tienen caché Redis de 6 horas.

---

### GET `/foods/search`

Busca alimentos en el catálogo por nombre (búsqueda insensible a mayúsculas). Devuelve máximo 20 resultados ordenados por verificados primero.

**Query params:**
- `q` — texto de búsqueda (mínimo 2 caracteres, requerido)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "foods": [
      {
        "id": "uuid",
        "name": "Pechuga de pollo",
        "calories_per_100g": 165,
        "protein_per_100g": "31.0",
        "carbs_per_100g": "0.0",
        "fat_per_100g": "3.6",
        "verified": true
      }
    ],
    "total": 1,
    "from_cache": false
  },
  "message": "Alimentos encontrados"
}
```

**Errores:**
- `400 QUERY_TOO_SHORT` — la búsqueda debe tener al menos 2 caracteres

---

### GET `/foods/barcode/:code`

Busca un alimento por su código de barras EAN.

**Params:** `code` — código de barras

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "food": { ... } },
  "message": "Alimento encontrado"
}
```

**Errores:**
- `404 NOT_FOUND` — no se encontró alimento con ese código de barras

---

## Progreso (`/progress`)

Todos los endpoints requieren autenticación.

---

### GET `/progress`

Devuelve el historial de registros de progreso corporal del usuario, ordenados por fecha descendente.

**Query params:**
- `limit` — número de registros (por defecto: 30, máximo: 100)
- `offset` — desplazamiento para paginación (por defecto: 0)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "log_date": "2026-06-07T00:00:00.000Z",
        "weight_kg": "75.5",
        "body_fat_percentage": "18.2",
        "muscle_mass_kg": "62.0",
        "waist_cm": "82.0",
        "hip_cm": "95.0",
        "chest_cm": "98.0",
        "notes": "Me siento con más energía",
        "photo_url": null
      }
    ],
    "total": 12,
    "limit": 30,
    "offset": 0
  },
  "message": "Historial de progreso"
}
```

---

### POST `/progress`

Crea un nuevo registro de progreso corporal. Solo se permite un registro por día.

**Body:**
```json
{
  "log_date": "2026-06-07",
  "weight_kg": 75.5,
  "body_fat_percentage": 18.2,
  "muscle_mass_kg": 62.0,
  "waist_cm": 82.0,
  "hip_cm": 95.0,
  "chest_cm": 98.0,
  "notes": "Me siento con más energía",
  "photo_url": "https://..."
}
```

Todos los campos excepto `log_date` son opcionales.

**Respuesta 201:**
```json
{
  "success": true,
  "data": {
    "log": { ... },
    "needs_plan_regeneration": false
  },
  "message": "Registro de progreso creado"
}
```

`needs_plan_regeneration` es `true` si el algoritmo de detección de plateau detecta estancamiento (más de 2 semanas sin cambio de ±0.5 kg con al menos 4 registros).

**Errores:**
- `409 PROGRESS_ALREADY_EXISTS` — ya existe un registro para esa fecha

---

### GET `/progress/stats`

Devuelve estadísticas agregadas del progreso: peso inicial, peso actual, variación total, racha de registros consecutivos.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "last_weight": 75.5,
    "first_weight": 82.0,
    "total_change": -6.5,
    "total_change_direction": "down",
    "streak": 7,
    "total_logs": 23,
    "last_log_date": "2026-06-07T00:00:00.000Z"
  },
  "message": "Estadísticas de progreso"
}
```

`total_change_direction`: `down`, `up` o `stable`

---

## Logs diarios (`/logs`)

Todos los endpoints requieren autenticación. Un log diario registra agua, sueño, energía, pasos y ánimo del día.

---

### GET `/logs/today`

Devuelve el log del día actual. Si no existe, lo crea vacío.

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "log": {
      "id": "uuid",
      "log_date": "2026-06-07T00:00:00.000Z",
      "water_ml": 1500,
      "sleep_hours": "7.5",
      "sleep_quality": 4,
      "energy_level": 3,
      "mood": 4,
      "steps": 8200
    }
  },
  "message": "Log del día"
}
```

---

### PUT `/logs/today`

Actualiza el log del día actual. Todos los campos son opcionales; solo se actualizan los campos enviados.

**Body:**
```json
{
  "water_ml": 2000,
  "sleep_hours": 7.5,
  "sleep_quality": 4,
  "energy_level": 3,
  "mood": 4,
  "steps": 8200
}
```

Escalas:
- `sleep_quality`, `energy_level`, `mood`: enteros de 1 a 5

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "log": { ... } },
  "message": "Log del día actualizado"
}
```

---

### GET `/logs/history`

Devuelve el historial de logs de los últimos N días, incluyendo promedios de cada métrica para el período.

**Query params:**
- `days` — número de días a consultar (por defecto: 30, máximo: 365)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "logs": [ ... ],
    "total": 25,
    "days_requested": 30,
    "averages": {
      "avg_water_ml": 1750,
      "avg_sleep_hours": 7.2,
      "avg_energy_level": 3.4,
      "avg_mood": 3.8,
      "avg_steps": 7500
    }
  },
  "message": "Historial de los últimos 30 días"
}
```

`averages` es `null` si no hay logs con datos en el período.

---

## Códigos de error comunes

| Código HTTP | Error code | Descripción |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Datos de entrada inválidos |
| 401 | `UNAUTHORIZED` | Token de acceso ausente o inválido |
| 401 | `INVALID_TOKEN` | Refresh token inválido o expirado |
| 403 | `FORBIDDEN` | Sin permisos para acceder al recurso |
| 404 | `NOT_FOUND` | Recurso no encontrado |
| 409 | `CONFLICT` | Conflicto con el estado actual (ej: recurso ya existe) |
| 429 | `RATE_LIMIT_EXCEEDED` | Demasiadas peticiones |
| 500 | `INTERNAL_ERROR` | Error interno del servidor |

---

> Última actualización: 2026-06-29 — Docs Agent (actualizado dominios Railway; eliminada referencia a API Gateway)
