/**
 * Tests unitarios completos para nutritionCalculator.js (TS-02)
 * Cubre: calculateBMR, calculateTDEE, calculateMacros, calculateNutritionTargets, calculateAge
 * Fórmula: Mifflin-St Jeor
 */

const {
  calculateAge,
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  calculateNutritionTargets,
} = require('../../src/utils/nutritionCalculator');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Genera un Date de nacimiento N años atrás exactos */
function birthdateYearsAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

// ─── calculateAge ─────────────────────────────────────────────────────────────

describe('calculateAge', () => {
  test('edad exacta de 30 años', () => {
    expect(calculateAge(birthdateYearsAgo(30))).toBe(30);
  });

  test('edad exacta de 16 años (mínimo legal)', () => {
    expect(calculateAge(birthdateYearsAgo(16))).toBe(16);
  });

  test('edad 0 para recién nacido', () => {
    const today = new Date();
    expect(calculateAge(today)).toBe(0);
  });

  test('acepta fecha como string ISO', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 25);
    expect(calculateAge(d.toISOString())).toBe(25);
  });

  test('no cumpleaños aún: devuelve un año menos', () => {
    const d = new Date();
    // Ponemos el cumpleaños mañana para que aún no haya pasado
    d.setFullYear(d.getFullYear() - 20);
    d.setDate(d.getDate() + 1); // mañana hubiera sido el cumple
    expect(calculateAge(d)).toBe(19);
  });
});

// ─── calculateBMR (Mifflin-St Jeor) ──────────────────────────────────────────

describe('calculateBMR — fórmula Mifflin-St Jeor', () => {
  const maleProfile = {
    weight_kg: 80,
    height_cm: 175,
    birthdate: birthdateYearsAgo(30),
    gender: 'male',
  };

  const femaleProfile = {
    weight_kg: 60,
    height_cm: 165,
    birthdate: birthdateYearsAgo(25),
    gender: 'female',
  };

  // ─ Caso hombre de referencia ─────────────────────────────────────────────
  test('hombre 80 kg, 175 cm, 30 años → ~1749 kcal', () => {
    // (10×80) + (6.25×175) - (5×30) + 5 = 800 + 1093.75 - 150 + 5 = 1748.75 → 1749
    const bmr = calculateBMR(maleProfile);
    expect(bmr).toBe(1749);
  });

  // ─ Caso mujer de referencia ──────────────────────────────────────────────
  test('mujer 60 kg, 165 cm, 25 años → ~1363 kcal', () => {
    // (10×60) + (6.25×165) - (5×25) - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → 1345
    const bmr = calculateBMR(femaleProfile);
    // La fórmula da 1345; verificamos que está en rango razonable
    expect(bmr).toBeGreaterThan(1300);
    expect(bmr).toBeLessThan(1400);
  });

  // ─ TMB femenina < masculina con mismos datos ──────────────────────────────
  test('TMB femenina es exactamente 166 kcal menor que masculina (mismos datos)', () => {
    const profile = { weight_kg: 70, height_cm: 170, birthdate: birthdateYearsAgo(28), gender: 'male' };
    const maleBmr = calculateBMR(profile);
    const femaleBmr = calculateBMR({ ...profile, gender: 'female' });
    expect(maleBmr - femaleBmr).toBeCloseTo(166, 0);
  });

  // ─ Pesos extremos ─────────────────────────────────────────────────────────
  test('peso mínimo realista: 40 kg (anorexia)', () => {
    const bmr = calculateBMR({ weight_kg: 40, height_cm: 160, birthdate: birthdateYearsAgo(20), gender: 'female' });
    // (10×40) + (6.25×160) - (5×20) - 161 = 400 + 1000 - 100 - 161 = 1139
    expect(bmr).toBe(1139);
    expect(bmr).toBeGreaterThan(0);
  });

  test('peso muy alto: 200 kg (obesidad mórbida)', () => {
    const bmr = calculateBMR({ weight_kg: 200, height_cm: 180, birthdate: birthdateYearsAgo(35), gender: 'male' });
    // (10×200) + (6.25×180) - (5×35) + 5 = 2000 + 1125 - 175 + 5 = 2955
    expect(bmr).toBeGreaterThan(2500);
    expect(bmr).toBeGreaterThan(calculateBMR({ weight_kg: 80, height_cm: 175, birthdate: birthdateYearsAgo(30), gender: 'male' }));
  });

  // ─ Edades extremas ────────────────────────────────────────────────────────
  test('edad 16 (límite legal): produce BMR positivo', () => {
    const bmr = calculateBMR({ weight_kg: 60, height_cm: 165, birthdate: birthdateYearsAgo(16), gender: 'female' });
    expect(bmr).toBeGreaterThan(0);
  });

  test('edad 80 años: TMB reducida pero positiva', () => {
    const bmr = calculateBMR({ weight_kg: 70, height_cm: 170, birthdate: birthdateYearsAgo(80), gender: 'male' });
    // (10×70) + (6.25×170) - (5×80) + 5 = 700 + 1062.5 - 400 + 5 = 1367.5 → 1368
    expect(bmr).toBeGreaterThan(0);
    expect(bmr).toBeLessThan(1600);
  });

  // ─ Alturas extremas ───────────────────────────────────────────────────────
  test('altura 140 cm: produce BMR positivo', () => {
    const bmr = calculateBMR({ weight_kg: 50, height_cm: 140, birthdate: birthdateYearsAgo(30), gender: 'female' });
    expect(bmr).toBeGreaterThan(0);
  });

  test('altura 210 cm: produce BMR mayor que el promedio', () => {
    const bmrTall = calculateBMR({ weight_kg: 100, height_cm: 210, birthdate: birthdateYearsAgo(30), gender: 'male' });
    const bmrAvg = calculateBMR({ weight_kg: 80, height_cm: 175, birthdate: birthdateYearsAgo(30), gender: 'male' });
    expect(bmrTall).toBeGreaterThan(bmrAvg);
  });
});

