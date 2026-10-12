/**
 * Generador de planes personalizados de entrenamiento y nutrición con Claude.
 *
 * Implementa:
 *   AI-01 — Generación de plan con todos los datos de onboarding
 *   AI-02 — Cálculo previo de TMB/TDEE con Mifflin-St Jeor
 *   AI-04 — Detección de estancamiento y regeneración automática
 *   AI-05 — Prompt caching con cache_control ephemeral
 *
 * La API key viene de process.env.CLAUDE_API_KEY.
 * El caché Redis está en ../database/redis.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  cacheAiPlan,
  getCachedAiPlan,
} from '../database/redis';
import {
  buildTokenUsageLog,
  logTokenUsage,
} from './tokenLogger';
import { generateFallbackPlan } from './fallbackPlan';
import {
  calculateMetabolism,
  type OnboardingData,
  type GeneratedPlan,
  type ProgressLog,
  type RegenerationReason,
} from './types';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';

/**
 * System prompt base. Se cachea con Anthropic prompt caching (AI-05).
 * Describe el rol de Claude y el formato de respuesta esperado.
 * No contiene datos del usuario — esos van en el segundo bloque.
 */
const SYSTEM_PROMPT = `Eres un experto nutricionista y entrenador personal certificado especializado en planes personalizados de salud y fitness.

Tu tarea es generar un plan COMPLETO y PERSONALIZADO de entrenamiento y nutrición basado en los datos del usuario.

## REGLAS ESTRICTAS

1. Responde SIEMPRE con un JSON válido y nada más. Sin texto antes ni después del JSON.
2. El JSON debe seguir EXACTAMENTE esta estructura (sin campos extra en el nivel raíz):
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
  "notes": "<notas generales y recomendaciones importantes para el usuario>",
  "generated_at": "<ISO 8601 timestamp>",
  "model_version": "claude-sonnet-4-6"
}

## CRITERIOS DE CALIDAD

- Ajusta la intensidad al nivel de experiencia del usuario
- Respeta ABSOLUTAMENTE todas las lesiones, limitaciones y condiciones médicas
- Respeta ABSOLUTAMENTE todas las restricciones alimentarias y alergias
- Las calorías del plan de nutrición deben estar basadas en el TDEE calculado proporcionado
- Distribuye los días de entrenamiento para optimizar la recuperación muscular
- Incluye siempre días de descanso suficientes (al menos 1-2 por semana)
- Las sugerencias de comida deben cumplir con el tipo de dieta del usuario
- Asegúrate de que la suma de macros (×4 proteína, ×4 carbos, ×9 grasas) se aproxime a las calorías totales
- Proporciona al menos una sugerencia por tipo de comida del día`;

// ─────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL PROMPT DE USUARIO
// ─────────────────────────────────────────────────────────────

/**
 * Construye el bloque de contexto del usuario para el prompt de Claude.
 * Incluye todos los datos del onboarding y las métricas pre-calculadas.
 * Este bloque NO se cachea (varía por usuario).
 *
 * @param onboardingData - Datos completos del onboarding
 * @param metrics        - TMB y TDEE pre-calculados
 * @param extraContext   - Contexto adicional (p.ej. para regeneración)
 */
