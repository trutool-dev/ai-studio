/**
 * Validación de la salida del LLM antes de guardarla o iterar sobre ella
 * (SEC-36 / JB-04, reabre SEC-07/SEC-11; `id` de ejercicio para SEC-54).
 *
 * - Esquema estricto en tipos y rangos (semanas, días, sesiones, kcal, macros,
 *   longitudes de texto, número de elementos). Las claves desconocidas se
 *   descartan (no se propagan a BD ni al cliente).
 * - `generated_at` y `model_version` los pone el servidor, no el modelo.
 * Si no valida, el llamador usa el plan de respaldo.
 */

'use strict';

const { z } = require('zod');

const SESSION_TYPES = ['strength', 'cardio', 'hiit', 'flexibility', 'rest'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const LIMITS = Object.freeze({
  weeks: { min: 1, max: 12 },
  daysInSchedule: 7,
  exercisesPerDay: 12,
  mealSuggestions: 16,
  ingredients: 20,
  dailyCalories: { min: 800, max: 6000 },
  mealCalories: { min: 0, max: 2500 },
  notes: 1000,
  sessionNotes: 500,
  instructions: 300,
  description: 300,
  name: 100,
});

const text = (max) => z.string().max(max);
const optText = (max) => z.string().max(max).optional().nullable();
const num = (min, max) => z.number().finite().min(min).max(max);
const int = (min, max) => num(min, max).transform((n) => Math.round(n));

const exerciseSchema = z.object({
  id: z.union([z.string().max(64), z.number().int().nonnegative()]).optional().nullable()
    .transform((v) => (v === null || v === undefined ? undefined : String(v))),
  name: text(LIMITS.name).min(1),
  sets: int(1, 10),
  reps: z.union([text(30), int(1, 100)]).transform(String),
  rest_seconds: int(0, 600),
  equipment_needed: optText(60),
  instructions: optText(LIMITS.instructions),
});

const daySchema = z.object({
  day_of_week: int(1, 7),
  day_name: optText(20),
  session_type: z.enum(SESSION_TYPES),
  duration_minutes: int(0, 240),
  muscle_groups: z.array(text(40)).max(10).optional().default([]),
  exercises: z.array(exerciseSchema).max(LIMITS.exercisesPerDay).optional().default([]),
  notes: optText(LIMITS.sessionNotes),
});

const mealSchema = z.object({
  meal_type: z.enum(MEAL_TYPES),
  name: text(LIMITS.name).min(1),
  description: optText(LIMITS.description),
  approximate_calories: int(LIMITS.mealCalories.min, LIMITS.mealCalories.max),
  protein_g: num(0, 300),
  carbs_g: num(0, 500),
  fat_g: num(0, 300),
  ingredients: z.array(text(100)).max(LIMITS.ingredients).optional().default([]),
  prep_time_minutes: int(0, 240).optional(),
});

const planSchema = z.object({
  training_plan: z.object({
    weeks: int(LIMITS.weeks.min, LIMITS.weeks.max),
    sessions_per_week: int(0, 7),
    weekly_schedule: z.array(daySchema).min(1).max(LIMITS.daysInSchedule),
  }),
  nutrition_plan: z.object({
    daily_calories: int(LIMITS.dailyCalories.min, LIMITS.dailyCalories.max),
    macros: z.object({
      protein_g: num(0, 500),
      carbs_g: num(0, 1000),
      fat_g: num(0, 400),
    }),
    meals_per_day: int(1, 8),
    meal_suggestions: z.array(mealSchema).min(1).max(LIMITS.mealSuggestions),
  }),
  notes: optText(LIMITS.notes),
}).superRefine((plan, ctx) => {
  const days = plan.training_plan.weekly_schedule.map((d) => d.day_of_week);
  if (new Set(days).size !== days.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['training_plan', 'weekly_schedule'], message: 'day_of_week repetido' });
  }
});

/**
 * Valida la salida del LLM.
 * @param {unknown} raw - objeto ya parseado con JSON.parse
 * @returns {{ success: true, data: object } | { success: false, error: string }}
 */
function validatePlanOutput(raw) {
  const result = planSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  // Solo rutas y códigos (sin valores: podrían contener datos de salud) — JB-19
  const error = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}:${i.code}`).join(', ');
  return { success: false, error };
}

module.exports = { validatePlanOutput, planSchema, LIMITS, SESSION_TYPES, MEAL_TYPES };