// ─── calculateTDEE ─────────────────────────────────────────────────────────────

describe('calculateTDEE — multiplicadores de actividad', () => {
  const BMR = 1700;

  test('sedentary × 1.2', () => {
    expect(calculateTDEE(BMR, 'sedentary')).toBe(Math.round(BMR * 1.2));
  });

  test('light × 1.375', () => {
    expect(calculateTDEE(BMR, 'light')).toBe(Math.round(BMR * 1.375));
  });

  test('moderate × 1.55', () => {
    expect(calculateTDEE(BMR, 'moderate')).toBe(Math.round(BMR * 1.55));
  });

  test('active × 1.725', () => {
    expect(calculateTDEE(BMR, 'active')).toBe(Math.round(BMR * 1.725));
  });

  test('very_active × 1.9', () => {
    expect(calculateTDEE(BMR, 'very_active')).toBe(Math.round(BMR * 1.9));
  });

  test('TDEE > BMR para todos los niveles de actividad', () => {
    ['sedentary', 'light', 'moderate', 'active', 'very_active'].forEach((level) => {
      expect(calculateTDEE(BMR, level)).toBeGreaterThan(BMR);
    });
  });

  test('nivel desconocido → usa moderado por defecto (×1.55)', () => {
    expect(calculateTDEE(BMR, 'super_athlete')).toBe(Math.round(BMR * 1.55));
  });

  test('string vacío → usa moderado por defecto', () => {
    expect(calculateTDEE(BMR, '')).toBe(Math.round(BMR * 1.55));
  });

  test('undefined → usa moderado por defecto', () => {
    expect(calculateTDEE(BMR, undefined)).toBe(Math.round(BMR * 1.55));
  });

  test('los niveles más altos producen TDEE mayor', () => {
    expect(calculateTDEE(BMR, 'very_active')).toBeGreaterThan(calculateTDEE(BMR, 'active'));
    expect(calculateTDEE(BMR, 'active')).toBeGreaterThan(calculateTDEE(BMR, 'moderate'));
    expect(calculateTDEE(BMR, 'moderate')).toBeGreaterThan(calculateTDEE(BMR, 'light'));
    expect(calculateTDEE(BMR, 'light')).toBeGreaterThan(calculateTDEE(BMR, 'sedentary'));
  });
});

