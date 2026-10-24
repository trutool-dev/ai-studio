/**
 * Normalización y validación de la entrada del onboarding.
 *
 * SEC-28 (JB-01): el backend acepta el formato que envía HOY el frontend
 *   (`restrictions: string[]`, `conditions: string[]`, `injuries: string[]`,
 *   `days_per_week`, `equipment[]`, `age`, `dietType`...) además del formato
 *   antiguo de objetos (`food_restrictions[]`, `conditions[].condition_name`...).
 * SEC-29 (JB-02 + SA-18): edad mínima 16 y rangos fisiológicos → 400.
 * SEC-61 (SA-26): todo se construye con listas blancas de campos (sin spread del body).
 * SEC-63 (SA-28): límites de longitud de los campos de texto libre de salud → 400.
 *
 * Todas las funciones son puras: lanzan OnboardingInputError (400) o devuelven
 * objetos listos para Prisma.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// LÍMITES (valores conservadores; SEC-63)
// ─────────────────────────────────────────────────────────────

const TEXT_LIMITS = Object.freeze({
  name: 100,
  profession: 100,
  injuries_or_limitations: 300,
  injury_item: 50,
  condition_name: 100,
  condition_notes: 300,
  food_name: 50,
  previous_attempts_notes: 500,
  main_challenge: 300,
  reason: 50,
  question_key: 100,
  answer_value: 500,
});

const MAX_ITEMS = Object.freeze({
  restrictions: 20,
  conditions: 20,
  injuries: 10,
  answers: 50,
  equipment: 10,
  motivations: 10,
});

// Rangos fisiológicos aceptados (SEC-29). Decisión de producto conservadora:
// se rechaza (400) en vez de "clampear" en el cálculo.
const MIN_AGE = 16; // LOPDGDD art. 7
const PHYSIO_RANGES = Object.freeze({
  age:       { min: MIN_AGE, max: 100 },
  weight_kg: { min: 30, max: 300 },
  height_cm: { min: 100, max: 250 },
  available_days_per_week: { min: 1, max: 7 },
  max_session_duration_minutes: { min: 10, max: 240 },
  meals_per_day_preferred: { min: 1, max: 8 },
});

// ─────────────────────────────────────────────────────────────
// ENUMS Y MAPEOS frontend → Prisma
// ─────────────────────────────────────────────────────────────

const GOALS = ['lose_weight', 'gain_muscle', 'maintain', 'general_health'];
const GOAL_ALIASES = { stay_active: 'maintain', improve_habits: 'general_health' };

const GENDERS = ['male', 'female', 'other'];

const BODY_TYPES = ['ectomorph', 'mesomorph', 'endomorph'];
const BODY_TYPE_ALIASES = { slim: 'ectomorph', athletic: 'mesomorph', average: 'mesomorph', overweight: 'endomorph' };

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'];
const HOME_EQUIPMENT = ['none', 'dumbbells', 'bands', 'machines', 'full'];
const FRONT_EQUIPMENT = { gym: 'full', home: 'dumbbells', outdoors: 'none', none: 'none' };
const SCHEDULES = ['morning', 'afternoon', 'night'];

// `keto` y `other` (frontend) no existen en el enum DietType: se guardan como
// null (dieta general) en vez de provocar un 500. Añadirlos al enum es una
// decisión de producto que requiere migración (pendiente de Antonio).
const DIET_TYPES = ['omnivore', 'vegetarian', 'vegan', 'gluten_free', 'lactose_free'];
const DIET_TYPES_WITHOUT_ENUM = ['keto', 'other'];

const BUDGETS = ['low', 'medium', 'high'];
const EATS_OUT = ['never', 'sometimes', 'often', 'always'];
const RESTRICTION_TYPES = ['allergy', 'intolerance', 'dislike'];
const SEVERITIES = ['mild', 'moderate', 'severe'];
const CONDITION_TYPES = ['injury', 'disease', 'medication'];
const WORK_TYPES = ['office', 'physical', 'standing', 'mixed'];
const SLEEP_QUALITY = ['good', 'regular', 'bad'];
const ALCOHOL = ['never', 'occasional', 'frequent'];
const MOTIVATION_TYPES = ['health', 'aesthetics', 'performance', 'mental_wellbeing'];
const MOTIVATION_ALIASES = {
  appearance: 'aesthetics', confidence: 'mental_wellbeing', energy: 'health',
  sleep: 'mental_wellbeing', stress: 'mental_wellbeing', longevity: 'health',
};
const TRACKING = ['detailed', 'basic', 'results_only'];
const ONBOARDING_CATEGORIES = ['lifestyle', 'training', 'nutrition', 'health', 'motivation'];

/**
 * Catálogo de restricciones que envía el frontend (`OnboardingNutrition.tsx`)
 * más los 14 alérgenos de declaración obligatoria UE. Las alergias se tratan
 * como `severe` por defecto (conservador).
 */
