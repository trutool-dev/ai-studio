/**
 * Plan de fallback generado por reglas cuando la API de Claude no está disponible.
 * Se activa automáticamente si hay error de red, timeout o rate limit.
 *
 * El plan generado aquí es genérico pero coherente con los datos del usuario.
 * El campo generated_by_ai = false indica al frontend que no es un plan IA.
 */

import type { OnboardingData, GeneratedPlan, WeeklySession, MealSuggestion, MetabolismMetrics } from './types';
import { calculateMetabolism } from './types';

// ─────────────────────────────────────────────────────────────
// PLANTILLAS DE ENTRENAMIENTO POR OBJETIVO Y NIVEL
// ─────────────────────────────────────────────────────────────

/** Tipos de sesión según el objetivo del usuario */
const SESSION_TYPES_BY_GOAL: Record<string, Array<WeeklySession['session_type']>> = {
  lose_weight:    ['cardio', 'hiit', 'strength', 'cardio', 'hiit', 'flexibility', 'rest'],
  gain_muscle:    ['strength', 'strength', 'rest', 'strength', 'strength', 'cardio', 'rest'],
  maintain:       ['strength', 'cardio', 'flexibility', 'strength', 'cardio', 'rest', 'rest'],
  general_health: ['cardio', 'strength', 'flexibility', 'cardio', 'strength', 'flexibility', 'rest'],
};

/** Duración de sesión en minutos según nivel de experiencia */
const DURATION_BY_LEVEL: Record<string, number> = {
  beginner:     30,
  intermediate: 45,
  advanced:     60,
};

/** Grupos musculares para cada tipo de sesión de fuerza */
const MUSCLE_GROUPS_BY_DAY_INDEX: Record<number, string[]> = {
  0: ['pecho', 'tríceps'],
  1: ['espalda', 'bíceps'],
  2: ['piernas', 'glúteos'],
  3: ['hombros', 'trapecio'],
  4: ['core', 'abdomen'],
};

// ─────────────────────────────────────────────────────────────
// PLANTILLAS DE EJERCICIOS BÁSICOS
// ─────────────────────────────────────────────────────────────

const BASIC_EXERCISES: Record<string, Array<{ name: string; sets: number; reps: string; rest_seconds: number; equipment_needed?: string }>> = {
  strength_no_gym: [
    { name: 'Flexiones', sets: 3, reps: '10-15', rest_seconds: 60 },
    { name: 'Sentadillas', sets: 3, reps: '15-20', rest_seconds: 60 },
    { name: 'Zancadas', sets: 3, reps: '10 por pierna', rest_seconds: 60 },
    { name: 'Fondos de tríceps (silla)', sets: 3, reps: '10-12', rest_seconds: 60 },
    { name: 'Plancha', sets: 3, reps: '30 segundos', rest_seconds: 45 },
  ],
  strength_gym: [
    { name: 'Press de banca', sets: 4, reps: '10-12', rest_seconds: 90, equipment_needed: 'barra + banco' },
    { name: 'Sentadilla con barra', sets: 4, reps: '8-12', rest_seconds: 90, equipment_needed: 'barra + rack' },
    { name: 'Peso muerto', sets: 3, reps: '8-10', rest_seconds: 120, equipment_needed: 'barra' },
    { name: 'Remo con barra', sets: 3, reps: '10-12', rest_seconds: 90, equipment_needed: 'barra' },
    { name: 'Press militar', sets: 3, reps: '10-12', rest_seconds: 90, equipment_needed: 'barra o mancuernas' },
  ],
  cardio: [
    { name: 'Carrera continua o bicicleta estática', sets: 1, reps: '30 minutos', rest_seconds: 0 },
    { name: 'Saltos a la comba', sets: 3, reps: '3 minutos', rest_seconds: 60 },
    { name: 'Jumping jacks', sets: 3, reps: '2 minutos', rest_seconds: 30 },
  ],
  hiit: [
    { name: 'Burpees', sets: 4, reps: '45 segundos trabajo / 15 descanso', rest_seconds: 15 },
    { name: 'Mountain climbers', sets: 4, reps: '45 segundos trabajo / 15 descanso', rest_seconds: 15 },
    { name: 'Sentadillas con salto', sets: 4, reps: '45 segundos trabajo / 15 descanso', rest_seconds: 15 },
    { name: 'High knees', sets: 4, reps: '45 segundos trabajo / 15 descanso', rest_seconds: 15 },
  ],
  flexibility: [
    { name: 'Estiramiento de cuádriceps', sets: 2, reps: '30 segundos por pierna', rest_seconds: 15 },
    { name: 'Estiramiento de isquiotibiales', sets: 2, reps: '30 segundos por pierna', rest_seconds: 15 },
    { name: 'Estiramiento de pecho', sets: 2, reps: '30 segundos', rest_seconds: 15 },
    { name: 'Yoga: postura del gato-vaca', sets: 2, reps: '10 repeticiones', rest_seconds: 15 },
    { name: 'Foam roller – espalda baja', sets: 1, reps: '2 minutos', rest_seconds: 0 },
  ],
};

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ─────────────────────────────────────────────────────────────
// PLANTILLAS DE COMIDAS POR TIPO DE DIETA
// ─────────────────────────────────────────────────────────────

