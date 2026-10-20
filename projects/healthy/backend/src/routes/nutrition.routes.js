/**
 * Rutas de nutrición (BE-04).
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { requireUuidParams } = require('../utils/query.util');
const ctrl = require('../controllers/nutrition.controller');

router.use(authenticate);

// GET /nutrition/today — Comidas del día actual (alias de /meals con fecha hoy)
router.get('/today', (req, res, next) => {
  req.query.date = new Date().toISOString().split('T')[0];
  return ctrl.getMeals(req, res, next);
});

router.get('/meals', ctrl.getMeals);
router.put('/meals/:id/complete', requireUuidParams('id'), ctrl.completeMeal);

// SEC-52 (SA-23, N-1): validación de food_id y quantity_g. La propiedad de la comida
// (IDOR) se comprueba en el controlador filtrando por user_id.
router.post('/meals/:mealId/foods',
  requireUuidParams('mealId'),
  [
    body('food_id').isUUID().withMessage('food_id debe ser un UUID válido'),
    body('quantity_g').optional()
      .isFloat({ min: 1, max: 5000 }).withMessage('quantity_g debe estar entre 1 y 5000')
      .toFloat(),
  ],
  validate,
  ctrl.addFoodToMeal);

module.exports = router;
