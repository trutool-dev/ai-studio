/**
 * Rutas de nutrición (BE-04).
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/nutrition.controller');

router.use(authenticate);

// GET /nutrition/today — Comidas del día actual (alias de /meals con fecha hoy)
router.get('/today', (req, res, next) => {
  req.query.date = new Date().toISOString().split('T')[0];
  return ctrl.getMeals(req, res, next);
});

router.get('/meals', ctrl.getMeals);
router.put('/meals/:id/complete', ctrl.completeMeal);

module.exports = router;