function buildUserContextPrompt(
  onboardingData: OnboardingData,
  metrics: MetabolismMetrics,
  extraContext?: string,
): string {
  const { physical, lifestyle, training, nutrition, health, motivation } = onboardingData;

  const lines: string[] = [
    '## DATOS DEL USUARIO',
    '',
    '### Métricas calculadas (Mifflin-St Jeor)',
    `- TMB (Tasa Metabólica Basal): ${metrics.bmr} kcal/día`,
    `- TDEE (Gasto energético diario total): ${metrics.tdee} kcal/día`,
    `- Calorías objetivo según goal: ${metrics.target_calories} kcal/día`,
    '',
    '### Perfil físico',
    `- Edad: ${physical.age} años`,
    `- Peso: ${physical.weight_kg} kg`,
    `- Altura: ${physical.height_cm} cm`,
    `- Sexo: ${physical.gender === 'male' ? 'Hombre' : 'Mujer'}`,
    `- Complexión: ${physical.body_type ?? 'no especificada'}`,
    `- Nivel de actividad: ${physical.activity_level}`,
    `- Objetivo principal: ${physical.goal}`,
  ];

  if (lifestyle) {
    lines.push('', '### Estilo de vida');
    if (lifestyle.profession) lines.push(`- Profesión: ${lifestyle.profession}`);
    if (lifestyle.work_hours_per_day) lines.push(`- Horas de trabajo al día: ${lifestyle.work_hours_per_day}`);
    if (lifestyle.stress_level) lines.push(`- Nivel de estrés (1-5): ${lifestyle.stress_level}`);
    if (lifestyle.usual_schedule) lines.push(`- Horario habitual: ${lifestyle.usual_schedule}`);
    if (lifestyle.sleep_hours_usual) lines.push(`- Horas de sueño habituales: ${lifestyle.sleep_hours_usual}`);
    if (lifestyle.sleep_quality) lines.push(`- Calidad del sueño: ${lifestyle.sleep_quality}`);
    if (lifestyle.alcohol_consumption) lines.push(`- Consumo de alcohol: ${lifestyle.alcohol_consumption}`);
    if (lifestyle.smoker !== undefined) lines.push(`- Fumador: ${lifestyle.smoker ? 'Sí' : 'No'}`);
  }

  lines.push('', '### Preferencias de entrenamiento');
  lines.push(`- Días disponibles por semana: ${training.available_days_per_week}`);
  if (training.max_session_duration_minutes) {
    lines.push(`- Duración máxima de sesión: ${training.max_session_duration_minutes} minutos`);
  }
  lines.push(`- Acceso a gimnasio: ${training.has_gym_access ? 'Sí' : 'No'}`);
  lines.push(`- Equipamiento en casa: ${training.home_equipment ?? 'ninguno'}`);
  lines.push(`- Nivel de experiencia: ${training.experience_level}`);
  if (training.injuries_or_limitations) {
    lines.push(`- ⚠️ Lesiones/limitaciones (RESPETAR ESTRICTAMENTE): ${training.injuries_or_limitations}`);
  }

  if (nutrition) {
    lines.push('', '### Preferencias nutricionales');
    if (nutrition.diet_type) lines.push(`- Tipo de dieta: ${nutrition.diet_type}`);
    if (nutrition.meals_per_day_preferred) lines.push(`- Comidas preferidas al día: ${nutrition.meals_per_day_preferred}`);
    if (nutrition.food_restrictions?.length) {
      lines.push('- ⚠️ Restricciones alimentarias (RESPETAR ESTRICTAMENTE):');
      nutrition.food_restrictions.forEach(r => {
        lines.push(`  · ${r.restriction_type}: ${r.food_name}`);
      });
    }
  }

  if (health?.conditions?.length) {
    lines.push('', '### Condiciones de salud');
    lines.push('⚠️ ATENCIÓN — Tener en cuenta en el plan:');
    health.conditions.forEach(c => {
      lines.push(`- ${c.condition_name} (${c.condition_type})`);
      if (c.affects_training) lines.push('  · Afecta al entrenamiento');
      if (c.affects_nutrition) lines.push('  · Afecta a la nutrición');
      if (c.notes) lines.push(`  · Notas: ${c.notes}`);
    });
  }

  if (motivation) {
    lines.push('', '### Motivación y seguimiento');
    if (motivation.main_motivation) lines.push(`- Motivación principal: ${motivation.main_motivation}`);
    if (motivation.previous_attempts !== undefined) {
      lines.push(`- Intentos previos: ${motivation.previous_attempts ? 'Sí' : 'No'}`);
      if (motivation.previous_attempts_notes) lines.push(`  · ${motivation.previous_attempts_notes}`);
    }
    if (motivation.tracking_preference) lines.push(`- Preferencia de seguimiento: ${motivation.tracking_preference}`);
  }

  if (extraContext) {
    lines.push('', '## CONTEXTO ADICIONAL PARA ESTA GENERACIÓN', extraContext);
  }

  lines.push('', '## INSTRUCCIÓN FINAL');
  lines.push('Genera el plan personalizado siguiendo EXACTAMENTE el formato JSON especificado en el system prompt. Usa las calorías objetivo calculadas.');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// GENERADOR PRINCIPAL (AI-01, AI-02, AI-05)
// ─────────────────────────────────────────────────────────────

/**
 * Genera un plan personalizado de entrenamiento y nutrición con Claude.
 * Usa caché Redis para evitar generar el mismo plan dos veces en el mismo día.
 * Implementa prompt caching de Anthropic para reducir costes ~80%.
 * Si Claude falla, devuelve un plan de fallback generado por reglas.
 *
 * @param userId         - ID del usuario en la base de datos
 * @param onboardingData - Datos completos del onboarding del usuario
 * @param requestType    - 'plan_generation' | 'plan_regeneration'
 * @param extraContext   - Contexto extra para regeneraciones
 * @returns Plan completo listo para guardar en la DB
 */
export async function generatePlan(
  userId: string,
  onboardingData: OnboardingData,
  requestType: 'plan_generation' | 'plan_regeneration' = 'plan_generation',
  extraContext?: string,
): Promise<GeneratedPlan> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Comprobar caché Redis primero (solo para generaciones nuevas, no regeneraciones)
  if (requestType === 'plan_generation') {
    const cached = await getCachedAiPlan<GeneratedPlan>(userId, today);
    if (cached) {
      console.info(`[AI] Plan encontrado en caché para usuario ${userId} (${today})`);
      return cached;
    }
  }

  // Calcular métricas metabólicas antes de llamar a Claude (AI-02)
  const metrics = calculateMetabolism(onboardingData.physical);

  try {
    const client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    const userContextPrompt = buildUserContextPrompt(onboardingData, metrics, extraContext);

    // Llamada a Claude con prompt caching en el system prompt (AI-05)
    // El system prompt se cachea hasta 5 minutos (ephemeral).
    // El contexto del usuario NO se cachea porque varía por usuario.
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              // @ts-expect-error — cache_control es una extensión de Anthropic SDK
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: userContextPrompt,
            },
          ],
        },
      ],
    });

    // Registrar uso de tokens (AI-07)
    const tokenLog = buildTokenUsageLog(userId, requestType, MODEL, response.usage);
    logTokenUsage(tokenLog);

    // Extraer y parsear el JSON de la respuesta
    const rawContent = response.content[0];
    if (rawContent.type !== 'text') {
      throw new Error('[AI] Claude devolvió contenido inesperado (no texto).');
    }

    const jsonText = extractJson(rawContent.text);
    const parsed = JSON.parse(jsonText) as Omit<GeneratedPlan, 'generated_by_ai' | 'metabolism_metrics'>;

    const plan: GeneratedPlan = {
      ...parsed,
      generated_by_ai: true,
      metabolism_metrics: metrics,
      generated_at: new Date().toISOString(),
      model_version: MODEL,
    };

    // Guardar en caché Redis
    await cacheAiPlan(userId, today, plan);

    console.info(`[AI] Plan generado y cacheado para usuario ${userId}`);
    return plan;

  } catch (error) {
    console.error('[AI] Error al generar plan con Claude:', error);

    // AI-06: Fallback automático si Claude falla
    console.warn('[AI] Activando plan de fallback por error en Claude API.');
    const fallbackPlan = generateFallbackPlan(onboardingData);

    // Cachear el fallback también (con mismo TTL de 24h)
    await cacheAiPlan(userId, today, fallbackPlan);

    return fallbackPlan;
  }
}

