# ERD — Entity Relationship Diagram
## Healthy App — Base de datos PostgreSQL

---

## Diagrama Mermaid

```mermaid
erDiagram
    User {
        uuid id PK
        string email UK
        string phone_number
        string password_hash
        boolean email_verified
        boolean phone_verified
        enum status
        datetime health_consent_given_at
        string health_consent_version
        datetime created_at
        datetime updated_at
    }

    Profile {
        uuid id PK
        uuid user_id FK UK
        string name
        datetime birthdate
        string gender
        decimal weight_kg
        decimal height_cm
        enum body_type
        enum activity_level
        enum goal
        int daily_calories_target
        int daily_protein_target
        int daily_carbs_target
        int daily_fat_target
        datetime created_at
        datetime updated_at
    }

    LifestyleProfile {
        uuid id PK
        uuid user_id FK UK
        string profession
        enum work_type
        int work_hours_per_day
        int stress_level
        enum usual_schedule
        decimal sleep_hours_usual
        enum sleep_quality
        enum alcohol_consumption
        boolean smoker
        int daily_water_glasses
        datetime created_at
        datetime updated_at
    }

    TrainingPreferences {
        uuid id PK
        uuid user_id FK UK
        int available_days_per_week
        int max_session_duration_minutes
        enum preferred_training_time
        boolean has_gym_access
        enum home_equipment
        enum experience_level
        string injuries_or_limitations
        datetime created_at
        datetime updated_at
    }

    HealthCondition {
        uuid id PK
        uuid user_id FK
        string condition_name
        enum condition_type
        boolean affects_training
        boolean affects_nutrition
        string notes
        datetime created_at
    }

    NutritionPreferences {
        uuid id PK
        uuid user_id FK UK
        enum diet_type
        int meals_per_day_preferred
        boolean cooks_at_home
        enum eats_out_frequency
        enum monthly_food_budget_range
        datetime created_at
        datetime updated_at
    }

    FoodRestriction {
        uuid id PK
        uuid user_id FK
        enum restriction_type
        string food_name
        enum severity
        datetime created_at
    }

    MotivationProfile {
        uuid id PK
        uuid user_id FK UK
        enum main_motivation
        boolean previous_attempts
        string previous_attempts_notes
        enum tracking_preference
        boolean has_support_network
        datetime created_at
        datetime updated_at
    }

    OnboardingAnswer {
        uuid id PK
        uuid user_id FK
        string question_key
        string answer_value
        enum question_category
        datetime created_at
    }

    VerificationCode {
        uuid id PK
        uuid user_id FK
        string email
        string code
        enum type
        datetime expires_at
        datetime used_at
        int attempts
        datetime created_at
    }

    PasswordResetToken {
        uuid id PK
        uuid user_id FK
        string token UK
        datetime expires_at
        datetime used_at
        string ip_address
        datetime created_at
    }

    AuthSession {
        uuid id PK
        uuid user_id FK
        string refresh_token UK
        string device_info
        string ip_address
        datetime expires_at
        datetime last_used_at
        datetime created_at
    }

    Plan {
        uuid id PK
        uuid user_id FK
        enum type
        datetime start_date
        datetime end_date
        enum status
        boolean generated_by_ai
        string ai_prompt_used
        string ai_model_version
        datetime created_at
        datetime updated_at
    }

    TrainingSession {
        uuid id PK
        uuid plan_id FK
        uuid user_id FK
        datetime scheduled_date
        datetime completed_at
        int duration_minutes
        int calories_burned
        string notes
        enum status
    }

    Exercise {
        uuid id PK
        string name
        string muscle_group
        string equipment_needed
        enum difficulty
        string instructions
        string video_url
    }

    SessionExercise {
        uuid id PK
        uuid session_id FK
        uuid exercise_id FK
        int sets
        int reps
        decimal weight_kg
        int rest_seconds
        int order_index
        boolean completed
    }

    Meal {
        uuid id PK
        uuid plan_id FK
        uuid user_id FK
        enum meal_type
        datetime scheduled_date
        int calories
        decimal protein_g
        decimal carbs_g
        decimal fat_g
        enum status
    }

    Food {
        uuid id PK
        string name
        string brand
        decimal calories_per_100g
        decimal protein_per_100g
        decimal carbs_per_100g
        decimal fat_per_100g
        string barcode UK
        boolean verified
    }

    MealFood {
        uuid id PK
        uuid meal_id FK
        uuid food_id FK
        decimal quantity_g
    }

    ProgressLog {
        uuid id PK
        uuid user_id FK
        datetime log_date
        decimal weight_kg
        decimal body_fat_percentage
        decimal muscle_mass_kg
        decimal waist_cm
        decimal hip_cm
        decimal chest_cm
        string notes
        string photo_url
    }

    DailyLog {
        uuid id PK
        uuid user_id FK
        datetime log_date
        int water_ml
        decimal sleep_hours
        int sleep_quality
        int energy_level
        int mood
        int steps
    }

    TokenUsageLog {
        uuid id PK
        uuid user_id FK
        string request_type
        int input_tokens
        int output_tokens
        int cache_read_tokens
        int cache_write_tokens
        string model_version
        decimal cost_usd
        datetime created_at
    }

    %% Relaciones
    User ||--o{ VerificationCode : "tiene"
    User ||--o{ PasswordResetToken : "tiene"
    User ||--o{ AuthSession : "tiene"
    User ||--o| Profile : "tiene"
    User ||--o| LifestyleProfile : "tiene"
    User ||--o| TrainingPreferences : "tiene"
    User ||--o{ HealthCondition : "tiene"
    User ||--o| NutritionPreferences : "tiene"
    User ||--o{ FoodRestriction : "tiene"
    User ||--o| MotivationProfile : "tiene"
    User ||--o{ OnboardingAnswer : "tiene"
    User ||--o{ Plan : "tiene"
    User ||--o{ TrainingSession : "realiza"
    User ||--o{ Meal : "registra"
    User ||--o{ ProgressLog : "registra"
    User ||--o{ DailyLog : "registra"
    User ||--o{ TokenUsageLog : "genera"

    Plan ||--o{ TrainingSession : "contiene"
    Plan ||--o{ Meal : "contiene"

    TrainingSession ||--o{ SessionExercise : "tiene"
    Exercise ||--o{ SessionExercise : "aparece_en"

    Meal ||--o{ MealFood : "tiene"
    Food ||--o{ MealFood : "aparece_en"
```