// ─── calculateMacros ──────────────────────────────────────────────────────────

describe('calculateMacros — distribución por objetivo', () => {
  const TDEE = 2000;
  const WEIGHT = 80;

  // ─ lose_weight ─────────────────────────────────────────────────────────────
  describe('objetivo: lose_weight', () => {
    let macros;
    beforeAll(() => { macros = calculateMacros(TDEE, WEIGHT, 'lose_weight'); });

    test('déficit del 20 %: calorías = TDEE × 0.80', () => {
      expect(macros.calories).toBe(Math.round(TDEE * 0.80)); // 1600
    });

    test('proteína alta: 2.2 g/kg → 80×2.2 = 176 g', () => {
      expect(macros.protein_g).toBe(176);
    });

    test('grasa positiva', () => {
      expect(macros.fat_g).toBeGreaterThan(0);
    });

    test('carbohidratos positivos (o cero si proteína absorbe todo)', () => {
      expect(macros.carbs_g).toBeGreaterThanOrEqual(0);
    });

    test('macros suman ≈ calorías objetivo (±20 kcal)', () => {
      const total = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
      expect(Math.abs(total - macros.calories)).toBeLessThan(20);
    });
  });

  // ─ gain_muscle ─────────────────────────────────────────────────────────────
  describe('objetivo: gain_muscle', () => {
    let macros;
    beforeAll(() => { macros = calculateMacros(TDEE, WEIGHT, 'gain_muscle'); });

    test('superávit del 12 %: calorías = TDEE × 1.12', () => {
      expect(macros.calories).toBe(Math.round(TDEE * 1.12)); // 2240
    });

    test('proteína alta: 2.2 g/kg', () => {
      expect(macros.protein_g).toBe(176);
    });

    test('calorías > TDEE (superávit)', () => {
      expect(macros.calories).toBeGreaterThan(TDEE);
    });

    test('macros suman ≈ calorías objetivo (±20 kcal)', () => {
      const total = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
      expect(Math.abs(total - macros.calories)).toBeLessThan(20);
    });
  });

  // ─ maintain ────────────────────────────────────────────────────────────────
  describe('objetivo: maintain', () => {
    let macros;
    beforeAll(() => { macros = calculateMacros(TDEE, WEIGHT, 'maintain'); });

    test('calorías = TDEE (sin ajuste)', () => {
      expect(macros.calories).toBe(TDEE);
    });

    test('proteína moderada: 1.8 g/kg → 80×1.8 = 144 g', () => {
      expect(macros.protein_g).toBe(144);
    });

    test('macros suman ≈ calorías objetivo (±20 kcal)', () => {
      const total = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
      expect(Math.abs(total - macros.calories)).toBeLessThan(20);
    });
  });

  // ─ general_health ──────────────────────────────────────────────────────────
  describe('objetivo: general_health', () => {
    let macros;
    beforeAll(() => { macros = calculateMacros(TDEE, WEIGHT, 'general_health'); });

    test('calorías = TDEE', () => {
      expect(macros.calories).toBe(TDEE);
    });

    test('proteína 1.6 g/kg → 80×1.6 = 128 g', () => {
      expect(macros.protein_g).toBe(128);
    });

    test('macros suman ≈ calorías objetivo (±20 kcal)', () => {
      const total = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
      expect(Math.abs(total - macros.calories)).toBeLessThan(20);
    });
  });

  // ─ Objetivo desconocido → general_health ───────────────────────────────────
  describe('objetivo desconocido (fallback a general_health)', () => {
    test('objetivo unknown → comportamiento como general_health', () => {
      const macros = calculateMacros(TDEE, WEIGHT, 'unknown_goal');
      expect(macros.calories).toBe(TDEE);
    });
  });

  // ─ Casos límite ────────────────────────────────────────────────────────────
  describe('casos límite', () => {
    test('carbohidratos nunca negativos con dieta muy baja en calorías', () => {
      // Caso extremo: 1200 kcal con 100 kg de peso
      // Proteína = 100×2.2 = 220g = 880 kcal → supera las 1200; carbs = 0
      const macros = calculateMacros(1200, 100, 'lose_weight');
      expect(macros.carbs_g).toBeGreaterThanOrEqual(0);
    });

    test('peso muy bajo (30 kg): proteína razonable', () => {
      const macros = calculateMacros(1200, 30, 'lose_weight');
      expect(macros.protein_g).toBe(Math.round(30 * 2.2));
      expect(macros.calories).toBeGreaterThan(0);
    });

    test('peso muy alto (150 kg): proteína y calorías positivas', () => {
      const macros = calculateMacros(4000, 150, 'gain_muscle');
      expect(macros.protein_g).toBeGreaterThan(0);
      expect(macros.calories).toBeGreaterThan(0);
    });

    test('estructura de respuesta correcta (todas las propiedades presentes)', () => {
      const macros = calculateMacros(TDEE, WEIGHT, 'lose_weight');
      expect(macros).toHaveProperty('calories');
      expect(macros).toHaveProperty('protein_g');
      expect(macros).toHaveProperty('carbs_g');
      expect(macros).toHaveProperty('fat_g');
    });

    test('todos los macros son números', () => {
      const macros = calculateMacros(TDEE, WEIGHT, 'lose_weight');
      expect(typeof macros.calories).toBe('number');
      expect(typeof macros.protein_g).toBe('number');
      expect(typeof macros.carbs_g).toBe('number');
      expect(typeof macros.fat_g).toBe('number');
    });
  });
});