// ─────────────────────────────────────────────────────────────
// DETECCIÓN DE ESTANCAMIENTO (AI-04)
// ─────────────────────────────────────────────────────────────

/**
 * Determina si el usuario lleva más de 2 semanas sin cambio de peso significativo.
 * Se considera estancamiento cuando el rango de variación ≤ 0.5 kg durante 14+ días
 * y hay al menos 4 registros en ese período.
 *
 * @param progressLogs - Registros de progreso del usuario ordenados por fecha
 * @returns true si se detecta estancamiento, false en caso contrario
 */
export function shouldRegeneratePlan(progressLogs: ProgressLog[]): boolean {
  if (!progressLogs || progressLogs.length < 4) {
    return false;
  }

  // Ordenar por fecha descendente (más reciente primero)
  const sortedLogs = [...progressLogs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
  );

  const mostRecentDate = new Date(sortedLogs[0].log_date);
  const twoWeeksAgo = new Date(mostRecentDate);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Filtrar registros de las últimas 2 semanas con peso registrado
  const recentLogs = sortedLogs.filter(log => {
    const logDate = new Date(log.log_date);
    return logDate >= twoWeeksAgo && log.weight_kg !== null;
  });

  if (recentLogs.length < 4) {
    return false;
  }

  const weights = recentLogs.map(log => log.weight_kg as number);
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const weightRange = maxWeight - minWeight;

  // Estancamiento si el rango de variación es ≤ 0.5 kg
  return weightRange <= 0.5;
}