const RESTRICTION_CATALOG = Object.freeze({
  lactose:   { restriction_type: 'intolerance', food_name: 'Lactosa (lácteos)', severity: 'moderate' },
  dairy:     { restriction_type: 'allergy',     food_name: 'Leche y lácteos',   severity: 'severe' },
  milk:      { restriction_type: 'allergy',     food_name: 'Leche y lácteos',   severity: 'severe' },
  nuts:      { restriction_type: 'allergy',     food_name: 'Frutos secos',      severity: 'severe' },
  peanuts:   { restriction_type: 'allergy',     food_name: 'Cacahuete',         severity: 'severe' },
  shellfish: { restriction_type: 'allergy',     food_name: 'Marisco',           severity: 'severe' },
  molluscs:  { restriction_type: 'allergy',     food_name: 'Moluscos',          severity: 'severe' },
  eggs:      { restriction_type: 'allergy',     food_name: 'Huevo',             severity: 'severe' },
  soy:       { restriction_type: 'allergy',     food_name: 'Soja',              severity: 'severe' },
  fish:      { restriction_type: 'allergy',     food_name: 'Pescado',           severity: 'severe' },
  gluten:    { restriction_type: 'intolerance', food_name: 'Gluten',            severity: 'severe' },
  sesame:    { restriction_type: 'allergy',     food_name: 'Sésamo',            severity: 'severe' },
  celery:    { restriction_type: 'allergy',     food_name: 'Apio',              severity: 'severe' },
  mustard:   { restriction_type: 'allergy',     food_name: 'Mostaza',           severity: 'severe' },
  sulphites: { restriction_type: 'allergy',     food_name: 'Sulfitos',          severity: 'severe' },
  lupin:     { restriction_type: 'allergy',     food_name: 'Altramuz',          severity: 'severe' },
});

/** Condiciones que envía el frontend (`OnboardingHealth.tsx`). */
const CONDITION_CATALOG = Object.freeze({
  diabetes:     { condition_name: 'Diabetes',            condition_type: 'disease', affects_training: true,  affects_nutrition: true },
  hypertension: { condition_name: 'Hipertensión',        condition_type: 'disease', affects_training: true,  affects_nutrition: true },
  heart:        { condition_name: 'Problemas cardíacos', condition_type: 'disease', affects_training: true,  affects_nutrition: true },
  asthma:       { condition_name: 'Asma',                condition_type: 'disease', affects_training: true,  affects_nutrition: false },
  thyroid:      { condition_name: 'Trastorno de tiroides', condition_type: 'disease', affects_training: false, affects_nutrition: true },
  cholesterol:  { condition_name: 'Colesterol alto',     condition_type: 'disease', affects_training: false, affects_nutrition: true },
});

/**
 * Claves canónicas de lesión (las del frontend) y sus alias. El selector de
 * ejercicios usa estas mismas claves (SEC-58).
 */
