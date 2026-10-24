/**
 * Salvaguardas clínicas conservadoras (SEC-37 / JB-05, parte de SEC-29 / JB-02).
 *
 * ⚠️ Todos los umbrales de este archivo están PENDIENTES DE VALIDACIÓN CLÍNICA
 * POR ANTONIO (decisión de producto con asesoramiento profesional). Los valores
 * actuales son deliberadamente conservadores.
 *
 * Las reglas se aplican en el SERVIDOR sobre el cálculo y sobre la salida del
 * LLM: el prompt también las menciona, pero el prompt no es un control.
 */

'use strict';

// ── Umbrales (pendiente de validación clínica por Antonio) ──────────────────
/** Mínimo de kcal/día por sexo. `other`/desconocido usa el valor más alto. */
const MIN_KCAL = Object.freeze({ female: 1200, male: 1500, other: 1500 });
/** Déficit máximo respecto al TDEE (0.20 = 20 %). */
const MAX_DEFICIT_RATIO = 0.20;
/** IMC por debajo del cual no se permite perder peso. */
const UNDERWEIGHT_BMI = 18.5;
/** Edad por debajo de la cual no se permite déficit calórico. */
const ADULT_AGE = 18;
/** Desviación máxima tolerada entre lo que propone el LLM y el objetivo del servidor. */
const MAX_KCAL_DEVIATION = 0.15;
/** Superávit para ganar músculo (0.10 = +10 % sobre el TDEE). */
const SURPLUS_RATIO = 0.10;

const MEDICAL_NOTICE = 'Has indicado condiciones de salud: valida este plan con tu médico antes de empezar.';
const SPECIALIST_NOTICE = 'Por tu edad o tu IMC no se plantea déficit calórico. Consulta con un profesional sanitario antes de cambiar tu alimentación.';
const GENERAL_NOTICE = 'Plan orientativo: no sustituye el consejo de un profesional de la salud.';

/** IMC con peso en kg y altura en cm (null si no es calculable). */
function computeBmi(weightKg, heightCm) {
  const w = Number(weightKg);
  const h = Number(heightCm) / 100;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return Math.round((w / (h * h)) * 10) / 10;
}

/** Mínimo de kcal para el perfil: máx(TMB, mínimo por sexo). */
function minimumCalories(physical, bmr) {
  const bySex = MIN_KCAL[physical && physical.gender] || MIN_KCAL.other;
  return Math.max(bySex, Math.round(Number(bmr) || 0));
}

/**
 * Aplica las salvaguardas al objetivo calórico.
 * @param {{ bmr: number, tdee: number }} base
 * @param {{ age: number, weight_kg: number, height_cm: number, gender: string, goal: string }} physical
 * @returns {{ target_calories: number, min_calories: number, bmi: number|null, effective_goal: string, flags: string[] }}
 */
function safeCalorieTarget(base, physical) {
  const flags = [];
  const bmi = computeBmi(physical.weight_kg, physical.height_cm);
  const minKcal = minimumCalories(physical, base.bmr);
  let goal = physical.goal || 'general_health';

  const age = Number(physical.age);
  if (goal === 'lose_weight' && ((Number.isFinite(age) && age < ADULT_AGE) || (bmi !== null && bmi < UNDERWEIGHT_BMI))) {
    goal = 'maintain';
    flags.push('weight_loss_blocked');
  }

  let target;
  switch (goal) {
    case 'lose_weight':
      target = Math.round(base.tdee * (1 - MAX_DEFICIT_RATIO));
      break;
    case 'gain_muscle':
      target = Math.round(base.tdee * (1 + SURPLUS_RATIO));
      break;
    default:
      target = base.tdee;
  }
  if (target < minKcal) {
    target = minKcal;
    flags.push('min_calories_applied');
  }
  return { target_calories: target, min_calories: minKcal, bmi, effective_goal: goal, flags };
}

/** Kcal aproximadas de unos macros. */
const macroKcal = (m) => 4 * (Number(m.protein_g) || 0) + 4 * (Number(m.carbs_g) || 0) + 9 * (Number(m.fat_g) || 0);

/**
 * Aplica las salvaguardas a un plan YA validado por esquema (mutación sobre copia).
 * - daily_calories = objetivo del servidor (el servidor manda).
 * - macros recalculados si su energía se desvía > MAX_KCAL_DEVIATION.
 * - avisos en `notes` si hay condiciones médicas, menores o IMC bajo.
 *
 * @param {object} plan
 * @param {{ metrics: object, physical: object, conditions?: Array, calculateMacros: Function }} ctx
 * @returns {{ plan: object, warnings: string[] }}
 */
function applyOutputGuardrails(plan, ctx) {
  const warnings = [];
  const out = { ...plan, nutrition_plan: { ...plan.nutrition_plan } };
  const target = ctx.metrics.target_calories;
  const np = out.nutrition_plan;

  const proposed = Number(np.daily_calories);
  if (!Number.isFinite(proposed) || Math.abs(proposed - target) > target * MAX_KCAL_DEVIATION) {
    warnings.push('daily_calories_overridden');
  }
  np.daily_calories = target;

  const macros = np.macros || {};
  const kcal = macroKcal(macros);
  if (!kcal || Math.abs(kcal - target) > target * MAX_KCAL_DEVIATION) {
    np.macros = ctx.calculateMacros(target, ctx.metrics.effective_goal || ctx.physical.goal);
    warnings.push('macros_recalculated');
  }

  const notices = [];
  if (Array.isArray(ctx.conditions) && ctx.conditions.length > 0) notices.push(MEDICAL_NOTICE);
  if ((ctx.metrics.flags || []).includes('weight_loss_blocked')) notices.push(SPECIALIST_NOTICE);
  notices.push(GENERAL_NOTICE);
  const baseNotes = typeof out.notes === 'string' ? out.notes : '';
  const missing = notices.filter((n) => !baseNotes.includes(n));
  out.notes = [baseNotes, ...missing].filter(Boolean).join(' ').slice(0, 1500);
  out.clinical_flags = [...new Set([...(ctx.metrics.flags || []), ...warnings])];
  return { plan: out, warnings };
}

module.exports = {
  MIN_KCAL,
  MAX_DEFICIT_RATIO,
  SURPLUS_RATIO,
  UNDERWEIGHT_BMI,
  ADULT_AGE,
  MAX_KCAL_DEVIATION,
  MEDICAL_NOTICE,
  SPECIALIST_NOTICE,
  GENERAL_NOTICE,
  computeBmi,
  minimumCalories,
  safeCalorieTarget,
  applyOutputGuardrails,
};
