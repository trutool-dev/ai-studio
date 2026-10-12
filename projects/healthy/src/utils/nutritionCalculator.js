/**
 * Calculadora de nutrición basada en fórmulas científicas validadas.
 * Implementa Mifflin-St Jeor para TMB y distribución de macros según objetivo.
 */

// Multiplicadores de actividad según nivel (Harris-Benedict Activity Factor)
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,      // Trabajo de oficina, sin ejercicio
  light: 1.375,        // Ejercicio ligero 1-3 días/semana
  moderate: 1.55,      // Ejercicio moderado 3-5 días/semana
  active: 1.725,       // Ejercicio intenso 6-7 días/semana
  very_active: 1.9,    // Ejercicio muy intenso o trabajo físico + entrenamiento
};

/**
 * Calcula la edad a partir de la fecha de nacimiento.
 * @param {string|Date} birthdate - Fecha de nacimiento
 * @returns {number} Edad en años
 */
function calculateAge(birthdate) {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calcula la Tasa Metabólica Basal usando fórmula Mifflin-St Jeor.
 * Hombre: (10 × kg) + (6.25 × cm) - (5 × años) + 5
 * Mujer:  (10 × kg) + (6.25 × cm) - (5 × años) - 161
 *
 * @param {Object} profile - Datos del perfil del usuario
 * @param {number} profile.weight_kg - Peso en kilogramos
 * @param {number} profile.height_cm - Altura en centímetros
 * @param {string} profile.birthdate - Fecha de nacimiento
 * @param {string} profile.gender - Género ('male' | 'female')
 * @returns {number} TMB en kcal/día
 */
function calculateBMR(profile) {
  const { weight_kg, height_cm, birthdate, gender } = profile;
  const age = calculateAge(birthdate);

  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return gender === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

/**
 * Calcula el Gasto Energético Total Diario (TDEE).
 * TDEE = TMB × multiplicador de actividad
 *
 * @param {number} bmr - Tasa Metabólica Basal
 * @param {string} activityLevel - Nivel de actividad
 * @returns {number} TDEE en kcal/día
 */
function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? ACTIVITY_MULTIPLIERS.moderate;
  return Math.round(bmr * multiplier);
}

/**
 * Distribuye los macronutrientes según el objetivo del usuario.
 * - Perder peso:   déficit 20%, proteína alta (2.2g/kg)
 * - Ganar músculo: superávit 12%, proteína alta (2.2g/kg)
 * - Mantener:      mantenimiento, proteína moderada (1.8g/kg)
 * - Salud general: mantenimiento, proteína moderada (1.6g/kg)
 *
 * @param {number} tdee - Gasto energético total diario
 * @param {number} weightKg - Peso en kilogramos
 * @param {string} goal - Objetivo del usuario
 * @returns {{ calories: number, protein_g: number, carbs_g: number, fat_g: number }}
 */
function calculateMacros(tdee, weightKg, goal) {
  let targetCalories;
  let proteinG;
  let fatRatio;

  switch (goal) {
    case 'lose_weight':
      targetCalories = Math.round(tdee * 0.80); // déficit calórico del 20%
      proteinG = Math.round(weightKg * 2.2);     // alto en proteína para preservar músculo
      fatRatio = 0.25;
      break;
    case 'gain_muscle':
      targetCalories = Math.round(tdee * 1.12); // superávit calórico del 12%
      proteinG = Math.round(weightKg * 2.2);     // alto en proteína para síntesis muscular
      fatRatio = 0.25;
      break;
    case 'maintain':
      targetCalories = tdee;
      proteinG = Math.round(weightKg * 1.8);    // proteína moderada para mantenimiento
      fatRatio = 0.30;
      break;
    case 'general_health':
    default:
      targetCalories = tdee;
      proteinG = Math.round(weightKg * 1.6);    // proteína moderada para salud general
      fatRatio = 0.30;
      break;
  }

  // Calorías de proteína (4 kcal/g)
  const proteinCalories = proteinG * 4;
  // Calorías y gramos de grasa (9 kcal/g)
  const fatCalories = Math.round(targetCalories * fatRatio);
  const fatG = Math.round(fatCalories / 9);
  // Los carbohidratos cubren el resto (4 kcal/g)
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbG = Math.max(0, Math.round(carbCalories / 4));

  return {
    calories: targetCalories,
    protein_g: proteinG,
    carbs_g: carbG,
    fat_g: fatG,
  };
}

/**
 * Calcula todos los datos nutricionales de un usuario de una sola vez.
 *
 * @param {Object} profile - Perfil del usuario
 * @param {string} activityLevel - Nivel de actividad
 * @param {string} goal - Objetivo del usuario
 * @returns {{ bmr: number, tdee: number, macros: Object }}
 */
function calculateNutritionTargets(profile, activityLevel, goal) {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, activityLevel);
  const macros = calculateMacros(tdee, profile.weight_kg, goal);

  return { bmr, tdee, macros };
}

module.exports = {
  calculateAge,
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
};