const INJURY_KEYS = ['back', 'knee', 'shoulder', 'ankle', 'neck', 'wrist', 'hip'];
const INJURY_ALIASES = Object.freeze({
  lower_back: 'back', espalda: 'back', lumbar: 'back', spine: 'back',
  rodilla: 'knee', knees: 'knee',
  hombro: 'shoulder', shoulders: 'shoulder',
  tobillo: 'ankle', ankles: 'ankle',
  cuello: 'neck', cervical: 'neck',
  muñeca: 'wrist', muneca: 'wrist', codo: 'wrist', elbow: 'wrist', wrists: 'wrist',
  cadera: 'hip', hips: 'hip',
});
const INJURY_LABELS_ES = Object.freeze({
  back: 'espalda (zona lumbar)', knee: 'rodilla', shoulder: 'hombro', ankle: 'tobillo',
  neck: 'cuello', wrist: 'muñeca/codo', hip: 'cadera',
});

// ─────────────────────────────────────────────────────────────
// ERRORES
// ─────────────────────────────────────────────────────────────

class OnboardingInputError extends Error {
  /**
   * @param {string} code - VALIDATION_ERROR | AGE_RESTRICTION
   * @param {string} message
   * @param {string} [field]
   */
  constructor(code, message, field) {
    super(message);
    this.name = 'OnboardingInputError';
    this.code = code;
    this.status = 400;
    this.field = field;
  }
}

const fail = (field, message, code = 'VALIDATION_ERROR') => { throw new OnboardingInputError(code, message, field); };

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const isPresent = (v) => v !== undefined && v !== null && v !== '';

function toNumber(value, field) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) fail(field, `${field} debe ser numérico`);
  return n;
}

function inRange(value, field, { integer = false } = {}) {
  const n = toNumber(value, field);
  const { min, max } = PHYSIO_RANGES[field];
  if (integer && !Number.isInteger(n)) fail(field, `${field} debe ser un número entero`);
  if (n < min || n > max) fail(field, `${field} fuera de rango (${min}-${max})`);
  return n;
}

function pickEnum(value, allowed, field, aliases = {}) {
  if (!isPresent(value)) return undefined;
  if (typeof value !== 'string') fail(field, `${field} inválido`);
  const v = aliases[value] || value;
  if (!allowed.includes(v)) fail(field, `${field} inválido`);
  return v;
}

function pickBool(value, field) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') fail(field, `${field} debe ser booleano`);
  return value;
}

/** Texto libre: recorta espacios y valida longitud (no trunca: 400 si excede). */
function pickText(value, field, limitKey = field) {
  if (!isPresent(value)) return undefined;
  if (typeof value !== 'string') fail(field, `${field} debe ser texto`);
  const v = value.trim();
  const max = TEXT_LIMITS[limitKey];
  if (Array.from(v).length > max) fail(field, `${field} supera ${max} caracteres`);
  return v || undefined;
}

function asArray(value, field, maxKey) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) fail(field, `${field} debe ser un array`);
  if (value.length > MAX_ITEMS[maxKey]) fail(field, `${field} admite como máximo ${MAX_ITEMS[maxKey]} elementos`);
  return value;
}

const isNoneId = (s) => typeof s === 'string' && /^none(_|$)/.test(s);
const normKey = (s) => s.trim().toLowerCase();

/** Elimina las claves undefined (para no sobrescribir con undefined en Prisma). */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ─────────────────────────────────────────────────────────────
// EDAD Y PERFIL FÍSICO (SEC-29)
// ─────────────────────────────────────────────────────────────

/**
 * Edad cumplida en `now` para una fecha de nacimiento.
 * @param {Date|string} birthdate
 * @param {Date} [now]
 */
