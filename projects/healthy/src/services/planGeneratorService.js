require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { anthropic, MODEL, MAX_TOKENS } = require('../config/anthropic');
const { calculateNutritionTargets, calculateAge } = require('../utils/nutritionCalculator');
const { SYSTEM_PROMPT, buildUserMessage } = require('../prompts/planPromptBuilder');
const { cachePlan, getCachedPlan, invalidatePlanCache } = require('./cacheService');

const prisma = new PrismaClient();

/**
 * Obtiene todos los datos del usuario necesarios para generar el plan.
 * Incluye perfil, estilo de vida, entrenamiento, salud, nutrición y progreso.
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Todos los datos del usuario
 */
async function getUserData(userId) {
  const [
    profile,
    lifestyleProfile,
    trainingPreferences,
    healthConditions,
    nutritionPreferences,
    foodRestrictions,
    motivationProfile,
    recentProgress,
    recentDailyLogs,
  ] = await Promise.all([
    // Perfil físico principal
    prisma.profiles.findUnique({
      where: { user_id: userId },
    }),
    // Estilo de vida y hábitos
    prisma.lifestyleProfiles.findUnique({
      where: { user_id: userId },
    }),
    // Preferencias de entrenamiento
    prisma.trainingPreferences.findUnique({
      where: { user_id: userId },
    }),
    // Condiciones de salud que afectan el plan
    prisma.healthConditions.findMany({
      where: { user_id: userId },
    }),
    // Preferencias nutricionales
    prisma.nutritionPreferences.findUnique({
      where: { user_id: userId },
    }),
    // Restricciones y alergias alimentarias
    prisma.foodRestrictions.findMany({
      where: { user_id: userId },
    }),
    // Perfil de motivación
    prisma.motivationProfiles.findUnique({
      where: { user_id: userId },
    }),
    // Últimos 14 registros de progreso físico
    prisma.progressLogs.findMany({
      where: { user_id: userId },
      orderBy: { log_date: 'desc' },
      take: 14,
    }),
    // Últimos 7 logs diarios de bienestar
    prisma.dailyLogs.findMany({
      where: { user_id: userId },
      orderBy: { log_date: 'desc' },
      take: 7,
    }),
  ]);

  if (!profile) {
    throw new Error(`Perfil no encontrado para el usuario ${userId}`);
  }

  // Añadir edad calculada al perfil para usarla en el prompt
  const profileWithAge = {
    ...profile,
    age: calculateAge(profile.birthdate),
  };

  return {
    profile: profileWithAge,
    lifestyleProfile,
    trainingPreferences,
    healthConditions,
    nutritionPreferences,
    foodRestrictions,
    motivationProfile,
    recentProgress,
    recentDailyLogs,
  };
}

/**
 * Llama a Claude API con streaming para generar el plan personalizado.
 * Usa prompt caching en el system prompt y adaptive thinking.
 *
 * @param {string} userMessage - Mensaje con los datos del usuario
 * @returns {Promise<{ content: string, usage: Object }>} Respuesta de Claude
 */
async function callClaudeAPI(userMessage) {
  // Streaming con finalMessage() para manejar respuestas largas sin timeout
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Prompt caching en el system prompt (contenido estable, TTL 5 min)
    // Ahorra ~90% del coste en llamadas repetidas al mismo endpoint
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  });

  const message = await stream.finalMessage();

  // Extraer el texto de la respuesta
  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('Claude no devolvió contenido de texto en la respuesta');
  }

  return {
    content: textBlock.text,
    usage: message.usage,
    stopReason: message.stop_reason,
  };
}

/**
 * Parsea la respuesta JSON de Claude, eliminando posibles bloques de código markdown.
 *
 * @param {string} rawContent - Contenido en texto de la respuesta
 * @returns {Object} Plan parseado
 */
function parsePlanResponse(rawContent) {
  // Eliminar bloque de código markdown si Claude lo incluye
  let jsonText = rawContent.trim();
  const jsonBlockMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    jsonText = jsonBlockMatch[1];
  }

  try {
    const plan = JSON.parse(jsonText);

    // Validación mínima de estructura
    if (!plan.nutrition || !plan.training) {
      throw new Error('El plan no contiene las secciones requeridas (nutrition, training)');
    }

    return plan;
  } catch (err) {
    throw new Error(`Error al parsear la respuesta de Claude: ${err.message}`);
  }
}

/**
 * Guarda el plan generado en la base de datos.
 *
 * @param {string} userId - ID del usuario
 * @param {Object} plan - Plan parseado
 * @param {Object} nutritionTargets - Datos nutricionales calculados
 * @param {string} promptUsed - Prompt enviado a Claude (para auditoría)
 * @returns {Promise<Object>} Plan guardado en BD
 */