---

## Tabla de Entidades

| Entidad | Propósito | Campos clave | Índices |
|---------|-----------|--------------|---------|
| **User** | Cuenta del usuario. Núcleo del sistema | `email` (UK), `status`, `email_verified` | `email` (único) |
| **Profile** | Datos físicos y objetivos de salud | `user_id` (UK), `weight_kg`, `height_cm`, `goal`, `activity_level` | `user_id` (único) |
| **LifestyleProfile** | Estilo de vida: trabajo, sueño, hábitos | `user_id` (UK), `stress_level`, `sleep_quality` | `user_id` (único) |
| **TrainingPreferences** | Disponibilidad y experiencia de entrenamiento | `user_id` (UK), `experience_level`, `has_gym_access` | `user_id` (único) |
| **HealthCondition** | Condiciones médicas, lesiones, medicación | `user_id`, `condition_type`, `affects_training` | `user_id` |
| **NutritionPreferences** | Dieta, presupuesto, frecuencia de comidas | `user_id` (UK), `diet_type`, `meals_per_day_preferred` | `user_id` (único) |
| **FoodRestriction** | Alergias, intolerancias, preferencias | `user_id`, `restriction_type`, `severity` | `user_id` |
| **MotivationProfile** | Motivación, historial de intentos, seguimiento | `user_id` (UK), `main_motivation`, `tracking_preference` | `user_id` (único) |
| **OnboardingAnswer** | Respuestas literales del cuestionario de onboarding | `user_id`, `question_key`, `question_category` | `user_id`, `question_category` |
| **VerificationCode** | Códigos OTP (6 dígitos) para email y reset de contraseña | `user_id`, `code`, `type`, `expires_at` | `user_id`, `email`, `code` |
| **PasswordResetToken** | Tokens UUID para recuperación de contraseña | `token` (UK), `user_id`, `expires_at` | `user_id`, `token` |
| **AuthSession** | Sesiones activas con refresh token por dispositivo | `refresh_token` (UK), `user_id`, `expires_at` | `user_id`, `refresh_token` |
| **Plan** | Plan de entrenamiento o nutrición (manual o IA) | `user_id`, `type`, `status`, `start_date` | `user_id`, `status` |
| **TrainingSession** | Sesión individual de entrenamiento dentro de un plan | `plan_id`, `user_id`, `scheduled_date`, `status` | `plan_id`, `user_id`, `scheduled_date` |
| **Exercise** | Catálogo global de ejercicios | `name`, `muscle_group`, `difficulty` | `muscle_group`, `difficulty` |
| **SessionExercise** | Ejercicio específico dentro de una sesión | `session_id`, `exercise_id`, `order_index` | `session_id`, `exercise_id` |
| **Meal** | Comida planificada dentro de un plan | `plan_id`, `user_id`, `meal_type`, `scheduled_date` | `plan_id`, `user_id`, `scheduled_date` |
| **Food** | Catálogo global de alimentos con macros | `name`, `barcode` (UK), `calories_per_100g` | `name`, `barcode` |
| **MealFood** | Relación N:M entre Meal y Food con cantidad | `meal_id`, `food_id`, `quantity_g` | `meal_id`, `food_id` |
| **ProgressLog** | Registro de medidas corporales a lo largo del tiempo | `user_id`, `log_date`, `weight_kg` | `user_id`, `log_date` |
| **DailyLog** | Registro diario de agua, sueño, energía, pasos | `user_id`, `log_date` (UK compuesto) | `user_id`, `log_date` |
| **TokenUsageLog** | Log de tokens IA consumidos por petición (coste y caché) | `user_id`, `request_type`, `model_version`, `cost_usd` | `user_id`, `created_at` |