// ─────────────────────────────────────────────────────────────
// REGENERACIÓN POR ESTANCAMIENTO (AI-04)
// ─────────────────────────────────────────────────────────────

/**
 * Regenera el plan del usuario con contexto adicional sobre el estancamiento.
 * Claude recibirá información de por qué se está regenerando y qué ajustes hacer.
 *
 * @param userId         - ID del usuario
 * @param onboardingData - Datos actuales del onboarding del usuario
 * @param reason         - Razón de la regeneración
 * @param progressLogs   - Logs de progreso para calcular el contexto de estancamiento
 * @returns Plan regenerado
 */
export async function regeneratePlan(
  userId: string,
  onboardingData: OnboardingData,
  reason: RegenerationReason,
  progressLogs?: ProgressLog[],
): Promise<GeneratedPlan> {
  let extraContext = buildRegenerationContext(reason, progressLogs);

  return generatePlan(userId, onboardingData, 'plan_regeneration', extraContext);
}

// ─────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

/**
 * Extrae el JSON de la respuesta de Claude.
 * Claude puede devolver el JSON dentro de un bloque de código ```json ... ```
 * o directamente como texto plano.
 */
function extractJson(text: string): string {
  // Intentar extraer de bloque ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Intentar extraer el JSON directamente buscando { ... }
  const jsonMatch = text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  // Devolver el texto tal cual y dejar que JSON.parse falle con un mensaje útil
  return text.trim();
}

/**
 * Construye el contexto adicional para regeneraciones de plan.
 * Se inyecta en el prompt para que Claude sepa por qué se está regenerando.
 */
function buildRegenerationContext(reason: RegenerationReason, progressLogs?: ProgressLog[]): string {
  const contextLines: string[] = ['⚠️ REGENERACIÓN DE PLAN — Este es un plan actualizado por las siguientes razones:'];

  switch (reason) {
    case 'weight_plateau':
      contextLines.push('');
      contextLines.push('El usuario lleva más de 2 semanas sin cambio de peso significativo (variación ≤ 0.5 kg).');
      contextLines.push('');
      contextLines.push('AJUSTES NECESARIOS:');
      contextLines.push('1. Modifica el déficit/superávit calórico en ±100-150 kcal respecto al plan anterior.');
      contextLines.push('2. Introduce variación en los tipos de entrenamiento (ej: más HIIT si había mucho cardio moderado).');
      contextLines.push('3. Reorganiza los días de entrenamiento para cambiar el estímulo muscular.');
      contextLines.push('4. Considera ciclar los carbohidratos si el objetivo es perder peso.');

      if (progressLogs?.length) {
        const withWeight = progressLogs.filter(l => l.weight_kg !== null);
        if (withWeight.length >= 2) {
          const sorted = [...withWeight].sort(
            (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime(),
          );
          const latest = sorted[0].weight_kg;
          const oldest = sorted[sorted.length - 1].weight_kg;
          contextLines.push('');
          contextLines.push(`Datos de progreso recientes:`);
          contextLines.push(`- Peso más reciente: ${latest} kg (${sorted[0].log_date})`);
          contextLines.push(`- Peso hace 2+ semanas: ${oldest} kg (${sorted[sorted.length - 1].log_date})`);
          contextLines.push(`- Variación total: ${Math.abs((latest as number) - (oldest as number)).toFixed(2)} kg`);
        }
      }
      break;

    case 'goal_change':
      contextLines.push('');
      contextLines.push('El usuario ha cambiado su objetivo principal.');
      contextLines.push('Genera un plan completamente adaptado al NUEVO objetivo indicado en los datos del usuario.');
      break;

    case 'injury':
      contextLines.push('');
      contextLines.push('El usuario ha reportado una nueva lesión o limitación física.');
      contextLines.push('Adapta el plan de entrenamiento respetando ESTRICTAMENTE la nueva limitación indicada.');
      contextLines.push('Prioriza ejercicios alternativos que no comprometan la zona afectada.');
      break;

    case 'manual_request':
      contextLines.push('');
      contextLines.push('El usuario ha solicitado manualmente una actualización de su plan.');
      contextLines.push('Genera un plan con variaciones respecto al anterior para mantener la motivación y el progreso.');
      break;
  }

  return contextLines.join('\n');
}