async function savePlan(userId, plan, nutritionTargets, promptUsed) {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + 28); // Plan de 4 semanas

  // Transacción: crear plan y actualizar objetivos nutricionales del perfil
  return prisma.$transaction(async (tx) => {
    // Crear el plan principal
    const savedPlan = await tx.plans.create({
      data: {
        user_id: userId,
        type: 'combined',
        start_date: today,
        end_date: endDate,
        status: 'active',
        generated_by_ai: true,
        ai_prompt_used: promptUsed,
        ai_model_version: MODEL,
      },
    });

    // Actualizar los objetivos nutricionales en el perfil del usuario
    await tx.profiles.update({
      where: { user_id: userId },
      data: {
        daily_calories_target: nutritionTargets.macros.calories,
        daily_protein_target: nutritionTargets.macros.protein_g,
        daily_carbs_target: nutritionTargets.macros.carbs_g,
        daily_fat_target: nutritionTargets.macros.fat_g,
      },
    });

    return savedPlan;
  });
}

/**
 * Genera un plan de salud personalizado para un usuario.
 * Flujo: datos → cálculos → prompt → Claude API → parsear → cachear → guardar
 *
 * @param {string} userId - ID del usuario
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.forceRegenerate - Forzar regeneración ignorando caché
 * @returns {Promise<{ plan: Object, fromCache: boolean, usage?: Object }>}
 */
async function generatePlan(userId, { forceRegenerate = false } = {}) {
  // 1. Comprobar caché si no se fuerza regeneración
  if (!forceRegenerate) {
    const cached = await getCachedPlan(userId);
    if (cached) {
      return { plan: cached, fromCache: true };
    }
  }

  // 2. Obtener todos los datos del usuario
  const userData = await getUserData(userId);

  // 3. Calcular objetivos nutricionales (TMB, TDEE, macros)
  const nutritionTargets = calculateNutritionTargets(
    userData.profile,
    userData.profile.activity_level,
    userData.profile.goal,
  );

  // 4. Construir el mensaje de usuario con todos los datos
  const userMessage = buildUserMessage(userData, nutritionTargets);

  // 5. Llamar a Claude API con streaming y prompt caching
  const { content, usage, stopReason } = await callClaudeAPI(userMessage);

  // Validar que Claude terminó correctamente
  if (stopReason === 'max_tokens') {
    console.warn(`[PlanGenerator] Respuesta truncada por max_tokens para usuario ${userId}`);
  }

  // 6. Parsear la respuesta JSON
  const plan = parsePlanResponse(content);

  // Enriquecer el plan con los datos nutricionales calculados
  const enrichedPlan = {
    ...plan,
    nutrition_targets: nutritionTargets,
    generated_at: new Date().toISOString(),
    model_version: MODEL,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_input_tokens,
      cache_creation_tokens: usage.cache_creation_input_tokens,
    },
  };

  // 7. Cachear el plan (Redis)
  await cachePlan(userId, enrichedPlan);

  // 8. Guardar en base de datos (async, no bloqueante para el retorno)
  savePlan(userId, enrichedPlan, nutritionTargets, userMessage).catch((err) => {
    console.error(`[PlanGenerator] Error al guardar plan en BD para usuario ${userId}:`, err.message);
  });

  return { plan: enrichedPlan, fromCache: false, usage };
}

/**
 * Regenera el plan de un usuario invalidando el caché primero.
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<{ plan: Object, usage: Object }>}
 */
async function regeneratePlan(userId) {
  await invalidatePlanCache(userId);
  return generatePlan(userId, { forceRegenerate: true });
}

/**
 * Analiza el progreso semanal y ajusta el plan si es necesario.
 * Se llama automáticamente cada semana o cuando hay cambios significativos.
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<{ plan: Object, adjusted: boolean }>}
 */
async function analyzeProgressAndAdjust(userId) {
  // Obtener el plan activo y los logs recientes
  const [activePlan, recentLogs] = await Promise.all([
    prisma.plans.findFirst({
      where: { user_id: userId, status: 'active' },
      orderBy: { created_at: 'desc' },
    }),
    prisma.progressLogs.findMany({
      where: {
        user_id: userId,
        log_date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { log_date: 'desc' },
    }),
  ]);

  if (!activePlan || recentLogs.length < 2) {
    // No hay suficientes datos para evaluar progreso
    return { adjusted: false };
  }

  // Calcular variación de peso en las últimas 2 semanas
  const latestWeight = recentLogs[0].weight_kg;
  const oldestWeight = recentLogs[recentLogs.length - 1].weight_kg;

  if (!latestWeight || !oldestWeight) {
    return { adjusted: false };
  }

  const weightChange = latestWeight - oldestWeight;
  const profile = await prisma.profiles.findUnique({ where: { user_id: userId } });

  // Detectar si el progreso no está alineado con el objetivo
  const shouldAdjust = (
    (profile.goal === 'lose_weight' && weightChange >= 0) ||
    (profile.goal === 'gain_muscle' && weightChange <= 0)
  );

  if (shouldAdjust) {
    console.log(`[PlanGenerator] Ajustando plan para usuario ${userId} (cambio de peso: ${weightChange}kg)`);
    const result = await regeneratePlan(userId);
    return { ...result, adjusted: true };
  }

  return { adjusted: false };
}

module.exports = {
  generatePlan,
  regeneratePlan,
  analyzeProgressAndAdjust,
  getUserData,
};
