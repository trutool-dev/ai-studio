/**
 * Tipos TypeScript para los planes generados por IA.
 * Usados por planGenerator.ts y fallbackPlan.ts.
 * El Backend Agent usa estos tipos en los endpoints /plans y /onboarding/complete.
 */

// ─────────────────────────────────────────────────────────────
// TIPOS DE ONBOARDING (input del generador)
// ─────────────────────────────────────────────────────────────

export type BodyType = 'ectomorph' | 'mesomorph' | 'endomorph';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type UserGoal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'general_health';
export type Gender = 'male' | 'female';
export type ScheduleType = 'morning' | 'afternoon' | 'night';
export type SleepQuality = 'good' | 'regular' | 'bad';
export type AlcoholLevel = 'never' | 'occasional' | 'frequent';
export type HomeEquipment = 'none' | 'dumbbells' | 'bands' | 'machines' | 'full';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'gluten_free' | 'lactose_free';
export type RestrictionType = 'allergy' | 'intolerance' | 'dislike';
export type ConditionType = 'injury' | 'disease' | 'medication';
export type MotivationType = 'health' | 'aesthetics' | 'performance' | 'mental_wellbeing';
export type TrackingPreference = 'detailed' | 'basic' | 'results_only';

/** Datos del perfil físico del usuario (onboarding paso 2) */
export interface PhysicalProfile {
  age: number;
  weight_kg: number;
  height_cm: number;
  gender: Gender;
  body_type?: BodyType;
  activity_level: ActivityLevel;
  goal: UserGoal;
}

/** Datos del estilo de vida del usuario (onboarding paso 3) */
export interface LifestyleData {
  profession?: string;
  work_hours_per_day?: number;
  stress_level?: number;        // 1-5
  usual_schedule?: ScheduleType;
  sleep_hours_usual?: number;
  sleep_quality?: SleepQuality;
  alcohol_consumption?: AlcoholLevel;
  smoker?: boolean;
}

/** Preferencias de entrenamiento del usuario (onboarding paso 4) */
export interface TrainingPreferencesData {
  available_days_per_week: number;
  max_session_duration_minutes?: number;
  has_gym_access: boolean;
  home_equipment?: HomeEquipment;
  experience_level: ExperienceLevel;
  injuries_or_limitations?: string;
}

/** Preferencias nutricionales del usuario (onboarding paso 5) */
export interface NutritionPreferencesData {
  diet_type?: DietType;
  meals_per_day_preferred?: number;
  food_restrictions?: FoodRestrictionItem[];
}

export interface FoodRestrictionItem {
  restriction_type: RestrictionType;
  food_name: string;
}

/** Condiciones de salud del usuario (onboarding paso 6) */
export interface HealthData {
  conditions?: HealthConditionItem[];
}

export interface HealthConditionItem {
  condition_name: string;
  condition_type: ConditionType;
  affects_training: boolean;
  affects_nutrition: boolean;
  notes?: string;
}

/** Perfil de motivación del usuario (onboarding paso 7) */
export interface MotivationData {
  main_motivation?: MotivationType;
  previous_attempts?: boolean;
  previous_attempts_notes?: string;
  tracking_preference?: TrackingPreference;
}

/**
 * Objeto completo de onboarding que se pasa al generador de planes.
 * Agrupa todos los datos recopilados en los 7 pasos del onboarding.
 */
export interface OnboardingData {
  physical: PhysicalProfile;
  lifestyle?: LifestyleData;
  training: TrainingPreferencesData;
  nutrition?: NutritionPreferencesData;
  health?: HealthData;
  motivation?: MotivationData;
}

// ─────────────────────────────────────────────────────────────
// MÉTRICAS CALCULADAS (TMB / TDEE)
// ─────────────────────────────────────────────────────────────

/** Resultado del cálculo de TMB y TDEE usando Mifflin-St Jeor */
export interface MetabolismMetrics {
  /** Tasa Metabólica Basal en kcal/día */
  bmr: number;
  /** Total Daily Energy Expenditure en kcal/día */
  tdee: number;
  /** Calorías objetivo según el goal del usuario */
  target_calories: number;
}

// ─────────────────────────────────────────────────────────────
// PLAN GENERADO (output del generador)
// ─────────────────────────────────────────────────────────────

/** Sesión de entrenamiento de un día concreto de la semana */
export interface WeeklySession {
  /** Día de la semana (1=lunes … 7=domingo) */
  day_of_week: number;
  day_name: string;
  session_type: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'rest';
  duration_minutes: number;
  muscle_groups: string[];
  exercises: ExerciseDetail[];
  notes?: string;
}

/** Detalle de un ejercicio concreto dentro de una sesión */
export interface ExerciseDetail {
  name: string;
  sets: number;
  reps: string;         // puede ser "12" o "12-15" o "30 segundos"
  rest_seconds: number;
  equipment_needed?: string;
  instructions?: string;
}

/** Sugerencia de comida para un tipo de ingesta del día */
export interface MealSuggestion {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  approximate_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
  prep_time_minutes?: number;
}