function computeAge(birthdate, now = new Date()) {
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return NaN;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function assertAge(age) {
  if (!Number.isFinite(age)) fail('age', 'Edad o fecha de nacimiento inválida');
  if (age < MIN_AGE) {
    fail('age', `Debes tener al menos ${MIN_AGE} años para usar Healthy (LOPDGDD Art. 7)`, 'AGE_RESTRICTION');
  }
  if (age > PHYSIO_RANGES.age.max) fail('age', `age fuera de rango (${MIN_AGE}-${PHYSIO_RANGES.age.max})`);
}

/**
 * Normaliza el perfil físico (frontend: {gender, age, weight, height, bodyType};
 * antiguo: {name, birthdate, weight_kg, height_cm, body_type, ...}).
 *
 * @param {object} src
 * @param {{ goal?: string, requireIdentity?: boolean, now?: Date }} [opts]
 * @returns {object} datos para Prisma `profile` (sin user_id)
 */
function normalizeProfileInput(src, opts = {}) {
  if (!src || typeof src !== 'object') fail('profile', 'profile es obligatorio');
  const now = opts.now || new Date();

  let birthdate;
  if (isPresent(src.birthdate)) {
    if (typeof src.birthdate !== 'string' && !(src.birthdate instanceof Date)) fail('birthdate', 'Fecha de nacimiento inválida');
    birthdate = new Date(src.birthdate);
    if (Number.isNaN(birthdate.getTime()) || birthdate > now) fail('birthdate', 'Fecha de nacimiento inválida');
    assertAge(computeAge(birthdate, now));
  } else if (isPresent(src.age)) {
    const age = toNumber(src.age, 'age');
    if (!Number.isInteger(age)) fail('age', 'age debe ser un número entero');
    assertAge(age);
    // 1 de enero del año de nacimiento: la edad calculada coincide con la declarada
    birthdate = new Date(Date.UTC(now.getUTCFullYear() - age, 0, 1));
  } else if (opts.requireIdentity !== false) {
    fail('age', 'La edad o la fecha de nacimiento es obligatoria');
  }

  const weight = isPresent(src.weight_kg) ? src.weight_kg : src.weight;
  const height = isPresent(src.height_cm) ? src.height_cm : src.height;

  return compact({
    name: pickText(src.name, 'name'),
    birthdate,
    gender: pickEnum(src.gender, GENDERS, 'gender'),
    weight_kg: isPresent(weight) ? inRange(weight, 'weight_kg') : undefined,
    height_cm: isPresent(height) ? inRange(height, 'height_cm') : undefined,
    body_type: pickEnum(isPresent(src.body_type) ? src.body_type : src.bodyType, BODY_TYPES, 'body_type', BODY_TYPE_ALIASES),
    activity_level: pickEnum(src.activity_level, ACTIVITY_LEVELS, 'activity_level'),
    goal: pickEnum(isPresent(src.goal) ? src.goal : opts.goal, GOALS, 'goal', GOAL_ALIASES),
  });
}

/**
 * Valida un perfil ya guardado antes de llamar a la IA (datos antiguos o
 * creados por otros caminos). Lanza 400 si la edad o los rangos no son válidos.
 * @param {{ birthdate, weight_kg, height_cm }} profile
 * @returns {{ age: number, weight_kg: number, height_cm: number }}
 */
function assertStoredProfileValid(profile, now = new Date()) {
  assertAge(computeAge(profile.birthdate, now));
  if (!isPresent(profile.weight_kg)) fail('weight_kg', 'Falta el peso en el perfil');
  if (!isPresent(profile.height_cm)) fail('height_cm', 'Falta la altura en el perfil');
  return {
    age: computeAge(profile.birthdate, now),
    weight_kg: inRange(parseFloat(profile.weight_kg), 'weight_kg'),
    height_cm: inRange(parseFloat(profile.height_cm), 'height_cm'),
  };
}

// ─────────────────────────────────────────────────────────────
// ESTILO DE VIDA / ENTRENAMIENTO / NUTRICIÓN / MOTIVACIÓN
// ─────────────────────────────────────────────────────────────

function normalizeLifestyleInput(src) {
  if (!src || typeof src !== 'object') return {};
  const schedule = isPresent(src.usual_schedule) ? src.usual_schedule : (src.work_schedule ?? src.workSchedule);
  let stress = isPresent(src.stress_level) ? src.stress_level : src.stressLevel;
  if (isPresent(stress)) {
    stress = toNumber(stress, 'stress_level');
    if (!Number.isInteger(stress) || stress < 1 || stress > 5) fail('stress_level', 'stress_level debe estar entre 1 y 5');
  }
  let sleep = src.sleep_hours_usual;
  if (isPresent(sleep)) {
    sleep = toNumber(sleep, 'sleep_hours_usual');
    if (sleep < 0 || sleep > 24) fail('sleep_hours_usual', 'sleep_hours_usual debe estar entre 0 y 24');
  }
  let hours = src.work_hours_per_day;
  if (isPresent(hours)) {
    hours = toNumber(hours, 'work_hours_per_day');
    if (!Number.isInteger(hours) || hours < 0 || hours > 24) fail('work_hours_per_day', 'work_hours_per_day debe estar entre 0 y 24');
  }
  let water = src.daily_water_glasses;
  if (isPresent(water)) {
    water = toNumber(water, 'daily_water_glasses');
    if (!Number.isInteger(water) || water < 0 || water > 40) fail('daily_water_glasses', 'daily_water_glasses fuera de rango');
  }
  return compact({
    profession: pickText(src.profession, 'profession'),
    work_type: pickEnum(src.work_type, WORK_TYPES, 'work_type'),
    work_hours_per_day: hours ?? undefined,
    stress_level: stress ?? undefined,
    // `flexible` (frontend) no existe en el enum ScheduleType → null
    usual_schedule: schedule === 'flexible' ? null : pickEnum(schedule, SCHEDULES, 'usual_schedule'),
    sleep_hours_usual: sleep ?? undefined,
    sleep_quality: pickEnum(src.sleep_quality, SLEEP_QUALITY, 'sleep_quality'),
    alcohol_consumption: pickEnum(src.alcohol_consumption, ALCOHOL, 'alcohol_consumption'),
    smoker: pickBool(src.smoker, 'smoker'),
    daily_water_glasses: water ?? undefined,
  });
}

/**
 * Entrenamiento (frontend: {days_per_week|daysPerWeek, equipment: string[], experience};
 * antiguo: {available_days_per_week, has_gym_access, home_equipment, experience_level...}).
 */
function normalizeTrainingInput(src, { requireDays = false } = {}) {
  if (!src || typeof src !== 'object') return {};
  const daysRaw = [src.available_days_per_week, src.days_per_week, src.daysPerWeek].find(isPresent);
  if (requireDays && !isPresent(daysRaw)) fail('available_days_per_week', 'Días disponibles obligatorios (1-7)');

  let has_gym_access = pickBool(src.has_gym_access, 'has_gym_access');
  let home_equipment = pickEnum(src.home_equipment, HOME_EQUIPMENT, 'home_equipment');
  const equipment = asArray(src.equipment, 'equipment', 'equipment');
  if (equipment) {
    const ids = equipment.map((e) => {
      if (typeof e !== 'string' || !(e in FRONT_EQUIPMENT)) fail('equipment', 'equipment inválido');
      return e;
    });
    if (has_gym_access === undefined) has_gym_access = ids.includes('gym');
    if (home_equipment === undefined) {
      home_equipment = ids.includes('gym') ? 'full' : (ids.includes('home') ? 'dumbbells' : 'none');
    }
  }

  return compact({
    available_days_per_week: isPresent(daysRaw) ? inRange(daysRaw, 'available_days_per_week', { integer: true }) : undefined,
    max_session_duration_minutes: isPresent(src.max_session_duration_minutes)
      ? inRange(src.max_session_duration_minutes, 'max_session_duration_minutes', { integer: true }) : undefined,
    preferred_training_time: pickEnum(src.preferred_training_time, SCHEDULES, 'preferred_training_time'),
    has_gym_access,
    home_equipment,
    experience_level: pickEnum(isPresent(src.experience_level) ? src.experience_level : src.experience, EXPERIENCE_LEVELS, 'experience_level'),
  });
}

/**
 * Tipo de dieta: devuelve el valor del enum, null para keto/other (sin enum)
 * o undefined si no se envía.
 */
function normalizeDietType(value) {
  if (!isPresent(value)) return undefined;
  if (DIET_TYPES_WITHOUT_ENUM.includes(value)) return null;
  return pickEnum(value, DIET_TYPES, 'diet_type');
}

function normalizeNutritionInput(src) {
  if (!src || typeof src !== 'object') return {};
  let meals = src.meals_per_day_preferred;
  if (isPresent(meals)) meals = inRange(meals, 'meals_per_day_preferred', { integer: true });
  const restrictionsSrc = src.restrictions !== undefined ? src.restrictions : src.food_restrictions;
  return compact({
    diet_type: normalizeDietType(isPresent(src.diet_type) ? src.diet_type : src.dietType),
    meals_per_day_preferred: meals ?? undefined,
    cooks_at_home: pickBool(src.cooks_at_home, 'cooks_at_home'),
    eats_out_frequency: pickEnum(src.eats_out_frequency, EATS_OUT, 'eats_out_frequency'),
    monthly_food_budget_range: pickEnum(isPresent(src.monthly_food_budget_range) ? src.monthly_food_budget_range : src.budget, BUDGETS, 'monthly_food_budget_range'),
    restrictions: restrictionsSrc !== undefined ? normalizeRestrictions(restrictionsSrc) : undefined,
  });
}

function normalizeMotivationInput(src) {
  if (!src || typeof src !== 'object') return {};
  let main = src.main_motivation;
  const motivations = asArray(src.motivations, 'motivations', 'motivations');
  if (!isPresent(main) && motivations && motivations.length > 0) main = motivations[0];
  let previous = src.previous_attempts;
  if (typeof previous === 'string') {
    if (!['none', 'few', 'many'].includes(previous)) fail('previous_attempts', 'previous_attempts inválido');
    previous = previous !== 'none';
  }
  // `main_challenge` (frontend) es texto libre sin uso en el plan: no se guarda (minimización)
  pickText(src.main_challenge, 'main_challenge');
  return compact({
    main_motivation: pickEnum(main, MOTIVATION_TYPES, 'main_motivation', MOTIVATION_ALIASES),
    previous_attempts: pickBool(previous, 'previous_attempts'),
    previous_attempts_notes: pickText(src.previous_attempts_notes, 'previous_attempts_notes'),
    tracking_preference: pickEnum(src.tracking_preference, TRACKING, 'tracking_preference'),
    has_support_network: pickBool(src.has_support_network, 'has_support_network'),
  });
}

// ─────────────────────────────────────────────────────────────
// DATOS DE SALUD (Art. 9): restricciones, condiciones, lesiones
// ─────────────────────────────────────────────────────────────

/**
 * Restricciones alimentarias → filas de FoodRestriction (sin user_id).
 * Acepta ids del frontend (`'nuts'`), texto libre corto o el objeto antiguo.
 */
function normalizeRestrictions(list) {
  const arr = asArray(list, 'restrictions', 'restrictions');
  if (!arr) return [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    let row;
    if (typeof item === 'string') {
      if (isNoneId(item)) continue;
      const key = normKey(item);
      const known = RESTRICTION_CATALOG[key];
      row = known
        ? { ...known }
        // Texto libre: se trata como alergia grave (conservador)
        : { restriction_type: 'allergy', food_name: pickText(item, 'food_name'), severity: 'severe' };
    } else if (item && typeof item === 'object') {
      row = {
        restriction_type: pickEnum(item.restriction_type, RESTRICTION_TYPES, 'restriction_type') || 'allergy',
        food_name: pickText(item.food_name, 'food_name'),
        severity: pickEnum(item.severity, SEVERITIES, 'severity') || 'severe',
      };
    } else {
      fail('restrictions', 'restricción inválida');
    }
    if (!row.food_name) fail('food_name', 'food_name es obligatorio');
    const dedupe = `${row.restriction_type}:${row.food_name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(row);
  }
  return out;
}

/** Condiciones médicas → filas de HealthCondition (sin user_id). */
function normalizeConditions(list) {
  const arr = asArray(list, 'conditions', 'conditions');
  if (!arr) return [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    let row;
    if (typeof item === 'string') {
      if (isNoneId(item)) continue;
      const known = CONDITION_CATALOG[normKey(item)];
      row = known
        ? { ...known, notes: null }
        : { condition_name: pickText(item, 'condition_name'), condition_type: 'disease', affects_training: true, affects_nutrition: true, notes: null };
    } else if (item && typeof item === 'object') {
      const type = typeof item.condition_type === 'string' && CONDITION_TYPES.includes(item.condition_type)
        ? item.condition_type : 'disease';
      row = {
        condition_name: pickText(item.condition_name, 'condition_name'),
        condition_type: type,
        affects_training: pickBool(item.affects_training, 'affects_training') ?? false,
        affects_nutrition: pickBool(item.affects_nutrition, 'affects_nutrition') ?? false,
        notes: pickText(item.notes, 'notes', 'condition_notes') ?? null,
      };
    } else {
      fail('conditions', 'condición inválida');
    }
    if (!row.condition_name) fail('condition_name', 'condition_name es obligatorio');
    const dedupe = row.condition_name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(row);
  }
  return out;
}

/** Normaliza un identificador de lesión a su clave canónica (o null). */
function canonicalInjuryKey(value) {
  if (typeof value !== 'string') return null;
  const k = normKey(value).replace(/\s+/g, '_');
  if (INJURY_KEYS.includes(k)) return k;
  return INJURY_ALIASES[k] || INJURY_ALIASES[k.replace(/_/g, ' ')] || null;
}

/**
 * Lesiones → lista de claves canónicas + texto libre corto (máx. 10 elementos).
 * Acepta array de ids (frontend) o la cadena antigua separada por comas.
 * @returns {string[]}
 */
function normalizeInjuries(value) {
  if (value === undefined || value === null) return [];
  let arr = value;
  if (typeof value === 'string') {
    pickText(value, 'injuries_or_limitations');
    arr = value.split(',');
  }
  arr = asArray(arr, 'injuries', 'injuries');
  const out = [];
  for (const item of arr) {
    if (typeof item !== 'string') fail('injuries', 'lesión inválida');
    const trimmed = item.trim();
    if (!trimmed || isNoneId(trimmed)) continue;
    const key = canonicalInjuryKey(trimmed) || pickText(trimmed, 'injuries', 'injury_item');
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * Igual que normalizeInjuries pero para datos ya guardados: nunca lanza
 * (los elementos no válidos se ignoran).
 */
function normalizeInjuriesSafe(value) {
  try {
    return normalizeInjuries(value);
  } catch {
    if (typeof value !== 'string') return [];
    return value.split(',').map((s) => s.trim()).filter((s) => s && !isNoneId(s))
      .map((s) => canonicalInjuryKey(s) || s.slice(0, TEXT_LIMITS.injury_item)).slice(0, MAX_ITEMS.injuries);
  }
}

/** Serializa las lesiones para `training_preferences.injuries_or_limitations`. */
function serializeInjuries(keys) {
  if (!keys || keys.length === 0) return null;
  const s = keys.join(', ');
  if (s.length > TEXT_LIMITS.injuries_or_limitations) fail('injuries', 'Demasiadas lesiones declaradas');
  return s;
}

/** Etiqueta en español para el prompt (las claves desconocidas se devuelven tal cual). */
function injuryLabel(key) {
  return INJURY_LABELS_ES[key] || key;
}

/**
 * Normaliza el body de PUT /onboarding/health (frontend y formato antiguo).
 * Solo devuelve las listas que vienen en el body (undefined = no tocar).
 */
function normalizeHealthInput(body) {
  const src = body && typeof body === 'object' ? body : {};
  const restrictionsSrc = src.food_restrictions !== undefined ? src.food_restrictions : src.restrictions;
  return {
    conditions: src.conditions !== undefined ? normalizeConditions(src.conditions) : undefined,
    food_restrictions: restrictionsSrc !== undefined ? normalizeRestrictions(restrictionsSrc) : undefined,
    injuries: src.injuries !== undefined ? normalizeInjuries(src.injuries) : undefined,
  };
}

/** Respuestas del onboarding con lista blanca de campos (SEC-61). */
function normalizeAnswers(list) {
  const arr = asArray(list, 'answers', 'answers');
  if (!arr) return [];
  return arr.map((a) => {
    if (!a || typeof a !== 'object') fail('answers', 'respuesta inválida');
    const question_key = pickText(a.question_key, 'question_key');
    const answer_value = pickText(typeof a.answer_value === 'string' ? a.answer_value : (isPresent(a.answer_value) ? String(a.answer_value) : undefined), 'answer_value');
    const question_category = pickEnum(a.question_category, ONBOARDING_CATEGORIES, 'question_category');
    if (!question_key || !answer_value || !question_category) fail('answers', 'question_key, answer_value y question_category son obligatorios');
    return { question_key, answer_value, question_category };
  });
}

/**
 * Normaliza el body completo de POST /onboarding/complete (el frontend envía
 * todo el store: {goal, profile, lifestyle, training, nutrition, health, motivation}).
 * Solo incluye las secciones presentes.
 */
function normalizeCompletePayload(body, now = new Date()) {
  const src = body && typeof body === 'object' ? body : {};
  const out = {};
  if (src.profile && typeof src.profile === 'object') {
    out.profile = normalizeProfileInput(src.profile, { goal: src.goal, now });
  } else if (isPresent(src.goal)) {
    out.profile = { goal: pickEnum(src.goal, GOALS, 'goal', GOAL_ALIASES) };
  }
  if (src.lifestyle && typeof src.lifestyle === 'object') out.lifestyle = normalizeLifestyleInput(src.lifestyle);
  if (src.training && typeof src.training === 'object') out.training = normalizeTrainingInput(src.training);
  if (src.nutrition && typeof src.nutrition === 'object') out.nutrition = normalizeNutritionInput(src.nutrition);
  if (src.health && typeof src.health === 'object') out.health = normalizeHealthInput(src.health);
  if (src.motivation && typeof src.motivation === 'object') out.motivation = normalizeMotivationInput(src.motivation);
  out.answers = normalizeAnswers(src.answers);
  return out;
}

/**
 * ¿El payload normalizado contiene datos de salud art. 9?
 * (restricciones, condiciones o lesiones declaradas).
 */
function hasHealthData(normalized) {
  const h = normalized.health || {};
  const r = normalized.nutrition && normalized.nutrition.restrictions;
  return Boolean((h.conditions && h.conditions.length) || (h.food_restrictions && h.food_restrictions.length)
    || (h.injuries && h.injuries.length) || (r && r.length));
}

module.exports = {
  TEXT_LIMITS,
  MAX_ITEMS,
  MIN_AGE,
  PHYSIO_RANGES,
  RESTRICTION_CATALOG,
  CONDITION_CATALOG,
  INJURY_KEYS,
  OnboardingInputError,
  computeAge,
  normalizeProfileInput,
  assertStoredProfileValid,
  normalizeLifestyleInput,
  normalizeTrainingInput,
  normalizeNutritionInput,
  normalizeDietType,
  normalizeMotivationInput,
  normalizeRestrictions,
  normalizeConditions,
  normalizeInjuries,
  normalizeInjuriesSafe,
  canonicalInjuryKey,
  serializeInjuries,
  injuryLabel,
  normalizeHealthInput,
  normalizeAnswers,
  normalizeCompletePayload,
  hasHealthData,
};
