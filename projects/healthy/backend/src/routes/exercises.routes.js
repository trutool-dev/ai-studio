/**
 * Rutas del catálogo de ejercicios.
 * Expone endpoints para consultar y filtrar ejercicios del dataset real.
 *
 * Implementa: BE-EX-04
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');

// Lazy-load del exerciseSelector para no romper tests que mockean Prisma
let exerciseSelector = null;
function getSelector() {
  if (!exerciseSelector) exerciseSelector = require('../services/exerciseSelector.service');
  return exerciseSelector;
}

/**
 * GET /exercises
 * Consulta el catálogo de ejercicios con filtros opcionales.
 *
 * Query params:
 *   category    - Categoría del ejercicio (ej: "Arms", "Legs")
 *   equipment   - Equipamiento (ej: "Dumbbell", "Body Weight")
 *   difficulty  - Dificultad (beginner | intermediate | advanced)
 *   target      - Músculo objetivo (búsqueda insensible a mayúsculas)
 *   limit       - Máximo de resultados (default: 20, max: 100)
 *   offset      - Desplazamiento para paginación (default: 0)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      category,
      equipment,
      difficulty,
      target,
      limit = 20,
      offset = 0,
    } = req.query;

    const { PrismaClient } = require('../generated/prisma');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { Pool } = require('pg');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const where = { externalId: { not: null } };
    if (category) where.category = category;
    if (equipment) where.equipment = equipment;
    if (difficulty) where.difficulty = difficulty;
    if (target) where.target = { contains: target, mode: 'insensitive' };

    const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const parsedOffset = parseInt(offset, 10) || 0;

    const [exercises, total] = await Promise.all([
      prisma.exercise.findMany({
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
          gifUrl: true,
          thumbnailUrl: true,
          difficulty: true,
        },
        take: parsedLimit,
        skip: parsedOffset,
        orderBy: { name: 'asc' },
      }),
      prisma.exercise.count({ where }),
    ]);

    await prisma.$disconnect();
    await pool.end();

    return res.json({
      success: true,
      data: { exercises, total, limit: parsedLimit, offset: parsedOffset },
      message: 'Ejercicios obtenidos correctamente',
    });
  } catch (error) {
    console.error('[exercises] Error fetching exercises:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error al obtener ejercicios',
    });
  }
});

/**
 * GET /exercises/:id
 * Detalle completo de un ejercicio por su ID interno.
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { PrismaClient } = require('../generated/prisma');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const { Pool } = require('pg');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const exercise = await prisma.exercise.findUnique({
      where: { id: req.params.id },
    });

    await prisma.$disconnect();
    await pool.end();

    if (!exercise) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ejercicio no encontrado',
      });
    }

    return res.json({
      success: true,
      data: { exercise },
      message: 'Ejercicio obtenido correctamente',
    });
  } catch (error) {
    console.error('[exercises] Error fetching exercise:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error al obtener ejercicio',
    });
  }
});

module.exports = router;
