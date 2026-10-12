/**
 * Constructor del prompt para generación de planes de salud personalizados.
 * Separa el contenido estático (cacheable) del dinámico (por usuario).
 */

// Prompt del sistema: estático y cacheable con prompt caching de Claude API
const SYSTEM_PROMPT = `Eres un experto en nutrición deportiva y entrenamiento personal certificado.
Tu misión es generar planes de salud completamente personalizados que combinen nutrición y entrenamiento.

## Principios de diseño del plan

### Nutrición
- Respeta estrictamente los macronutrientes calculados (calorías, proteínas, carbohidratos y grasas)
- Distribuye las comidas de forma práctica según el horario y preferencias del usuario
- Prioriza alimentos locales, económicos y fáciles de preparar
- Adapta la dieta a restricciones, alergias e intolerancias
- Sugiere alternativas cuando un alimento no esté disponible

### Entrenamiento
- Diseña sesiones adecuadas al nivel de experiencia
- Respeta los días disponibles y la duración máxima de sesión
- Adapta los ejercicios al equipamiento disponible (gimnasio o casa)
- Incluye calentamiento, trabajo principal y vuelta a la calma
- Evita ejercicios que afecten a lesiones o condiciones de salud

### Progresión
- Diseña el plan para 4 semanas con progresión gradual
- Aumenta la dificultad de forma segura y sostenible
- Incluye días de descanso activo

## Formato de respuesta OBLIGATORIO

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:

\`\`\`json
{
  "nutrition": {
    "daily_calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "meals": [
      {
        "meal_type": "breakfast|lunch|dinner|snack",
        "name": string,
        "time_suggestion": string,
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "foods": [
          {
            "name": string,
            "quantity_g": number,
            "preparation": string
          }
        ]
      }
    ],
    "hydration_ml": number,
    "guidelines": [string]
  },
  "training": {
    "sessions_per_week": number,
    "schedule": [
      {
        "day_of_week": string,
        "session_type": string,
        "focus": string,
        "duration_minutes": number,
        "exercises": [
          {
            "name": string,
            "muscle_group": string,
            "sets": number,
            "reps": string,
            "weight_suggestion": string,
            "rest_seconds": number,
            "notes": string
          }
        ]
      }
    ],
    "guidelines": [string]
  },
  "weekly_goals": [string],
  "recommendations": [string],
  "warnings": [string]
}
\`\`\`

No incluyas texto antes ni después del JSON. No uses markdown excepto el bloque de código json.`;

/**
 * Genera el mensaje de usuario con todos los datos del perfil.
 * Este contenido varía por usuario y no debe cachearse.
 *
 * @param {Object} userData - Todos los datos del usuario
 * @param {Object} nutritionTargets - TMB, TDEE y macros calculados
 * @returns {string} Mensaje con el perfil completo del usuario
 */