const MEAL_TEMPLATES: Record<string, MealSuggestion[]> = {
  omnivore: [
    {
      meal_type: 'breakfast',
      name: 'Avena con proteína y fruta',
      description: 'Tazón de avena cocida con proteína en polvo, plátano y frutos rojos.',
      approximate_calories: 400,
      protein_g: 30,
      carbs_g: 55,
      fat_g: 8,
      ingredients: ['80g avena', '1 scoop proteína de suero', '1 plátano', 'frutos rojos al gusto'],
      prep_time_minutes: 10,
    },
    {
      meal_type: 'lunch',
      name: 'Pollo a la plancha con arroz y verduras',
      description: 'Pechuga de pollo a la plancha con arroz integral y ensalada verde.',
      approximate_calories: 550,
      protein_g: 45,
      carbs_g: 55,
      fat_g: 10,
      ingredients: ['200g pechuga de pollo', '150g arroz integral cocido', 'ensalada mixta', 'aceite de oliva'],
      prep_time_minutes: 20,
    },
    {
      meal_type: 'dinner',
      name: 'Salmón al horno con patata dulce',
      description: 'Filete de salmón al horno con boniato asado y brócoli al vapor.',
      approximate_calories: 500,
      protein_g: 38,
      carbs_g: 40,
      fat_g: 18,
      ingredients: ['200g salmón', '200g boniato', '150g brócoli', 'limón y hierbas'],
      prep_time_minutes: 30,
    },
    {
      meal_type: 'snack',
      name: 'Yogur griego con nueces',
      description: 'Yogur griego natural con un puñado de nueces y miel.',
      approximate_calories: 250,
      protein_g: 15,
      carbs_g: 20,
      fat_g: 12,
      ingredients: ['200g yogur griego', '30g nueces', '1 cucharadita de miel'],
      prep_time_minutes: 2,
    },
  ],
  vegetarian: [
    {
      meal_type: 'breakfast',
      name: 'Tostadas de aguacate con huevo',
      description: 'Pan de centeno tostado con aguacate machacado y huevo pochado.',
      approximate_calories: 420,
      protein_g: 18,
      carbs_g: 40,
      fat_g: 20,
      ingredients: ['2 rebanadas pan de centeno', '1 aguacate', '2 huevos', 'tomate cherry'],
      prep_time_minutes: 10,
    },
    {
      meal_type: 'lunch',
      name: 'Bowl de quinoa con garbanzos',
      description: 'Quinoa con garbanzos, espinacas, tomate y aliño de limón.',
      approximate_calories: 520,
      protein_g: 25,
      carbs_g: 70,
      fat_g: 10,
      ingredients: ['150g quinoa cocida', '120g garbanzos cocidos', 'espinacas', 'tomate', 'aceite de oliva'],
      prep_time_minutes: 15,
    },
    {
      meal_type: 'dinner',
      name: 'Tofu salteado con verduras y arroz',
      description: 'Dados de tofu firme salteados con pimiento, zanahoria y salsa de soja.',
      approximate_calories: 480,
      protein_g: 28,
      carbs_g: 55,
      fat_g: 12,
      ingredients: ['180g tofu firme', '150g arroz', 'pimiento', 'zanahoria', 'salsa de soja'],
      prep_time_minutes: 20,
    },
    {
      meal_type: 'snack',
      name: 'Hummus con bastones de verdura',
      description: 'Hummus casero con zanahorias, apio y pepino.',
      approximate_calories: 200,
      protein_g: 8,
      carbs_g: 25,
      fat_g: 8,
      ingredients: ['80g hummus', 'zanahorias', 'apio', 'pepino'],
      prep_time_minutes: 5,
    },
  ],
  vegan: [
    {
      meal_type: 'breakfast',
      name: 'Smoothie bowl de proteína vegana',
      description: 'Base de plátano congelado con proteína vegana, semillas de chía y frutas.',
      approximate_calories: 380,
      protein_g: 25,
      carbs_g: 55,
      fat_g: 8,
      ingredients: ['2 plátanos congelados', '1 scoop proteína vegana', '2 cucharadas chía', 'fruta de temporada'],
      prep_time_minutes: 10,
    },
    {
      meal_type: 'lunch',
      name: 'Lentejas con arroz y verduras',
      description: 'Lentejas estofadas con arroz integral y verduras de temporada.',
      approximate_calories: 510,
      protein_g: 25,
      carbs_g: 80,
      fat_g: 6,
      ingredients: ['150g lentejas cocidas', '100g arroz integral', 'zanahoria', 'cebolla', 'tomate'],
      prep_time_minutes: 25,
    },
    {
      meal_type: 'dinner',
      name: 'Curry de garbanzos con coco',
      description: 'Curry suave de garbanzos con leche de coco, espinacas y naan integral.',
      approximate_calories: 490,
      protein_g: 20,
      carbs_g: 65,
      fat_g: 16,
      ingredients: ['200g garbanzos', '100ml leche de coco', 'espinacas', 'especias curry', 'pan naan integral'],
      prep_time_minutes: 25,
    },
    {
      meal_type: 'snack',
      name: 'Edamame con sal marina',
      description: 'Edamame al vapor con sal marina y limón.',
      approximate_calories: 150,
      protein_g: 12,
      carbs_g: 10,
      fat_g: 5,
      ingredients: ['150g edamame congelado', 'sal marina', 'limón'],
      prep_time_minutes: 5,
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

/**
 * Genera un plan de entrenamiento y nutrición genérico basado en reglas.
 * Se usa como fallback cuando la API de Claude no está disponible.
 *
 * @param onboardingData - Datos completos del onboarding del usuario
 * @returns Plan genérico con generated_by_ai = false
 */
export function generateFallbackPlan(onboardingData: OnboardingData): GeneratedPlan {
  const { physical, training, nutrition } = onboardingData;

  // Calcular TMB y TDEE para las calorías
  const metrics = calculateMetabolism(physical);

  // Determinar qué ejercicios usar según acceso a gym
  const exerciseKey = training.has_gym_access ? 'strength_gym' : 'strength_no_gym';
  const sessionDuration = Math.min(
    training.max_session_duration_minutes ?? DURATION_BY_LEVEL[training.experience_level] ?? 45,
    DURATION_BY_LEVEL[training.experience_level] ?? 45,
  );

  // Seleccionar tipos de sesión según objetivo
  const sessionTypes = SESSION_TYPES_BY_GOAL[physical.goal] ?? SESSION_TYPES_BY_GOAL.general_health;
  const availableDays = Math.min(training.available_days_per_week, 6);
  const activeDays = sessionTypes.slice(0, 7).filter(t => t !== 'rest').slice(0, availableDays);
  const actualDaysCount = availableDays;

  // Construir el horario semanal
  const weeklySchedule: WeeklySession[] = [];
  let strengthDayIndex = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayNum = dayIndex + 1;
    const dayName = DAY_NAMES[dayIndex];

    // Si ya completamos los días disponibles, el resto son descanso
    if (dayIndex >= actualDaysCount) {
      weeklySchedule.push({
        day_of_week: dayNum,
        day_name: dayName,
        session_type: 'rest',
        duration_minutes: 0,
        muscle_groups: [],
        exercises: [],
        notes: 'Día de descanso activo. Caminar, estiramientos suaves.',
      });
      continue;
    }

    const sessionType = sessionTypes[dayIndex] ?? 'rest';

    if (sessionType === 'rest') {
      weeklySchedule.push({
        day_of_week: dayNum,
        day_name: dayName,
        session_type: 'rest',
        duration_minutes: 0,
        muscle_groups: [],
        exercises: [],
        notes: 'Día de descanso activo. Caminar, estiramientos suaves.',
      });
      continue;
    }

    const exercisesForSession =
      sessionType === 'strength'
        ? BASIC_EXERCISES[exerciseKey]
        : sessionType === 'cardio'
        ? BASIC_EXERCISES.cardio
        : sessionType === 'hiit'
        ? BASIC_EXERCISES.hiit
        : BASIC_EXERCISES.flexibility;

    const muscleGroups =
      sessionType === 'strength'
        ? MUSCLE_GROUPS_BY_DAY_INDEX[strengthDayIndex % 5] ?? ['cuerpo completo']
        : sessionType === 'cardio' || sessionType === 'hiit'
        ? ['sistema cardiovascular']
        : ['flexibilidad general'];

    if (sessionType === 'strength') strengthDayIndex++;

    weeklySchedule.push({
      day_of_week: dayNum,
      day_name: dayName,
      session_type: sessionType,
      duration_minutes: sessionType === 'flexibility' ? 20 : sessionDuration,
      muscle_groups: muscleGroups,
      exercises: exercisesForSession.map(ex => ({ ...ex })),
      notes: `Sesión ${sessionType}. Calienta 5 min antes y estira 5 min al final.`,
    });
  }

  // Calcular macros según objetivo
  const dailyCalories = metrics.target_calories;
  const macros = calculateMacros(dailyCalories, physical.goal);

  // Seleccionar plantilla de comidas según tipo de dieta
  const dietType = nutrition?.diet_type ?? 'omnivore';
  const mealTemplateKey = ['vegan', 'vegetarian'].includes(dietType) ? dietType : 'omnivore';
  const mealsPerDay = nutrition?.meals_per_day_preferred ?? 3;
  const mealSuggestions = selectMeals(MEAL_TEMPLATES[mealTemplateKey] ?? MEAL_TEMPLATES.omnivore, mealsPerDay);

  return {
    training_plan: {
      weeks: 4,
      sessions_per_week: activeDays.length,
      weekly_schedule: weeklySchedule,
    },
    nutrition_plan: {
      daily_calories: dailyCalories,
      macros,
      meals_per_day: mealsPerDay,
      meal_suggestions: mealSuggestions,
    },
    notes: buildFallbackNotes(physical.goal, training.experience_level),
    generated_at: new Date().toISOString(),
    model_version: 'fallback-rules-v1',
    generated_by_ai: false,
    metabolism_metrics: metrics,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

/**
 * Calcula los macros en gramos según calorías objetivo y objetivo del usuario.
 * Distribución estándar basada en evidencia:
 *   - Perder peso:    proteína alta (35%), grasas moderadas (30%), carbos bajos (35%)
 *   - Ganar músculo:  proteína alta (30%), carbos altos (45%), grasas moderadas (25%)
 *   - Mantenimiento:  proteína moderada (25%), carbos (50%), grasas (25%)
 *   - Salud general:  proteína moderada (25%), carbos (50%), grasas (25%)
 */
function calculateMacros(
  dailyCalories: number,
  goal: string,
): { protein_g: number; carbs_g: number; fat_g: number } {
  const ratios: Record<string, [number, number, number]> = {
    lose_weight:    [0.35, 0.35, 0.30],
    gain_muscle:    [0.30, 0.45, 0.25],
    maintain:       [0.25, 0.50, 0.25],
    general_health: [0.25, 0.50, 0.25],
  };

  const [proteinRatio, carbsRatio, fatRatio] = ratios[goal] ?? ratios.general_health;

  return {
    protein_g: Math.round((dailyCalories * proteinRatio) / 4),
    carbs_g:   Math.round((dailyCalories * carbsRatio) / 4),
    fat_g:     Math.round((dailyCalories * fatRatio) / 9),
  };
}

/**
 * Selecciona las sugerencias de comida según el número de comidas preferidas.
 * Siempre incluye desayuno, comida y cena. Añade snacks si hay más de 3 comidas.
 */
function selectMeals(templates: MealSuggestion[], mealsPerDay: number): MealSuggestion[] {
  const main = templates.filter(m => m.meal_type !== 'snack');
  const snacks = templates.filter(m => m.meal_type === 'snack');

  if (mealsPerDay <= 3) return main;

  const extraSnacks = snacks.slice(0, mealsPerDay - 3);
  return [...main, ...extraSnacks];
}

/**
 * Construye las notas del plan de fallback según el objetivo y nivel.
 */
function buildFallbackNotes(goal: string, level: string): string {
  const goalMessages: Record<string, string> = {
    lose_weight: 'Tu objetivo es perder peso. Mantén un déficit calórico moderado (300-500 kcal/día) y prioriza el cardio y el HIIT.',
    gain_muscle: 'Tu objetivo es ganar músculo. Mantén un superávit calórico moderado (250-400 kcal/día) y prioriza el entrenamiento de fuerza progresivo.',
    maintain: 'Tu objetivo es mantener tu peso y condición física actual. Equilibra el entrenamiento y la alimentación.',
    general_health: 'Tu objetivo es mejorar tu salud general. Combina ejercicio cardiovascular, fuerza y flexibilidad.',
  };

  const levelMessages: Record<string, string> = {
    beginner: 'Como principiante, lo más importante es crear el hábito. Empieza con 3 días por semana y aumenta gradualmente.',
    intermediate: 'Con tu nivel intermedio, puedes añadir más intensidad y volumen progresivamente.',
    advanced: 'Con tu nivel avanzado, aplica periodización y variación de estímulos para seguir progresando.',
  };

  return [
    '⚠️ Este plan ha sido generado de forma automática por reglas predefinidas (sin IA) debido a un error temporal del servicio.',
    '',
    goalMessages[goal] ?? goalMessages.general_health,
    levelMessages[level] ?? levelMessages.beginner,
    '',
    'Recomendaciones generales:',
    '• Hidratación: bebe al menos 2 litros de agua al día.',
    '• Sueño: intenta dormir entre 7-9 horas cada noche.',
    '• Consulta con un profesional de la salud antes de comenzar cualquier programa de ejercicio si tienes condiciones médicas.',
    '',
    'Cuando el servicio de IA esté disponible, puedes solicitar un plan personalizado desde la pantalla de tu perfil.',
  ].join('\n');
}
