/**
 * Servicio de selección de ejercicios del catálogo real.
 * Filtra ejercicios según equipamiento, lesiones y nivel del usuario
 * para pasar al generador de planes de IA.
 *
 * Implementa: BE-EX-01
 */

const { PrismaClient } = require('../generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { sanitizeTextField } = require('../validation/promptSanitizer');
const { canonicalInjuryKey } = require('../validation/onboardingInput');

// Mapeo de equipamiento del onboarding → nombre en el dataset
const EQUIPMENT_MAP = {
  'none': ['body weight'],
  'dumbbells': ['dumbbell', 'body weight'],
  'barbell': ['barbell', 'dumbbell', 'body weight'],
  'gym_full': null, // null = sin filtro (todo el equipamiento disponible)
  'resistance_bands': ['band', 'body weight'],
  'kettlebells': ['kettlebell', 'body weight'],
  // Alias del schema de onboarding
  'bands': ['band', 'body weight'],
  'machines': null,
  'full': null,
};

// Grupos musculares del objetivo → categorías del dataset (valores en minúsculas como en BD)
const GOAL_TO_CATEGORIES = {
  'weight_loss': ['cardio', 'waist', 'legs', 'back'],
  'lose_weight': ['cardio', 'waist', 'legs', 'back'],
  'muscle_gain': ['chest', 'back', 'shoulders', 'arms', 'legs'],
  'gain_muscle': ['chest', 'back', 'shoulders', 'arms', 'legs'],
  'strength': ['chest', 'back', 'legs', 'shoulders'],
  'endurance': ['cardio', 'legs', 'back'],
  'flexibility': ['waist', 'legs', 'shoulders'],
  'wellness': null, // null = sin filtro de categoría
  'maintain': null,
  'general_health': null,
};

// Nivel de dificultad del onboarding → dificultad del dataset
const DIFFICULTY_MAP = {
  'beginner': ['beginner'],
  'intermediate': ['beginner', 'intermediate'],
  'advanced': ['beginner', 'intermediate', 'advanced'],
};

// SEC-58 (JB-15): claves canónicas = las que envía el frontend (OnboardingHealth.tsx),
// compartidas con validation/onboardingInput (alias lower_back → back, rodilla → knee...).
// Para cada lesión: músculos (target / secondaryMuscles) y zonas (bodyPart) a excluir.
const INJURY_ZONES = {
  knee:     { muscles: ['quads', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'adductors', 'abductors'], bodyParts: ['upper legs', 'lower legs'] },
  back:     { muscles: ['spine', 'lower back', 'erector spinae', 'lats', 'upper back'], bodyParts: ['back'] },
  shoulder: { muscles: ['delts', 'deltoids', 'shoulders', 'rotator cuff', 'triceps', 'pectorals', 'chest', 'serratus anterior'], bodyParts: ['shoulders', 'chest'] },
  wrist:    { muscles: ['forearms', 'wrists', 'wrist flexors', 'wrist extensors', 'grip muscles', 'biceps', 'triceps'], bodyParts: ['lower arms', 'upper arms'] },
  ankle:    { muscles: ['calves', 'ankles', 'soleus', 'tibialis anterior', 'hamstrings'], bodyParts: ['lower legs'] },
  neck:     { muscles: ['traps', 'trapezius', 'levator scapulae', 'neck', 'sternocleidomastoid'], bodyParts: ['neck'] },
  hip:      { muscles: ['glutes', 'hip flexors', 'adductors', 'abductors', 'hamstrings'], bodyParts: ['upper legs'] },
};

/**
 * Construye las exclusiones según las lesiones del usuario (claves del frontend
 * o alias antiguos). Las claves desconocidas (texto libre) no excluyen nada aquí:
 * llegan al prompt como lesión declarada.
 * @param {string[]} injuries
 * @returns {{ muscles: string[], bodyParts: string[] }}
 */
function buildInjuryExclusions(injuries) {
  const muscles = new Set();
  const bodyParts = new Set();
  for (const injury of injuries || []) {
    const key = canonicalInjuryKey(injury);
    const zone = key && INJURY_ZONES[key];
    if (!zone) continue;
    zone.muscles.forEach((m) => muscles.add(m));
    zone.bodyParts.forEach((b) => bodyParts.add(b));
  }
  return { muscles: [...muscles], bodyParts: [...bodyParts] };
}

/** ¿El ejercicio carga alguna zona excluida? (comprobación en memoria, sin distinguir mayúsculas) */
function loadsExcludedZone(exercise, exclusions) {
  const lc = (s) => (typeof s === 'string' ? s.toLowerCase() : '');
  const target = lc(exercise.target);
  const bodyPart = lc(exercise.bodyPart);
  const secondary = Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.map(lc) : [];
  return exclusions.muscles.some((m) => target.includes(m) || secondary.some((s) => s.includes(m)))
    || exclusions.bodyParts.some((b) => bodyPart === b);
}

/**
 * Sanitiza los campos de texto de un ejercicio del catálogo externo.
 * Protege contra indirect prompt injection (SEC-15/SEC-58, MITRE ATLAS AML.T0051.002):
 * NFKC, sin Cc/Cf (anchos cero, U+2066-2069, bidi, U+00AD), `<`/`>` escapados.
 */
function sanitizeCatalogExercise(exercise) {
  const maxLen = (s, n) => (typeof s === 'string' ? sanitizeTextField(s, n) : s);
  return {
    ...exercise,
    name:            maxLen(exercise.name, 100),
    bodyPart:        maxLen(exercise.bodyPart, 50),
    target:          maxLen(exercise.target, 50),
    equipment:       maxLen(exercise.equipment, 50),
    instructionsEn:  maxLen(exercise.instructionsEn, 300),
    instructionsEs:  maxLen(exercise.instructionsEs, 300),
    secondaryMuscles: Array.isArray(exercise.secondaryMuscles)
      ? exercise.secondaryMuscles.slice(0, 5).map(m => maxLen(m, 30))
      : [],
  };
}

/**
 * Obtiene ejercicios filtrados del catálogo real según perfil del usuario.
 * Si el perfil no es válido o no se encuentran ejercicios, devuelve array vacío sin lanzar error.
 *
 * @param {object} profile - Perfil del usuario del onboarding
 * @param {string[]} [profile.injuries] - Lesiones a evitar
 * @param {string} [profile.equipment] - Equipamiento disponible
 * @param {string} [profile.goal] - Objetivo principal
 * @param {string} [profile.experience_level] - Nivel de experiencia
 * @param {number} [limit=80] - Máximo de ejercicios a devolver
 * @returns {Promise<object[]>} Lista de ejercicios filtrados
 */
async function getExercisesForProfile(profile, limit = 80) {
  // Validación defensiva: si el perfil no es válido, devolver vacío
  if (!profile || typeof profile !== 'object') return [];

  try {
    const where = {};

    // Filtrar por equipamiento disponible
    const equipmentList = EQUIPMENT_MAP[profile.equipment];
    if (equipmentList !== null && equipmentList !== undefined) {
      where.equipment = { in: equipmentList };
    }

    // Filtrar por dificultad según experiencia
    const difficulties = DIFFICULTY_MAP[profile.experience_level] || DIFFICULTY_MAP['intermediate'];
    where.difficulty = { in: difficulties };

    // Filtrar por categorías según objetivo
    const categories = GOAL_TO_CATEGORIES[profile.goal];
    if (categories !== null && categories !== undefined) {
      where.category = { in: categories };
    }

    // Excluir ejercicios que afecten zonas lesionadas (target, bodyPart y músculos secundarios)
    // injuries: claves del frontend ['back', 'knee', ...] o alias antiguos ('lower_back')
    const exclusions = buildInjuryExclusions(Array.isArray(profile.injuries) ? profile.injuries : []);
    const hasExclusions = exclusions.muscles.length > 0 || exclusions.bodyParts.length > 0;
    if (hasExclusions) {
      where.AND = [
        ...exclusions.muscles.map((m) => ({ NOT: { target: { contains: m, mode: 'insensitive' } } })),
        ...exclusions.bodyParts.map((b) => ({ NOT: { bodyPart: { equals: b, mode: 'insensitive' } } })),
      ];
      if (exclusions.muscles.length > 0) {
        where.NOT = { secondaryMuscles: { hasSome: exclusions.muscles } };
      }
    }

    // Solo ejercicios con externalId (dataset real) — los legacy sin externalId se excluyen
    where.externalId = { not: null };

    const prisma = getPrismaClient();

    const exercises = await prisma.exercise.findMany({
      where,
      select: {
        id: true,
        externalId: true,
        name: true,
        category: true,
        bodyPart: true,
        equipment: true,
        target: true,
        secondaryMuscles: true,
        instructionsEs: true,
        instructionsEn: true,
        gifUrl: true,
        difficulty: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    // Defensa en profundidad: filtro en memoria (mayúsculas, subcadenas en secundarios)
    const safe = hasExclusions ? exercises.filter((ex) => !loadsExcludedZone(ex, exclusions)) : exercises;
    return safe.map(sanitizeCatalogExercise);
  } catch (err) {
    // No propagar el error: el generador de planes tiene fallback propio
    const logger = require('../utils/logger.util');
    logger.warn('[exerciseSelector] Error al obtener ejercicios del catálogo:', err.message);
    return [];
  }
}

/**
 * Formatea ejercicios como texto para incluir en el prompt de Claude.
 * @param {object[]} exercises
 * @returns {string}
 */
function formatExercisesForPrompt(exercises) {
  if (!exercises || exercises.length === 0) {
    return 'No hay ejercicios disponibles en el catálogo para este perfil.';
  }

  return exercises.map(ex => {
    const parts = [
      `- ${ex.name} (ID:${ex.externalId})`,
      `  Categoría: ${ex.category} | Zona: ${ex.bodyPart} | Equipo: ${ex.equipment}`,
      `  Músculo objetivo: ${ex.target}`,
    ];
    if (ex.secondaryMuscles && ex.secondaryMuscles.length > 0) {
      parts.push(`  Músculos secundarios: ${ex.secondaryMuscles.join(', ')}`);
    }
    if (ex.instructionsEs) {
      const shortInstructions = ex.instructionsEs.substring(0, 150);
      parts.push(`  Instrucciones: ${shortInstructions}...`);
    }
    return parts.join('\n');
  }).join('\n\n');
}

// Singleton del cliente Prisma (reutilizado entre llamadas para no abrir demasiadas conexiones)
let _prismaClient = null;

function getPrismaClient() {
  if (_prismaClient) return _prismaClient;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  _prismaClient = new PrismaClient({ adapter });
  return _prismaClient;
}

module.exports = { getExercisesForProfile, formatExercisesForPrompt, buildInjuryExclusions, loadsExcludedZone, sanitizeCatalogExercise, INJURY_ZONES };