function buildUserMessage(userData, nutritionTargets) {
  const {
    profile,
    lifestyleProfile,
    trainingPreferences,
    healthConditions,
    nutritionPreferences,
    foodRestrictions,
    motivationProfile,
    recentProgress,
    recentDailyLogs,
  } = userData;

  const { bmr, tdee, macros } = nutritionTargets;

  // Datos básicos del perfil
  const profileSection = `## Datos físicos del usuario
- Peso: ${profile.weight_kg} kg
- Altura: ${profile.height_cm} cm
- Género: ${profile.gender}
- Edad: ${profile.age} años
- Complexión: ${profile.body_type}
- Nivel de actividad: ${profile.activity_level}
- Objetivo principal: ${profile.goal}`;

  // Cálculos nutricionales
  const nutritionCalcSection = `## Cálculos nutricionales (Mifflin-St Jeor)
- TMB (Tasa Metabólica Basal): ${bmr} kcal/día
- TDEE (Gasto Energético Total): ${tdee} kcal/día
- Calorías objetivo: ${macros.calories} kcal/día
- Proteínas objetivo: ${macros.protein_g} g/día
- Carbohidratos objetivo: ${macros.carbs_g} g/día
- Grasas objetivo: ${macros.fat_g} g/día`;

  // Estilo de vida
  const lifestyleSection = lifestyleProfile ? `## Estilo de vida
- Profesión: ${lifestyleProfile.profession || 'No especificada'}
- Tipo de trabajo: ${lifestyleProfile.work_type}
- Horas de trabajo al día: ${lifestyleProfile.work_hours_per_day}
- Nivel de estrés (1-5): ${lifestyleProfile.stress_level}
- Horario habitual: ${lifestyleProfile.usual_schedule}
- Horas de sueño habituales: ${lifestyleProfile.sleep_hours_usual}
- Calidad del sueño: ${lifestyleProfile.sleep_quality}
- Consumo de alcohol: ${lifestyleProfile.alcohol_consumption}
- Fumador: ${lifestyleProfile.smoker ? 'Sí' : 'No'}
- Vasos de agua al día: ${lifestyleProfile.daily_water_glasses}` : '';

  // Preferencias de entrenamiento
  const trainingSection = trainingPreferences ? `## Preferencias de entrenamiento
- Días disponibles por semana: ${trainingPreferences.available_days_per_week}
- Duración máxima de sesión: ${trainingPreferences.max_session_duration_minutes} minutos
- Horario preferido: ${trainingPreferences.preferred_training_time}
- Acceso a gimnasio: ${trainingPreferences.has_gym_access ? 'Sí' : 'No'}
- Equipamiento en casa: ${trainingPreferences.home_equipment}
- Nivel de experiencia: ${trainingPreferences.experience_level}
- Lesiones o limitaciones: ${trainingPreferences.injuries_or_limitations || 'Ninguna'}` : '';

  // Condiciones de salud
  const healthSection = healthConditions && healthConditions.length > 0
    ? `## Condiciones de salud
${healthConditions.map(c =>
    `- ${c.condition_name} (${c.condition_type}): afecta entrenamiento=${c.affects_training}, afecta nutrición=${c.affects_nutrition}. ${c.notes || ''}`
  ).join('\n')}`
    : '## Condiciones de salud\n- Sin condiciones relevantes reportadas';

  // Preferencias nutricionales
  const nutritionPrefSection = nutritionPreferences ? `## Preferencias nutricionales
- Tipo de dieta: ${nutritionPreferences.diet_type}
- Comidas al día preferidas: ${nutritionPreferences.meals_per_day_preferred}
- Cocina en casa: ${nutritionPreferences.cooks_at_home ? 'Sí' : 'No'}
- Frecuencia de comer fuera: ${nutritionPreferences.eats_out_frequency}
- Presupuesto mensual en comida: ${nutritionPreferences.monthly_food_budget_range}` : '';

  // Restricciones alimentarias
  const restrictionsSection = foodRestrictions && foodRestrictions.length > 0
    ? `## Restricciones alimentarias
${foodRestrictions.map(r =>
    `- ${r.food_name}: ${r.restriction_type} (severidad: ${r.severity})`
  ).join('\n')}`
    : '## Restricciones alimentarias\n- Sin restricciones reportadas';

  // Motivación
  const motivationSection = motivationProfile ? `## Perfil de motivación
- Motivación principal: ${motivationProfile.main_motivation}
- Intentos previos: ${motivationProfile.previous_attempts ? 'Sí - ' + (motivationProfile.previous_attempts_notes || '') : 'No'}
- Preferencia de seguimiento: ${motivationProfile.tracking_preference}
- Red de apoyo: ${motivationProfile.has_support_network ? 'Sí' : 'No'}` : '';

  // Progreso reciente (últimas 2 semanas)
  const progressSection = recentProgress && recentProgress.length > 0
    ? `## Progreso reciente (últimas 2 semanas)
${recentProgress.slice(0, 5).map(p =>
    `- ${p.log_date}: ${p.weight_kg ? `${p.weight_kg}kg` : ''} ${p.body_fat_percentage ? `${p.body_fat_percentage}% grasa` : ''} ${p.waist_cm ? `cintura ${p.waist_cm}cm` : ''}`
  ).join('\n')}`
    : '';

  // Logs diarios recientes (últimos 7 días)
  const dailyLogsSection = recentDailyLogs && recentDailyLogs.length > 0
    ? `## Bienestar reciente (últimos 7 días)
${recentDailyLogs.slice(0, 7).map(l =>
    `- ${l.log_date}: energía=${l.energy_level}/5, humor=${l.mood}/5, sueño=${l.sleep_hours}h (calidad ${l.sleep_quality}/5), pasos=${l.steps || 0}`
  ).join('\n')}`
    : '';

  const sections = [
    profileSection,
    nutritionCalcSection,
    lifestyleSection,
    trainingSection,
    healthSection,
    nutritionPrefSection,
    restrictionsSection,
    motivationSection,
    progressSection,
    dailyLogsSection,
  ].filter(Boolean);

  return `Genera un plan de salud personalizado completo para este usuario:\n\n${sections.join('\n\n')}`;
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };
