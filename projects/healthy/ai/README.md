# AI Agent — Módulo de Generación de Planes con Claude

## Visión general

Este módulo genera planes personalizados de entrenamiento y nutrición llamando
a la API de Anthropic (modelo `claude-sonnet-4-6`). Se integra con Redis para
cachear los planes durante 24 horas y registra el uso de tokens con estimación
de coste.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Interfaces TypeScript de entrada (onboarding) y salida (GeneratedPlan) |
| `planGenerator.ts` | Generación, cálculo TMB/TDEE, detección de estancamiento, prompt caching |
| `fallbackPlan.ts` | Plan de fallback por reglas si Claude no está disponible |
| `tokenLogger.ts` | Log y estimación de coste de tokens de Anthropic |

---

## Variables de entorno requeridas

```
CLAUDE_API_KEY=sk-ant-...       # API key de Anthropic
REDIS_URL=redis://localhost:6379 # URL del servidor Redis
```

---

## Integración con el Backend

### 1. Endpoint POST /onboarding/complete

Cuando el usuario termina el onboarding, llamar a `generatePlan`:

```typescript
import { generatePlan } from '../ai/planGenerator';
import type { OnboardingData, GeneratedPlan } from '../ai/types';

// Construir el objeto OnboardingData con los datos guardados en la DB
const onboardingData: OnboardingData = {
  physical: {
    age: profile.age,           // calculado desde profile.birthdate
    weight_kg: Number(profile.weight_kg),
    height_cm: Number(profile.height_cm),
    gender: profile.gender,     // 'male' | 'female'
    body_type: profile.body_type,
    activity_level: profile.activity_level,
    goal: profile.goal,
  },
  lifestyle: {
    profession: lifestyle.profession,
    work_hours_per_day: lifestyle.work_hours_per_day,
    stress_level: lifestyle.stress_level,
    usual_schedule: lifestyle.usual_schedule,
    sleep_hours_usual: Number(lifestyle.sleep_hours_usual),
    sleep_quality: lifestyle.sleep_quality,
    alcohol_consumption: lifestyle.alcohol_consumption,
    smoker: lifestyle.smoker,
  },
  training: {
    available_days_per_week: trainingPrefs.available_days_per_week,
    max_session_duration_minutes: trainingPrefs.max_session_duration_minutes,
    has_gym_access: trainingPrefs.has_gym_access,
    home_equipment: trainingPrefs.home_equipment,
    experience_level: trainingPrefs.experience_level,
    injuries_or_limitations: trainingPrefs.injuries_or_limitations,
  },
  nutrition: {
    diet_type: nutritionPrefs.diet_type,
    meals_per_day_preferred: nutritionPrefs.meals_per_day_preferred,
    food_restrictions: foodRestrictions.map(r => ({
      restriction_type: r.restriction_type,
      food_name: r.food_name,
    })),
  },
  health: {
    conditions: healthConditions.map(c => ({
      condition_name: c.condition_name,
      condition_type: c.condition_type,
      affects_training: c.affects_training,
      affects_nutrition: c.affects_nutrition,
      notes: c.notes,
    })),
  },
  motivation: {
    main_motivation: motivationProfile.main_motivation,
    previous_attempts: motivationProfile.previous_attempts,
    previous_attempts_notes: motivationProfile.previous_attempts_notes,
    tracking_preference: motivationProfile.tracking_preference,
  },
};

const plan = await generatePlan(userId, onboardingData);

// Guardar en la tabla plans de la DB
await prisma.plan.create({
  data: {
    user_id: userId,
    type: 'combined',
    start_date: new Date(),
    generated_by_ai: plan.generated_by_ai,
    ai_model_version: plan.model_version,
    // Guardar el JSON completo del plan (añadir campo plan_data en el schema si es necesario)
    // O distribuir en training_sessions y meals
  },
});
```

### 2. Endpoint POST /plans/regenerate

Para regeneración manual o por estancamiento:

```typescript
import { regeneratePlan, shouldRegeneratePlan } from '../ai/planGenerator';
import type { RegenerationReason } from '../ai/types';

// Regeneración manual solicitada por el usuario
const reason: RegenerationReason = 'manual_request';

// O detectar automáticamente si hay estancamiento
const progressLogs = await prisma.progressLog.findMany({
  where: { user_id: userId },
  orderBy: { log_date: 'desc' },
  take: 20,
});

const isPlateauing = shouldRegeneratePlan(progressLogs.map(l => ({
  log_date: l.log_date.toISOString().split('T')[0],
  weight_kg: l.weight_kg ? Number(l.weight_kg) : null,
})));

const reason: RegenerationReason = isPlateauing ? 'weight_plateau' : 'manual_request';

const newPlan = await regeneratePlan(userId, onboardingData, reason, progressLogs);
```

