'use strict';

/**
 * Tests unitarios para calculations.util.js
 * Cubre: calculateTMB, calculateTDEE, calculateTargetCalories, calculateMacros, calculateNutritionPlan
 */

const {
  calculateTMB,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacros,
  calculateNutritionPlan,
  ACTIVITY_MULTIPLIERS,
  GOAL_MULTIPLIERS,
  MIN_CALORIES,
} = require('../../backend/src/utils/calculations.util');

// ─── calculateTMB ─────────────────────────────────────────────────────────────

describe('calculateTMB', () => {
  test('calcula TMB correctamente para hombre', () => {
    // 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 → 1749
    const result = calculateTMB({ weight: 80, height: 175, age: 30, sex: 'male' });
    expect(result).toBe(1749);
  });

  test('calcula TMB correctamente para mujer', () => {
    // 10*65 + 6.25*162 - 5*28 - 161 = 650 + 1012.5 - 140 - 161 = 1361.5 → 1362
    const result = calculateTMB({ weight: 65, height: 162, age: 28, sex: 'female' });
    expect(result).toBe(1362);
  });

  test('lanza error si el peso es 0', () => {
    expect(() => calculateTMB({ weight: 0, height: 175, age: 30, sex: 'male' }))
      .toThrow('El peso debe ser un número positivo');
  });

  test('lanza error si el peso es negativo', () => {
    expect(() => calculateTMB({ weight: -10, height: 175, age: 30, sex: 'male' }))
      .toThrow('El peso debe ser un número positivo');
  });

  test('lanza error si la altura es 0', () => {
    expect(() => calculateTMB({ weight: 70, height: 0, age: 30, sex: 'male' }))
      .toThrow('La altura debe ser un número positivo');
  });

  test('lanza error si la edad es 0', () => {
    expect(() => calculateTMB({ weight: 70, height: 175, age: 0, sex: 'male' }))
      .toThrow('La edad debe ser un número positivo');
  });

  test('lanza error si el sexo es inválido', () => {
    expect(() => calculateTMB({ weight: 70, height: 175, age: 30, sex: 'other' }))
      .toThrow('El sexo debe ser "male" o "female"');
  });

  test('devuelve un entero redondeado', () => {
    const result = calculateTMB({ weight: 73, height: 180, age: 35, sex: 'male' });
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ─── calculateTDEE ────────────────────────────────────────────────────────────

describe('calculateTDEE', () => {
  test('calcula TDEE para nivel sedentario', () => {
    const tmb = 1750;
    const result = calculateTDEE(tmb, 'sedentary');
    expect(result).toBe(Math.round(1750 * ACTIVITY_MULTIPLIERS.sedentary));
  });

  test('calcula TDEE para nivel moderate', () => {
    const result = calculateTDEE(1750, 'moderate');
    expect(result).toBe(Math.round(1750 * 1.55));
  });

  test('calcula TDEE para nivel very_active', () => {
    const result = calculateTDEE(1800, 'very_active');
    expect(result).toBe(Math.round(1800 * 1.9));
  });

  test('lanza error para nivel de actividad inválido', () => {
    expect(() => calculateTDEE(1750, 'super_active'))
      .toThrow('Nivel de actividad inválido: "super_active"');
  });

  test('devuelve un entero redondeado', () => {
    const result = calculateTDEE(1600, 'light');
    expect(Number.isInteger(result)).toBe(true);
  });

  test('todos los niveles de actividad son válidos', () => {
    Object.keys(ACTIVITY_MULTIPLIERS).forEach(level => {
      expect(() => calculateTDEE(1700, level)).not.toThrow();
    });
  });
});

// ─── calculateTargetCalories ──────────────────────────────────────────────────

describe('calculateTargetCalories', () => {
  test('aplica multiplicador para lose_weight', () => {
    const tdee = 2500;
    const result = calculateTargetCalories(tdee, 'lose_weight', 'male');
    expect(result).toBe(Math.round(2500 * 0.80));
  });

  test('aplica multiplicador para gain_muscle', () => {
    const result = calculateTargetCalories(2500, 'gain_muscle', 'male');
    expect(result).toBe(Math.round(2500 * 1.10));
  });

  test('aplica mínimo de seguridad para hombres', () => {
    // Con TDEE muy bajo el resultado debe ser al menos 1500 kcal
    const result = calculateTargetCalories(1000, 'lose_weight', 'male');
    expect(result).toBeGreaterThanOrEqual(MIN_CALORIES.male);
  });

  test('aplica mínimo de seguridad para mujeres', () => {
    const result = calculateTargetCalories(1000, 'lose_weight', 'female');
    expect(result).toBeGreaterThanOrEqual(MIN_CALORIES.female);
  });

  test('lanza error para objetivo inválido', () => {
    expect(() => calculateTargetCalories(2000, 'bulk', 'male'))
      .toThrow('Objetivo inválido: "bulk"');
  });

  test('todos los objetivos válidos funcionan sin error', () => {
    Object.keys(GOAL_MULTIPLIERS).forEach(goal => {
      expect(() => calculateTargetCalories(2000, goal, 'female')).not.toThrow();
    });
  });
});

// ─── calculateMacros ──────────────────────────────────────────────────────────

describe('calculateMacros', () => {
  test('calcula macros para lose_weight', () => {
    const result = calculateMacros({ targetCalories: 2000, weight: 80, goal: 'lose_weight' });
    expect(result).toHaveProperty('protein');
    expect(result).toHaveProperty('fat');
    expect(result).toHaveProperty('carbs');
    expect(result.protein).toBe(Math.round(2.0 * 80)); // 160g
  });

  test('la proteína es mayor en gain_muscle', () => {
    const lose = calculateMacros({ targetCalories: 2000, weight: 80, goal: 'lose_weight' });
    const gain = calculateMacros({ targetCalories: 2000, weight: 80, goal: 'gain_muscle' });
    expect(gain.protein).toBeGreaterThan(lose.protein);
  });

  test('todos los macros son enteros no negativos', () => {
    const result = calculateMacros({ targetCalories: 1800, weight: 70, goal: 'general_health' });
    expect(Number.isInteger(result.protein)).toBe(true);
    expect(Number.isInteger(result.fat)).toBe(true);
    expect(Number.isInteger(result.carbs)).toBe(true);
    expect(result.protein).toBeGreaterThanOrEqual(0);
    expect(result.fat).toBeGreaterThanOrEqual(0);
    expect(result.carbs).toBeGreaterThanOrEqual(0);
  });

  test('lanza error si targetCalories es 0', () => {
    expect(() => calculateMacros({ targetCalories: 0, weight: 80, goal: 'lose_weight' }))
      .toThrow('Las calorías objetivo deben ser un número positivo');
  });

  test('lanza error si weight es 0', () => {
    expect(() => calculateMacros({ targetCalories: 2000, weight: 0, goal: 'lose_weight' }))
      .toThrow('El peso debe ser un número positivo');
  });

  test('lanza error si goal es inválido', () => {
    expect(() => calculateMacros({ targetCalories: 2000, weight: 80, goal: 'unknown' }))
      .toThrow('Objetivo inválido: "unknown"');
  });
});

// ─── calculateNutritionPlan ───────────────────────────────────────────────────

describe('calculateNutritionPlan', () => {
  const baseProfile = {
    weight: 80,
    height: 175,
    age: 30,
    sex: 'male',
    activityLevel: 'moderate',
    goal: 'lose_weight',
  };

  test('devuelve las 4 propiedades esperadas', () => {
    const result = calculateNutritionPlan(baseProfile);
    expect(result).toHaveProperty('tmb');
    expect(result).toHaveProperty('tdee');
    expect(result).toHaveProperty('targetCalories');
    expect(result).toHaveProperty('macros');
  });

  test('el orden es tmb < tdee y targetCalories <= tdee para lose_weight', () => {
    const result = calculateNutritionPlan(baseProfile);
    expect(result.tmb).toBeLessThan(result.tdee);
    expect(result.targetCalories).toBeLessThanOrEqual(result.tdee);
  });

  test('funciona para perfil femenino de mantenimiento', () => {
    const profile = { weight: 60, height: 160, age: 25, sex: 'female', activityLevel: 'light', goal: 'maintenance' };
    const result = calculateNutritionPlan(profile);
    expect(result.targetCalories).toBeGreaterThanOrEqual(MIN_CALORIES.female);
  });

  test('hereda errores de subfunciones', () => {
    expect(() => calculateNutritionPlan({ ...baseProfile, weight: -1 }))
      .toThrow('El peso debe ser un número positivo');
  });
});
