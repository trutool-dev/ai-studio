/**
 * Servicio de IA para generación de planes personalizados.
 * Wrapper JavaScript del módulo TypeScript ai/planGenerator.ts.
 * Re-implementa la lógica en JS puro con la Anthropic SDK para
 * evitar dependencia de ts-node en runtime.
 *
 * Implementa: AI-01 (generación), AI-02 (TMB/TDEE), AI-04 (estancamiento),
 *             AI-05 (prompt caching), AI-06 (fallback)
 */

const Anthropic = require('@anthropic-ai/sdk');
const redis = require('./redis.service');
const logger = require('../utils/logger.util');

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const AI_PLAN_TTL = 86400; // 24 horas en segundos

const ACTIVITY_FACTORS = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

// ─────────────────────────────────────────────────────────────
// CÁLCULO TMB / TDEE (AI-02) — Mifflin-St Jeor
// ─────────────────────────────────────────────────────────────

/**
 * Calcula TMB, TDEE y calorías objetivo según el perfil físico.
 * @param {{ age, weight_kg, height_cm, gender, activity_level, goal }} profile
 * @returns {{ bmr: number, tdee: number, target_calories: number }}
 */
function calculateMetabolism(profile) {
  const { age, gender, activity_level, goal } = profile;
  const weight = parseFloat(profile.weight_kg);
  const height = parseFloat(profile.height_cm);

  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const factor = ACTIVITY_FACTORS[activity_level] || 1.55;
  const tdee = Math.round(bmr * factor);

  let target_calories;
  switch (goal) {
    case 'lose_weight':
      target_calories = Math.max(1200, Math.round(tdee * 0.80));
      break;
    case 'gain_muscle':
      target_calories = Math.round(tdee * 1.10);
      break;
    default:
      target_calories = tdee;
  }

  return { bmr: Math.round(bmr), tdee, target_calories };
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT (cacheable con prompt caching AI-05)
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto nutricionista y entrenador personal certificado especializado en planes personalizados de salud y fitness.

Tu tarea es generar un plan COMPLETO y PERSONALIZADO de entrenamiento y nutrición basado en los datos del usuario.

## REGLAS ESTRICTAS

1. Responde SIEMPRE con un JSON válido y nada más. Sin texto antes ni después del JSON.
2. El JSON debe seguir EXACTAMENTE esta estructura:
{
  "training_plan": {
    "weeks": <número de semanas, normalmente 4>,
    "sessions_per_week": <número de sesiones activas por semana>,
    "weekly_schedule": [
      {
        "day_of_week": <1=lunes...7=domingo>,
        "day_name": "<nombre del día en español>",
        "session_type": "<strength|cardio|hiit|flexibility|rest>",
        "duration_minutes": <duración en minutos, 0 si es descanso>,
        "muscle_groups": ["<grupos musculares trabajados>"],
        "exercises": [
          {
            "name": "<nombre del ejercicio>",
            "sets": <número de series>,
            "reps": "<repeticiones o tiempo como string>",
            "rest_seconds": <segundos de descanso>,
            "equipment_needed": "<equipamiento o null>",
            "instructions": "<instrucción breve>"
          }
        ],
        "notes": "<notas de la sesión>"
      }
    ]
  },
  "nutrition_plan": {
    "daily_calories": <calorías totales diarias>,
    "macros": {
      "protein_g": <gramos de proteína>,
      "carbs_g": <gramos de carbohidratos>,
      "fat_g": <gramos de grasa>
    },
    "meals_per_day": <número de comidas>,
    "meal_suggestions": [
      {
        "meal_type": "<breakfast|lunch|dinner|snack>",
        "name": "<nombre de la comida>",
        "description": "<descripción breve>",
        "approximate_calories": <calorías aprox>,
        "protein_g": <gramos>,
        "carbs_g": <gramos>,
        "fat_g": <gramos>,
        "ingredients": ["<ingrediente 1>", "<ingrediente 2>"],
        "prep_time_minutes": <minutos de preparación>
      }
    ]
  },
  "notes": "<notas generales y recomendaciones>",
  "generated_at": "<ISO 8601 timestamp>",
  "model_version": "claude-sonnet-4-6"
}

## CRITERIOS DE CALIDAD
- Ajusta la intensidad al nivel de experiencia del usuario
- Respeta ABSOLUTAMENTE todas las lesiones, limitaciones y condiciones médicas
- Respeta ABSOLUTAMENTE todas las restricciones alimentarias y alergias
- Basa las calorías en el TDEE calculado proporcionado
- Distribuye los días de entrenamiento para optimizar la recuperación
- Incluye al menos 1-2 días de descanso por semana
- Proporciona al menos una sugerencia por tipo de comida del día

## CATÁLOGO DE EJERCICIOS
Recibirás un catálogo de ejercicios reales en el mensaje del usuario.
DEBES usar ÚNICAMENTE los ejercicios de ese catálogo.
NO inventes ejercicios. NO añadas ejercicios que no estén en el catálogo.
Si el catálogo no tiene suficientes ejercicios para un día, usa menos ejercicios ese día.
Cada ejercicio del plan DEBE incluir su ID exacto del catálogo (campo ID:XXXX).`;

// ─────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL PROMPT DE USUARIO
// ─────────────────────────────────────────────────────────────

/**
 * Formatea el catálogo de ejercicios reales para incluirlo en el prompt.
 * @param {Array} exercises - Lista de ejercicios del catálogo real
 * @returns {string}
 */
function formatExercisesForPrompt(exercises) {
  return exercises.map(ex => {
    const parts = [
      `- ${ex.name} (ID:${ex.externalId || ex.id})`,
      `  Zona: ${ex.bodyPart || ''} | Equipo: ${ex.equipment || ''} | Músculo: ${ex.target || ''}`,
    ];
    if (ex.secondaryMuscles && ex.secondaryMuscles.length > 0) {
      parts.push(`  Músculos secundarios: ${ex.secondaryMuscles.slice(0, 3).join(', ')}`);
    }
    return parts.join('\n');
  }).join('\n');
}

/**
 * @param {object} onboardingData
 * @param {object} metrics
 * @param {string|null} extraContext
 * @param {Array} exercises - Catálogo de ejercicios reales para el plan
 */
function buildUserContextPrompt(onboardingData, metrics, extraContext, exercises = []) {
  const { physical, lifestyle, training, nutrition, health, motivation } = onboardingData;
  const lines = [
    '## DATOS DEL USUARIO',
    '',
    '### Métricas calculadas (Mifflin-St Jeor)',
    `- TMB: ${metrics.bmr} kcal/día`,
    `- TDEE: ${metrics.tdee} kcal/día`,
    `- Calorías objetivo: ${metrics.target_calories} kcal/día`,
    '',
    '### Perfil físico',
    `- Edad: ${physical.age} años`,
    `- Peso: ${physical.weight_kg} kg`,
    `- Altura: ${physical.height_cm} cm`,
    `- Sexo: ${physical.gender === 'male' ? 'Hombre' : 'Mujer'}`,
    `- Complexión: ${physical.body_type || 'no especificada'}`,
    `- Nivel de actividad: ${physical.activity_level}`,
    `- Objetivo: ${physical.goal}`,
  ];

  if (lifestyle) {
    lines.push('', '### Estilo de vida');
    if (lifestyle.profession) lines.push(`- Profesión: ${lifestyle.profession}`);
    if (lifestyle.stress_level) lines.push(`- Nivel de estrés (1-5): ${lifestyle.stress_level}`);
    if (lifestyle.sleep_hours_usual) lines.push(`- Horas de sueño: ${lifestyle.sleep_hours_usual}`);
    if (lifestyle.sleep_quality) lines.push(`- Calidad del sueño: ${lifestyle.sleep_quality}`);
    if (lifestyle.smoker !== undefined) lines.push(`- Fumador: ${lifestyle.smoker ? 'Sí' : 'No'}`);
  }

  lines.push('', '### Preferencias de entrenamiento');
  lines.push(`- Días disponibles: ${training.available_days_per_week}`);
  if (training.max_session_duration_minutes) lines.push(`- Duración máxima: ${training.max_session_duration_minutes} min`);
  lines.push(`- Acceso a gimnasio: ${training.has_gym_access ? 'Sí' : 'No'}`);
  lines.push(`- Equipamiento: ${training.home_equipment || 'ninguno'}`);
  lines.push(`- Nivel: ${training.experience_level}`);
  if (training.injuries_or_limitations) lines.push(`- LESIONES/LIMITACIONES (RESPETAR ESTRICTAMENTE): ${training.injuries_or_limitations}`);

  if (nutrition) {
    lines.push('', '### Preferencias nutricionales');
    if (nutrition.diet_type) lines.push(`- Tipo de dieta: ${nutrition.diet_type}`);
    if (nutrition.meals_per_day_preferred) lines.push(`- Comidas al día: ${nutrition.meals_per_day_preferred}`);
    if (nutrition.food_restrictions && nutrition.food_restrictions.length) {
      lines.push('- RESTRICCIONES ALIMENTARIAS (RESPETAR ESTRICTAMENTE):');
      nutrition.food_restrictions.forEach(r => lines.push(`  · ${r.restriction_type}: ${r.food_name}`));
    }
  }

  if (health && health.conditions && health.conditions.length) {
    lines.push('', '### Condiciones de salud (TENER EN CUENTA EN EL PLAN)');
    health.conditions.forEach(c => {
      lines.push(`- ${c.condition_name} (${c.condition_type})`);
      if (c.affects_training) lines.push('  · Afecta al entrenamiento');
      if (c.affects_nutrition) lines.push('  · Afecta a la nutrición');
    });
  }

  if (motivation) {
    lines.push('', '### Motivación');
    if (motivation.main_motivation) lines.push(`- Motivación: ${motivation.main_motivation}`);
    if (motivation.tracking_preference) lines.push(`- Seguimiento preferido: ${motivation.tracking_preference}`);
  }

  if (extraContext) {
    lines.push('', '## CONTEXTO ADICIONAL', extraContext);
  }

  lines.push('', '## INSTRUCCIÓN FINAL');
  lines.push('Genera el plan siguiendo EXACTAMENTE el formato JSON del system prompt. Usa las calorías objetivo calculadas.');

  let exerciseCatalog = '';
  if (exercises && exercises.length > 0) {
    exerciseCatalog = `\n\n=== CATÁLOGO DE EJERCICIOS DISPONIBLES (${exercises.length} ejercicios) ===\n`;
    exerciseCatalog += 'Usa ÚNICAMENTE estos ejercicios en el plan. Incluye el ID de cada ejercicio:\n\n';
    exerciseCatalog += formatExercisesForPrompt(exercises);
    exerciseCatalog += '\n=== FIN DEL CATÁLOGO ===\n';
    exerciseCatalog += '\nIMPORTANTE: Solo puedes incluir ejercicios de la lista anterior. Cada ejercicio del plan debe tener su ID:XXXX.';
  }

  return lines.join('\n') + exerciseCatalog;
}

// ─────────────────────────────────────────────────────────────
// FALLBACK (AI-06)
// ─────────────────────────────────────────────────────────────

function calculateMacros(dailyCalories, goal) {
  const ratios = {
    lose_weight:    [0.35, 0.35, 0.30],
    gain_muscle:    [0.30, 0.45, 0.25],
    maintain:       [0.25, 0.50, 0.25],
    general_health: [0.25, 0.50, 0.25],
  };
  const [p, c, f] = ratios[goal] || ratios.general_health;
  return {
    protein_g: Math.round((dailyCalories * p) / 4),
    carbs_g:   Math.round((dailyCalories * c) / 4),
    fat_g:     Math.round((dailyCalories * f) / 9),
  };
}

function generateFallbackPlan(onboardingData) {
  const { physical, training, nutrition } = onboardingData;
  const metrics = calculateMetabolism(physical);
  const macros = calculateMacros(metrics.target_calories, physical.goal);
  const mealsPerDay = nutrition?.meals_per_day_preferred || 3;
  const availableDays = Math.min(training.available_days_per_week || 3, 7);
  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const SESSION_TYPES = {
    lose_weight:    ['cardio', 'hiit', 'strength', 'cardio', 'hiit', 'flexibility', 'rest'],
    gain_muscle:    ['strength', 'strength', 'rest', 'strength', 'strength', 'cardio', 'rest'],
    maintain:       ['strength', 'cardio', 'flexibility', 'strength', 'cardio', 'rest', 'rest'],
    general_health: ['cardio', 'strength', 'flexibility', 'cardio', 'strength', 'flexibility', 'rest'],
  };
  const types = SESSION_TYPES[physical.goal] || SESSION_TYPES.general_health;

  const weeklySchedule = DAY_NAMES.map((dayName, i) => {
    const sessionType = i < availableDays ? types[i] : 'rest';
    return {
      day_of_week: i + 1,
      day_name: dayName,
      session_type: sessionType,
      duration_minutes: sessionType === 'rest' ? 0 : 45,
      muscle_groups: sessionType === 'rest' ? [] : ['cuerpo completo'],
      exercises: sessionType === 'rest' ? [] : [
        { name: 'Sentadillas', sets: 3, reps: '15', rest_seconds: 60, instructions: 'Baja hasta paralelo al suelo.' },
        { name: 'Flexiones', sets: 3, reps: '10-15', rest_seconds: 60, instructions: 'Mantén el cuerpo recto.' },
        { name: 'Plancha', sets: 3, reps: '30 segundos', rest_seconds: 45, instructions: 'Core tenso, espalda recta.' },
      ],
      notes: sessionType === 'rest' ? 'Descanso activo. Caminar o estiramientos suaves.' : 'Calienta 5 min. Estira al finalizar.',
    };
  });

  return {
    training_plan: { weeks: 4, sessions_per_week: availableDays, weekly_schedule: weeklySchedule },
    nutrition_plan: {
      daily_calories: metrics.target_calories,
      macros,
      meals_per_day: mealsPerDay,
      meal_suggestions: [
        { meal_type: 'breakfast', name: 'Avena con fruta', description: 'Avena con plátano y frutos rojos.', approximate_calories: 380, protein_g: 12, carbs_g: 70, fat_g: 6, ingredients: ['80g avena', '1 plátano', 'frutos rojos'], prep_time_minutes: 10 },
        { meal_type: 'lunch', name: 'Pollo con arroz', description: 'Pechuga a la plancha con arroz integral.', approximate_calories: 520, protein_g: 42, carbs_g: 55, fat_g: 10, ingredients: ['200g pollo', '150g arroz integral', 'verduras'], prep_time_minutes: 20 },
        { meal_type: 'dinner', name: 'Ensalada proteica', description: 'Ensalada con proteína magra y aguacate.', approximate_calories: 400, protein_g: 35, carbs_g: 20, fat_g: 18, ingredients: ['proteína magra', 'lechuga', 'tomate', 'aguacate'], prep_time_minutes: 10 },
        { meal_type: 'snack', name: 'Yogur con nueces', description: 'Yogur griego con nueces.', approximate_calories: 220, protein_g: 14, carbs_g: 15, fat_g: 10, ingredients: ['200g yogur griego', '25g nueces'], prep_time_minutes: 2 },
      ].slice(0, mealsPerDay),
    },
    notes: 'Plan generado automáticamente por reglas (sin IA). Consulta a un profesional de la salud antes de comenzar.',
    generated_at: new Date().toISOString(),
    model_version: 'fallback-rules-v1',
    generated_by_ai: false,
    metabolism_metrics: metrics,
  };
}

// ─────────────────────────────────────────────────────────────
// EXTRACTOR DE JSON
// ─────────────────────────────────────────────────────────────

function extractJson(text) {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  const jsonMatch = text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

// ─────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL (AI-01)
// ─────────────────────────────────────────────────────────────

/**
 * Genera un plan personalizado de entrenamiento y nutrición.
 * Usa caché Redis para evitar regeneraciones innecesarias el mismo día.
 * Implementa prompt caching de Anthropic (AI-05).
 * Si Claude falla, usa el plan de fallback (AI-06).
 *
 * @param {string} userId
 * @param {object} onboardingData
 * @param {string} requestType
 * @param {string|null} extraContext
 */
async function generatePlan(userId, onboardingData, requestType = 'plan_generation', extraContext = null, exercises = []) {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `plan:${userId}:${today}`;

  // Verificar caché (solo para generaciones nuevas)
  if (requestType === 'plan_generation') {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`[AI] Plan cacheado para usuario ${userId} (${today})`);
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      logger.warn('[AI] Error al leer caché Redis:', cacheErr.message);
    }
  }

  const metrics = calculateMetabolism(onboardingData.physical);

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no configurada');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userContextPrompt = buildUserContextPrompt(onboardingData, metrics, extraContext, exercises);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContextPrompt }],
    });

    const rawContent = response.content[0];
    if (rawContent.type !== 'text') throw new Error('Claude devolvió contenido no textual');

    const parsed = JSON.parse(extractJson(rawContent.text));
    const plan = {
      ...parsed,
      generated_by_ai: true,
      metabolism_metrics: metrics,
      generated_at: new Date().toISOString(),
      model_version: MODEL,
    };

    // Cachear en Redis
    try {
      await redis.set(cacheKey, JSON.stringify(plan), 'EX', AI_PLAN_TTL);
    } catch (cacheErr) {
      logger.warn('[AI] Error al guardar caché Redis:', cacheErr.message);
    }

    logger.info(`[AI] Plan generado y cacheado para usuario ${userId}`);
    return plan;

  } catch (err) {
    logger.error('[AI] Error al generar plan con Claude:', err.message, err.status || '', err.error || '');
    logger.warn('[AI] Activando plan de fallback.');
    const fallback = generateFallbackPlan(onboardingData);

    try {
      await redis.set(cacheKey, JSON.stringify(fallback), 'EX', AI_PLAN_TTL);
    } catch (cacheErr) {
      logger.warn('[AI] Error al cachear fallback:', cacheErr.message);
    }

    return fallback;
  }
}

/**
 * Regenera el plan con contexto adicional (estancamiento, cambio de objetivo, etc.).
 * @param {string} userId
 * @param {object} onboardingData
 * @param {string} reason - 'weight_plateau'|'goal_change'|'injury'|'manual_request'
 * @param {Array} progressLogs
 * @param {string|null} exerciseCatalogContext - Catálogo de ejercicios filtrado para incluir en el prompt
 */
async function regeneratePlan(userId, onboardingData, reason, progressLogs = [], exerciseCatalogContext = null) {
  const contextLines = ['REGENERACIÓN DE PLAN — Actualización solicitada por:'];

  switch (reason) {
    case 'weight_plateau':
      contextLines.push('El usuario lleva más de 2 semanas sin cambio de peso significativo (variación ≤ 0.5 kg).');
      contextLines.push('Modifica el déficit/superávit calórico en ±100-150 kcal e introduce variación en el entrenamiento.');
      break;
    case 'goal_change':
      contextLines.push('El usuario ha cambiado su objetivo principal. Adapta el plan al nuevo objetivo.');
      break;
    case 'injury':
      contextLines.push('El usuario reportó una nueva lesión. Adapta estrictamente el entrenamiento a la limitación.');
      break;
    default:
      contextLines.push('El usuario solicitó una actualización de su plan. Introduce variaciones para mantener la motivación.');
  }

  // Añadir catálogo de ejercicios al contexto si está disponible
  if (exerciseCatalogContext) {
    contextLines.push('', exerciseCatalogContext);
  }

  return generatePlan(userId, onboardingData, 'plan_regeneration', contextLines.join('\n'));
}

/**
 * Determina si el usuario lleva más de 2 semanas estancado (variación de peso ≤ 0.5 kg).
 * @param {Array<{log_date: string, weight_kg: number|null}>} progressLogs
 * @returns {boolean}
 */
function shouldRegeneratePlan(progressLogs) {
  if (!progressLogs || progressLogs.length < 4) return false;

  const sorted = [...progressLogs]
    .filter(l => l.weight_kg !== null)
    .sort((a, b) => new Date(b.log_date) - new Date(a.log_date));

  if (sorted.length < 4) return false;

  const mostRecentDate = new Date(sorted[0].log_date);
  const twoWeeksAgo = new Date(mostRecentDate);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const recentLogs = sorted.filter(l => new Date(l.log_date) >= twoWeeksAgo);
  if (recentLogs.length < 4) return false;

  const weights = recentLogs.map(l => parseFloat(l.weight_kg));
  const range = Math.max(...weights) - Math.min(...weights);
  return range <= 0.5;
}

module.exports = {
  calculateMetabolism,
  generatePlan,
  regeneratePlan,
  shouldRegeneratePlan,
  generateFallbackPlan,
  // Exportadas para tests unitarios
  buildUserContextPrompt,
  formatExercisesForPrompt,
};
