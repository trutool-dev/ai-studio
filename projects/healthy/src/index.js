/**
 * Punto de entrada del agente IA de Healthy.
 * Exporta los servicios principales para su uso desde el backend.
 */

const {
  generatePlan,
  regeneratePlan,
  analyzeProgressAndAdjust,
  getUserData,
} = require('./services/planGeneratorService');

const {
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
} = require('./utils/nutritionCalculator');

module.exports = {
  // Servicio principal de generación de planes
  generatePlan,
  regeneratePlan,
  analyzeProgressAndAdjust,
  getUserData,

  // Utilidades de cálculo nutricional (usables de forma independiente)
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
};
