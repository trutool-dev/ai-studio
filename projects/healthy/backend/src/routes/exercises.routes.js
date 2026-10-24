/**
 * Rutas del catálogo de ejercicios.
 * Expone endpoints para consultar y filtrar ejercicios del dataset real.
 *
 * Implementa: BE-EX-04
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
// SEC-62 (SA-27): cliente Prisma compartido (antes se creaba un Pool + PrismaClient por petición)
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const { parseIntInRange, parseOptionalString } = require('../utils/query.util');

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const MAX_OFFSET = 10000;

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
    // SEC-52: los filtros solo pueden ser cadenas acotadas (nunca objetos/arrays)
    const filters = {};
    for (const name of ['category', 'equipment', 'difficulty', 'target']) {
      const parsed = parseOptionalString(req.query[name], 100);
      if (!parsed.ok) {
        return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `${name} no es válido` });
      }
      filters[name] = parsed.value;
    }
    if (filters.difficulty && !DIFFICULTIES.includes(filters.difficulty)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: `difficulty debe ser uno de: ${DIFFICULTIES.join(', ')}` });
    }

    const where = { externalId: { not: null } };
    if (filters.category) where.category = filters.category;
    if (filters.equipment) where.equipment = filters.equipment;
    if (filters.difficulty) where.difficulty = filters.difficulty;
    if (filters.target) where.target = { contains: filters.target, mode: 'insensitive' };

    const parsedLimit = parseIntInRange(req.query.limit, { def: 20, min: 1, max: 100 });
    const parsedOffset = parseIntInRange(req.query.offset, { def: 0, min: 0, max: MAX_OFFSET });

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

    return res.json({
      success: true,
      data: { exercises, total, limit: parsedLimit, offset: parsedOffset },
      message: 'Ejercicios obtenidos correctamente',
    });
  } catch (error) {
    logger.error(`[exercises] Error al listar ejercicios: ${error && error.message}`);
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
    const { id } = req.params;
    if (typeof id !== 'string' || id.length > 64) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Ejercicio no encontrado' });
    }
    const exercise = await prisma.exercise.findUnique({ where: { id } });

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
    logger.error(`[exercises] Error al obtener el ejercicio: ${error && error.message}`);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error al obtener ejercicio',
    });
  }
});

module.exports = router;
