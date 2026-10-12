/**
 * Controlador de nutrición (BE-04).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');

/** GET /nutrition/meals — Comidas del día actual */
const getMeals = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const meals = await prisma.meal.findMany({
      where: { user_id: userId, scheduled_date: { gte: startOfDay, lte: endOfDay } },
      include: { meal_foods: { include: { food: true } } },
      orderBy: { scheduled_date: 'asc' },
    });

    const totals = meals.reduce((acc, meal) => ({
      calories: acc.calories + (meal.calories || 0),
      protein_g: acc.protein_g + parseFloat(meal.protein_g || 0),
      carbs_g: acc.carbs_g + parseFloat(meal.carbs_g || 0),
      fat_g: acc.fat_g + parseFloat(meal.fat_g || 0),
      completed: acc.completed + (meal.status === 'completed' ? 1 : 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, completed: 0 });

    return sendSuccess(res, { meals, totals, total_meals: meals.length }, 'Comidas del día');
  } catch (err) { next(err); }
};

/** PUT /nutrition/meals/:id/complete */
const completeMeal = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const meal = await prisma.meal.findFirst({ where: { id, user_id: userId } });
    if (!meal) return sendError(res, 'NOT_FOUND', 'Comida no encontrada', 404);
    if (meal.status === 'completed') return sendError(res, 'MEAL_ALREADY_COMPLETED', 'Esta comida ya fue completada', 400);

    const updated = await prisma.meal.update({ where: { id }, data: { status: 'completed' } });
    return sendSuccess(res, { meal: updated }, 'Comida marcada como completada');
  } catch (err) { next(err); }
};

module.exports = { getMeals, completeMeal };