---

## Relaciones con cardinalidad

### Relaciones 1:1 (Usuario → Perfil único)

```
User  ──────── Profile                 (1 usuario tiene exactamente 1 perfil físico)
User  ──────── LifestyleProfile        (1 usuario tiene exactamente 1 perfil de estilo de vida)
User  ──────── TrainingPreferences     (1 usuario tiene exactamente 1 preferencia de entrenamiento)
User  ──────── NutritionPreferences    (1 usuario tiene exactamente 1 preferencia nutricional)
User  ──────── MotivationProfile       (1 usuario tiene exactamente 1 perfil de motivación)
```

### Relaciones 1:N (Usuario → Muchos registros)

```
User  ──────<< VerificationCode        (1 usuario puede tener múltiples códigos OTP)
User  ──────<< PasswordResetToken      (1 usuario puede solicitar múltiples resets)
User  ──────<< AuthSession             (1 usuario puede tener sesiones en múltiples dispositivos)
User  ──────<< HealthCondition         (1 usuario puede tener múltiples condiciones de salud)
User  ──────<< FoodRestriction         (1 usuario puede tener múltiples restricciones alimentarias)
User  ──────<< OnboardingAnswer        (1 usuario tiene múltiples respuestas del onboarding)
User  ──────<< Plan                    (1 usuario puede tener múltiples planes a lo largo del tiempo)
User  ──────<< TrainingSession         (1 usuario realiza múltiples sesiones de entrenamiento)
User  ──────<< Meal                    (1 usuario registra múltiples comidas)
User  ──────<< ProgressLog             (1 usuario tiene múltiples registros de progreso)
User  ──────<< DailyLog               (1 usuario tiene un log por día, múltiples días)
User  ──────<< TokenUsageLog          (1 usuario genera múltiples logs de consumo de IA)

Plan  ──────<< TrainingSession         (1 plan contiene múltiples sesiones de entrenamiento)
Plan  ──────<< Meal                    (1 plan contiene múltiples comidas planificadas)

TrainingSession ──────<< SessionExercise   (1 sesión tiene múltiples ejercicios)
Meal            ──────<< MealFood          (1 comida tiene múltiples alimentos)
```

### Relaciones N:M (a través de tabla intermedia)

```
TrainingSession >──────< Exercise    (a través de SessionExercise)
   Una sesión tiene múltiples ejercicios
   Un ejercicio aparece en múltiples sesiones

Meal  >──────< Food                  (a través de MealFood)
   Una comida tiene múltiples alimentos
   Un alimento puede aparecer en múltiples comidas
```

---

## Enums del sistema