### 3. Tarea cron — detección automática de estancamiento

Ejecutar diariamente para detectar usuarios estancados:

```typescript
import { shouldRegeneratePlan, regeneratePlan } from '../ai/planGenerator';

// Para cada usuario activo con plan activo:
const progressLogs = await prisma.progressLog.findMany({
  where: {
    user_id: userId,
    log_date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
  },
  orderBy: { log_date: 'desc' },
});

if (shouldRegeneratePlan(progressLogs)) {
  await regeneratePlan(userId, onboardingData, 'weight_plateau', progressLogs);
}
```

---

## Estructura del plan devuelto (GeneratedPlan)

```typescript
{
  training_plan: {
    weeks: 4,
    sessions_per_week: 4,
    weekly_schedule: [
      {
        day_of_week: 1,          // 1=lunes ... 7=domingo
        day_name: "Lunes",
        session_type: "strength", // strength|cardio|hiit|flexibility|rest
        duration_minutes: 45,
        muscle_groups: ["pecho", "tríceps"],
        exercises: [
          {
            name: "Press de banca",
            sets: 4,
            reps: "10-12",       // siempre string
            rest_seconds: 90,
            equipment_needed: "barra + banco",
            instructions: "Bajar la barra hasta el pecho..."
          }
        ],
        notes: "Calentar 5 min antes."
      }
      // ... 6 días más
    ]
  },
  nutrition_plan: {
    daily_calories: 1900,
    macros: { protein_g: 142, carbs_g: 190, fat_g: 63 },
    meals_per_day: 4,
    meal_suggestions: [
      {
        meal_type: "breakfast",
        name: "Avena con proteína",
        description: "...",
        approximate_calories: 450,
        protein_g: 35,
        carbs_g: 50,
        fat_g: 8,
        ingredients: ["80g avena", "1 scoop proteína"],
        prep_time_minutes: 10
      }
      // ... resto de comidas
    ]
  },
  notes: "Recomendaciones generales...",
  generated_at: "2026-06-07T10:30:00.000Z",
  model_version: "claude-sonnet-4-6",
  generated_by_ai: true,       // false si fue generado por fallback
  metabolism_metrics: {
    bmr: 1654,
    tdee: 2564,
    target_calories: 1900
  }
}
```

---

## Caché Redis

- Clave: `plan:{userId}:{YYYY-MM-DD}`
- TTL: 86400 segundos (24 horas)
- Las regeneraciones siempre llaman a Claude (no usan caché).
- El fallback también se cachea con el mismo TTL.

---

## Prompt Caching (reducción de costes ~80%)

El system prompt base (~500 tokens) se cachea con `cache_control: { type: "ephemeral" }`.
Esto reduce el coste por llamada en ~80% en redes de producción donde el mismo
system prompt se usa repetidamente.

Revisar los logs de `[TokenLogger]` para monitorizar el ratio de cache hits:
```
[TokenLogger] | user=abc-123 | type=plan_generation | cacheRead=510tok | cost=$0.002430 | cacheSaved=$0.001530
```

---

## Fallback automático

Si Claude devuelve error (red, timeout, rate limit, respuesta inválida), el módulo
activa automáticamente `generateFallbackPlan` del archivo `fallbackPlan.ts`.

El plan de fallback:
- Usa el TDEE calculado para las calorías (misma fórmula Mifflin-St Jeor)
- Aplica plantillas de entrenamiento genéricas según objetivo y nivel
- Adapta las sugerencias de comida al tipo de dieta (omnívoro/vegetariano/vegano)
- Marca `generated_by_ai: false` para que el frontend pueda mostrarlo de forma diferente

---

## Decisiones de diseño

1. **`generatePlan` es el único punto de entrada** para generaciones nuevas.
   Maneja internamente el caché Redis, el cálculo de métricas, la llamada a Claude
   y el fallback. El Backend Agent no necesita importar `fallbackPlan` directamente.

2. **`calculateMetabolism` es exportada** porque el Backend Agent puede necesitarla
   para calcular las calorías objetivo en el perfil del usuario (`Profile.daily_calories_target`).

3. **El prompt caching usa el bloque `user` con dos partes de texto** según la documentación
   de Anthropic. El system prompt se pone en el primer bloque de texto con `cache_control`,
   y el contexto del usuario va en el segundo bloque sin cachear.

4. **`shouldRegeneratePlan` es síncrona** — solo analiza los datos recibidos, no hace
   llamadas a la DB. El Backend Agent es responsable de pasar los `ProgressLog[]`.

5. **`tokenLogger` solo hace `console.log`** en esta versión. El Backend Agent debe
   conectar esto a una tabla `token_usage_logs` en la DB en la siguiente fase.
   La interfaz `TokenUsageLog` y la función `buildTokenUsageLog` ya están definidas
   para facilitar esa integración.
