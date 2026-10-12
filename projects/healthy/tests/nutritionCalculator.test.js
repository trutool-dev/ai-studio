const {
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
  calculateAge,
} = require('../src/utils/nutritionCalculator');

describe('calculateAge', () => {
  test('calcula la edad correctamente', () => {
    const today = new Date();
    const birth = new Date(today);
    birth.setFullYear(today.getFullYear() - 30);
    expect(calculateAge(birth)).toBe(30);
  });
});

describe('calculateBMR (Mifflin-St Jeor)', () => {
  const profile = {
    weight_kg: 80,
    height_cm: 175,
    birthdate: new Date(new Date().setFullYear(new Date().getFullYear() - 30)),
    gender: 'male',
  };

  test('calcula TMB para hombre de 30 años, 80kg, 175cm', () => {
    // (10 × 80) + (6.25 × 175) - (5 × 30) + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 ≈ 1749
    const bmr = calculateBMR(profile);
    expect(bmr).toBeGreaterThan(1700);
    expect(bmr).toBeLessThan(1800);
  });

  test('TMB femenina es menor que masculina con los mismos datos', () => {
    const femaleBmr = calculateBMR({ ...profile, gender: 'female' });
    const maleBmr = calculateBMR(profile);
    // La fórmula femenina resta 166 respecto a la masculina
    expect(femaleBmr).toBeLessThan(maleBmr);
    expect(maleBmr - femaleBmr).toBeCloseTo(166, 0);
  });
});

describe('calculateTDEE', () => {
  test('aplica el multiplicador de actividad correctamente', () => {
    const bmr = 1700;
    expect(calculateTDEE(bmr, 'sedentary')).toBe(Math.round(1700 * 1.2));
    expect(calculateTDEE(bmr, 'moderate')).toBe(Math.round(1700 * 1.55));
    expect(calculateTDEE(bmr, 'very_active')).toBe(Math.round(1700 * 1.9));
  });

  test('usa moderado por defecto para nivel desconocido', () => {
    const bmr = 1700;
    expect(calculateTDEE(bmr, 'unknown_level')).toBe(Math.round(1700 * 1.55));
  });
});

describe('calculateMacros', () => {
  const tdee = 2000;
  const weight = 80;

  test('perder peso: déficit 20% y proteína alta', () => {
    const macros = calculateMacros(tdee, weight, 'lose_weight');
    expect(macros.calories).toBe(1600); // 2000 * 0.80
    expect(macros.protein_g).toBe(176); // 80 * 2.2
    expect(macros.fat_g).toBeGreaterThan(0);
    expect(macros.carbs_g).toBeGreaterThan(0);
  });

  test('ganar músculo: superávit 12% y proteína alta', () => {
    const macros = calculateMacros(tdee, weight, 'gain_muscle');
    expect(macros.calories).toBe(2240); // 2000 * 1.12
    expect(macros.protein_g).toBe(176); // 80 * 2.2
  });

  test('mantenimiento: calorías TDEE', () => {
    const macros = calculateMacros(tdee, weight, 'maintain');
    expect(macros.calories).toBe(tdee);
  });

  test('los macros suman aproximadamente las calorías totales', () => {
    const macros = calculateMacros(tdee, weight, 'lose_weight');
    const totalFromMacros =
      macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
    // Tolerancia de ±20 kcal por redondeos
    expect(Math.abs(totalFromMacros - macros.calories)).toBeLessThan(20);
  });

  test('los carbohidratos nunca son negativos', () => {
    // Caso extremo: proteína muy alta que podría hacer negativos los carbs
    const macros = calculateMacros(1200, 100, 'lose_weight');
    expect(macros.carbs_g).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateNutritionTargets (integración)', () => {
  test('devuelve TMB, TDEE y macros en una sola llamada', () => {
    const profile = {
      weight_kg: 70,
      height_cm: 170,
      birthdate: new Date(new Date().setFullYear(new Date().getFullYear() - 25)),
      gender: 'female',
    };
    const result = calculateNutritionTargets(profile, 'moderate', 'general_health');

    expect(result).toHaveProperty('bmr');
    expect(result).toHaveProperty('tdee');
    expect(result).toHaveProperty('macros');
    expect(result.tdee).toBeGreaterThan(result.bmr);
    expect(result.macros.calories).toBeGreaterThan(0);
  });
});