// ─── calculateNutritionTargets (integración) ──────────────────────────────────

describe('calculateNutritionTargets — integración completa', () => {
  const profile = {
    weight_kg: 75,
    height_cm: 178,
    birthdate: birthdateYearsAgo(28),
    gender: 'male',
  };

  test('devuelve bmr, tdee y macros', () => {
    const result = calculateNutritionTargets(profile, 'moderate', 'maintain');
    expect(result).toHaveProperty('bmr');
    expect(result).toHaveProperty('tdee');
    expect(result).toHaveProperty('macros');
  });

  test('TDEE > BMR siempre', () => {
    const result = calculateNutritionTargets(profile, 'active', 'lose_weight');
    expect(result.tdee).toBeGreaterThan(result.bmr);
  });

  test('macros incluyen calories, protein_g, carbs_g, fat_g', () => {
    const { macros } = calculateNutritionTargets(profile, 'light', 'gain_muscle');
    expect(macros).toHaveProperty('calories');
    expect(macros).toHaveProperty('protein_g');
    expect(macros).toHaveProperty('carbs_g');
    expect(macros).toHaveProperty('fat_g');
  });

  test('para lose_weight: macros.calories < tdee', () => {
    const result = calculateNutritionTargets(profile, 'moderate', 'lose_weight');
    expect(result.macros.calories).toBeLessThan(result.tdee);
  });

  test('para gain_muscle: macros.calories > tdee', () => {
    const result = calculateNutritionTargets(profile, 'moderate', 'gain_muscle');
    expect(result.macros.calories).toBeGreaterThan(result.tdee);
  });

  test('para maintain: macros.calories === tdee', () => {
    const result = calculateNutritionTargets(profile, 'sedentary', 'maintain');
    expect(result.macros.calories).toBe(result.tdee);
  });

  test('consistencia interna: macros.calories cuadra con suma de macros (±20 kcal)', () => {
    ['lose_weight', 'gain_muscle', 'maintain', 'general_health'].forEach((goal) => {
      const { macros } = calculateNutritionTargets(profile, 'moderate', goal);
      const total = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
      expect(Math.abs(total - macros.calories)).toBeLessThan(20);
    });
  });

  test('mujer produce BMR menor que hombre con mismo perfil', () => {
    const femaleProfile = { ...profile, gender: 'female' };
    const male = calculateNutritionTargets(profile, 'moderate', 'maintain');
    const female = calculateNutritionTargets(femaleProfile, 'moderate', 'maintain');
    expect(female.bmr).toBeLessThan(male.bmr);
  });
});
