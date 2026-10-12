const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ctrl = require('../controllers/logs.controller');

router.use(authenticate);

router.get('/today', ctrl.getToday);

// PUT /logs/today — actualizar log diario (agua, sueño, energía, pasos, ánimo)
router.put('/today',
  [
    body('water_ml').optional().isInt({ min: 0 }).withMessage('water_ml debe ser un entero positivo'),
    body('sleep_hours').optional().isFloat({ min: 0, max: 24 }).withMessage('sleep_hours debe estar entre 0 y 24'),
    body('sleep_quality').optional().isInt({ min: 1, max: 5 }).withMessage('sleep_quality debe estar entre 1 y 5'),
    body('energy_level').optional().isInt({ min: 1, max: 5 }).withMessage('energy_level debe estar entre 1 y 5'),
    body('mood').optional().isInt({ min: 1, max: 5 }).withMessage('mood debe estar entre 1 y 5'),
    body('steps').optional().isInt({ min: 0 }).withMessage('steps debe ser un entero positivo'),
  ],
  validate, ctrl.updateToday);

router.get('/history', ctrl.getHistory);

module.exports = router;
