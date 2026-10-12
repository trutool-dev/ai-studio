/**
 * Controlador de búsqueda de alimentos (BE-04).
 * Incluye caché Redis por 6h en búsquedas por texto (BE-09).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const redis = require('../services/redis.service');

const FOOD_SEARCH_TTL = 21600; // 6 horas

/** GET /foods/search?q= */
const searchFoods = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return sendError(res, 'QUERY_TOO_SHORT', 'La búsqueda debe tener al menos 2 caracteres', 400);
    }

    const query = q.trim().toLowerCase();
    const cacheKey = `foods:search:${query}`;

    // Verificar caché (BE-09) — Redis es opcional: si no está disponible, se consulta BD directamente
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return sendSuccess(res, { foods: JSON.parse(cached), from_cache: true }, 'Alimentos encontrados');
      }
    } catch (redisErr) {
      logger.warn(`[foods] Redis no disponible, consultando BD directamente: ${redisErr.message}`);
    }

    const foods = await prisma.food.findMany({
      where: { name: { contains: q.trim(), mode: 'insensitive' } },
      take: 20,
      orderBy: [{ verified: 'desc' }, { name: 'asc' }],
    });

    try {
      await redis.set(cacheKey, JSON.stringify(foods), 'EX', FOOD_SEARCH_TTL);
    } catch (redisErr) {
      logger.warn(`[foods] Redis no disponible, resultado no cacheado: ${redisErr.message}`);
    }
    return sendSuccess(res, { foods, total: foods.length, from_cache: false }, 'Alimentos encontrados');
  } catch (err) { next(err); }
};

/** GET /foods/barcode/:code */
const getFoodByBarcode = async (req, res, next) => {
  try {
    const { code } = req.params;
    const food = await prisma.food.findUnique({ where: { barcode: code } });
    if (!food) return sendError(res, 'NOT_FOUND', `No se encontró alimento con código de barras: ${code}`, 404);
    return sendSuccess(res, { food }, 'Alimento encontrado');
  } catch (err) { next(err); }
};

module.exports = { searchFoods, getFoodByBarcode };