/**
 * Plan completo generado por IA o por reglas de fallback.
 * Este es el contrato principal entre el AI Agent y el Backend Agent.
 */
export interface GeneratedPlan {
  training_plan: {
    weeks: number;
    sessions_per_week: number;
    weekly_schedule: WeeklySession[];
  };
  nutrition_plan: {
    daily_calories: number;
    macros: {
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
    meals_per_day: number;
    meal_suggestions: MealSuggestion[];
  };
  /** Notas generales y recomendaciones del plan */
  notes: string;
  /** ISO 8601 — fecha y hora de generación */
  generated_at: string;
  /** Identificador del modelo Claude usado */
  model_version: string;
  /** true si fue generado por Claude, false si es plan de fallback */
  generated_by_ai: boolean;
  /** Métricas metabólicas calculadas que fundamentan el plan */
  metabolism_metrics: MetabolismMetrics;
}

// ─────────────────────────────────────────────────────────────
// TIPOS PARA REGENERACIÓN POR ESTANCAMIENTO
// ─────────────────────────────────────────────────────────────

/** Registro de progreso del usuario (peso y medidas) */
export interface ProgressLog {
  log_date: string;     // YYYY-MM-DD
  weight_kg: number | null;
}

/** Razones válidas para regenerar un plan */
export type RegenerationReason =
  | 'weight_plateau'
  | 'goal_change'
  | 'injury'
  | 'manual_request';

// ─────────────────────────────────────────────────────────────
// CÁLCULO TMB / TDEE (Mifflin-St Jeor)
// ─────────────────────────────────────────────────────────────

/** Factores de actividad para el cálculo TDEE */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

/**
 * Calcula TMB y TDEE usando la fórmula Mifflin-St Jeor.
 * También calcula las calorías objetivo según el goal del usuario.
 *
 * Exportada aquí para evitar dependencias circulares entre
 * planGenerator.ts y fallbackPlan.ts.
 *
 * @param profile - Datos del perfil físico del usuario
 * @returns MetabolismMetrics con bmr, tdee y target_calories
 */
export function calculateMetabolism(profile: PhysicalProfile): MetabolismMetrics {
  const { age, weight_kg, height_cm, gender, activity_level, goal } = profile;

  // Fórmula Mifflin-St Jeor
  const bmr =
    gender === 'male'
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;

  const factor = ACTIVITY_FACTORS[activity_level] ?? 1.55;
  const tdee = Math.round(bmr * factor);

  let target_calories: number;
  switch (goal) {
    case 'lose_weight':
      target_calories = Math.max(1200, Math.round(tdee * 0.80));
      break;
    case 'gain_muscle':
      target_calories = Math.round(tdee * 1.10);
      break;
    case 'maintain':
    case 'general_health':
    default:
      target_calories = tdee;
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    target_calories,
  };
}

// ─────────────────────────────────────────────────────────────
// JSON SCHEMA (para validar la respuesta de Claude)
// ─────────────────────────────────────────────────────────────

/**
 * JSON Schema para validar que Claude devuelve el formato correcto.
 * Pasar a Claude en el prompt para guiar el formato de respuesta.
 */
export const GENERATED_PLAN_SCHEMA = {
  type: 'object',
  required: ['training_plan', 'nutrition_plan', 'notes', 'generated_at', 'model_version'],
  properties: {
    training_plan: {
      type: 'object',
      required: ['weeks', 'sessions_per_week', 'weekly_schedule'],
      properties: {
        weeks: { type: 'number' },
        sessions_per_week: { type: 'number' },
        weekly_schedule: {
          type: 'array',
          items: {
            type: 'object',
            required: ['day_of_week', 'day_name', 'session_type', 'duration_minutes', 'exercises'],
            properties: {
              day_of_week: { type: 'number', minimum: 1, maximum: 7 },
              day_name: { type: 'string' },
              session_type: { type: 'string', enum: ['strength', 'cardio', 'hiit', 'flexibility', 'rest'] },
              duration_minutes: { type: 'number' },
              muscle_groups: { type: 'array', items: { type: 'string' } },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'sets', 'reps', 'rest_seconds'],
                  properties: {
                    name: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest_seconds: { type: 'number' },
                    equipment_needed: { type: 'string' },
                    instructions: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    nutrition_plan: {
      type: 'object',
      required: ['daily_calories', 'macros', 'meals_per_day', 'meal_suggestions'],
      properties: {
        daily_calories: { type: 'number' },
        macros: {
          type: 'object',
          required: ['protein_g', 'carbs_g', 'fat_g'],
          properties: {
            protein_g: { type: 'number' },
            carbs_g: { type: 'number' },
            fat_g: { type: 'number' },
          },
        },
        meals_per_day: { type: 'number' },
        meal_suggestions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['meal_type', 'name', 'description', 'approximate_calories', 'protein_g', 'carbs_g', 'fat_g', 'ingredients'],
          },
        },
      },
    },
    notes: { type: 'string' },
    generated_at: { type: 'string' },
    model_version: { type: 'string' },
  },
} as const;
