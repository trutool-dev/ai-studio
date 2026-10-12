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

// Zonas corporales a excluir por tipo de lesión
const INJURY_ZONES = {
  'knee': ['quadriceps', 'hamstrings', 'calves', 'glutes'],
  'lower_back': ['spine', 'lower back', 'lats'],
  'shoulder': ['shoulders', 'triceps', 'chest'],
  'wrist': ['forearms', 'biceps', 'triceps'],
  'ankle': ['calves', 'hamstrings'],
  'neck': ['traps', 'neck'],
};

/**
 * Construye la lista de zonas a excluir según las lesiones del usuario.
 * @param {string[]} injuries
 * @returns {string[]} Zonas únicas a excluir
 */
function buildInjuryExclusions(injuries) {
  const zones = [];
  for (const injury of injuries) {
    const affected = INJURY_ZONES[injury] || [];
    zones.push(...affected);
  }
  return [...new Set(zones)]; // Eliminar duplicados
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

    // Excluir ejercicios que afecten zonas lesionadas
    // injuries es un array de strings como ['knee', 'lower_back', 'shoulder']
    if (profile.injuries && profile.injuries.length > 0) {
      const injuryExclusions = buildInjuryExclusions(profile.injuries);
      if (injuryExclusions.length > 0) {
        where.AND = injuryExclusions.map(zone => ({
          target: { not: { contains: zone, mode: 'insensitive' } },
        }));
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

    return exercises;
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

module.exports = { getExercisesForProfile, formatExercisesForPrompt };
