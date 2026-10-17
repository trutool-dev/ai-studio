/**
 * Controlador de nutrición (BE-04).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');

/** GET /nutrition/meals — Comidas del día actual (solo del plan activo) */
const getMeals = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const activePlan = await prisma.plan.findFirst({ where: { user_id: userId, status: 'active' } });

    const meals = await prisma.meal.findMany({
      where: {
        user_id: userId,
        scheduled_date: { gte: startOfDay, lte: endOfDay },
        ...(activePlan ? { plan_id: activePlan.id } : {}),
      },
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

/** POST /nutrition/meals/:mealId/foods — Añadir alimento a una comida */
const addFoodToMeal = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { mealId } = req.params;
    const { food_id, quantity_g = 100 } = req.body;

    if (!food_id) return sendError(res, 'VALIDATION_ERROR', 'food_id es requerido', 400);

    const meal = await prisma.meal.findFirst({ where: { id: mealId, user_id: userId } });
    if (!meal) return sendError(res, 'NOT_FOUND', 'Comida no encontrada', 404);

    const food = await prisma.food.findUnique({ where: { id: food_id } });
    if (!food) return sendError(res, 'NOT_FOUND', 'Alimento no encontrado', 404);

    // Crear el registro meal_foods
    await prisma.mealFood.create({
      data: { meal_id: mealId, food_id, quantity_g: parseFloat(quantity_g) },
    });

    // Recalcular macros de la comida sumando todos sus alimentos
    const mealFoods = await prisma.mealFood.findMany({
      where: { meal_id: mealId },
      include: { food: true },
    });

    const totals = mealFoods.reduce((acc, mf) => {
      const r = parseFloat(mf.quantity_g) / 100;
      return {
        calories:  acc.calories  + (parseFloat(mf.food.calories_per_100g)  || 0) * r,
        protein_g: acc.protein_g + (parseFloat(mf.food.protein_per_100g)   || 0) * r,
        carbs_g:   acc.carbs_g   + (parseFloat(mf.food.carbs_per_100g)     || 0) * r,
        fat_g:     acc.fat_g     + (parseFloat(mf.food.fat_per_100g)       || 0) * r,
      };
    }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    const updatedMeal = await prisma.meal.update({
      where: { id: mealId },
      data: {
        calories:  Math.round(totals.calories),
        protein_g: totals.protein_g.toFixed(1),
        carbs_g:   totals.carbs_g.toFixed(1),
        fat_g:     totals.fat_g.toFixed(1),
      },
      include: { meal_foods: { include: { food: true } } },
    });

    logger.info(`[nutrition] Alimento ${food_id} añadido a comida ${mealId} (${quantity_g}g)`);
    return sendSuccess(res, { meal: updatedMeal }, 'Alimento añadido correctamente');
  } catch (err) { next(err); }
};

module.exports = { getMeals, completeMeal, addFoodToMeal };