| Enum | Valores |
|------|---------|
| `UserStatus` | `pending_verification`, `active`, `suspended` |
| `VerificationCodeType` | `email_verification`, `password_reset` |
| `BodyType` | `ectomorph`, `mesomorph`, `endomorph` |
| `ActivityLevel` | `sedentary`, `light`, `moderate`, `active`, `very_active` |
| `UserGoal` | `lose_weight`, `gain_muscle`, `maintain`, `general_health` |
| `WorkType` | `office`, `physical`, `standing`, `mixed` |
| `ScheduleType` | `morning`, `afternoon`, `night` |
| `SleepQuality` | `good`, `regular`, `bad` |
| `AlcoholLevel` | `never`, `occasional`, `frequent` |
| `HomeEquipment` | `none`, `dumbbells`, `bands`, `machines`, `full` |
| `ExperienceLevel` | `beginner`, `intermediate`, `advanced` |
| `ConditionType` | `injury`, `disease`, `medication` |
| `DietType` | `omnivore`, `vegetarian`, `vegan`, `gluten_free`, `lactose_free` |
| `EatsOutFrequency` | `never`, `sometimes`, `often`, `always` |
| `BudgetRange` | `low`, `medium`, `high` |
| `RestrictionType` | `allergy`, `intolerance`, `dislike` |
| `Severity` | `mild`, `moderate`, `severe` |
| `MotivationType` | `health`, `aesthetics`, `performance`, `mental_wellbeing` |
| `TrackingPreference` | `detailed`, `basic`, `results_only` |
| `OnboardingCategory` | `lifestyle`, `training`, `nutrition`, `health`, `motivation` |
| `PlanType` | `nutrition`, `training`, `combined` |
| `PlanStatus` | `active`, `completed`, `paused` |
| `SessionStatus` | `scheduled`, `completed`, `skipped` |
| `MealType` | `breakfast`, `lunch`, `dinner`, `snack` |
| `MealStatus` | `scheduled`, `completed`, `skipped` |

---

## Redis: Entidades cacheadas

| Entidad cacheada | Clave Redis | TTL | Justificación |
|-----------------|-------------|-----|---------------|
| Plan IA del usuario | `plan:{userId}:{YYYY-MM-DD}` | 86400s (24h) | Generación costosa, válido durante el día |
| Sesión activa | `session:{sessionId}` | 2592000s (30 días) | Refleja duración máxima del refresh token |
| Perfil del usuario | `user:{userId}:profile` | 3600s (1h) | Lectura muy frecuente, cambios raros |
| Preferencias nutricionales | `user:{userId}:nutrition_prefs` | 21600s (6h) | Datos quasi-estáticos |
| Preferencias de entrenamiento | `user:{userId}:training_prefs` | 21600s (6h) | Datos quasi-estáticos |
| Rate limit login | `rate_limit:login:{email}` | 900s (15 min) | Ventana de protección anti-brute-force |

---

## Decisiones de diseño

### Por qué User es el nodo central

Toda la información de salud, preferencias y actividad está vinculada a
`users.id`. Esto facilita el borrado en cascada (RGPD: derecho al olvido)
y centraliza los controles de acceso.

### Separación de perfiles de onboarding

Los datos de onboarding se dividen en 5 modelos independientes
(`Profile`, `LifestyleProfile`, `TrainingPreferences`, `NutritionPreferences`,
`MotivationProfile`) en lugar de un único modelo gigante. Esto permite:
- Carga progresiva durante el onboarding
- Caché independiente por sección
- Queries más ligeras cuando solo se necesita una sección

### Catálogos globales de Exercise y Food

`Exercise` y `Food` son entidades globales (no por usuario). Los usuarios
los referencian desde `SessionExercise` y `MealFood`. Esto evita duplicación
de datos y permite que el catálogo crezca de forma centralizada.

### Tabla MealFood para relación N:M con cantidad

La relación entre `Meal` y `Food` requiere saber la cantidad en gramos
(`quantity_g`). Una tabla intermedia `MealFood` materializa esta relación
con el atributo adicional, permitiendo calcular los macros exactos de
cada comida.

### Cascade delete en todas las relaciones

Todas las relaciones con `User` tienen `onDelete: Cascade`. Si un usuario
se elimina (derecho al olvido, RGPD), todos sus datos asociados se borran
automáticamente sin necesidad de lógica adicional en la aplicación.

---

*Generado el: 2026-06-07 | Actualizado el: 2026-06-15 (PR-2 — TokenUsageLog + health_consent)*
*Schema fuente: `projects/healthy/database/schema.prisma`*
