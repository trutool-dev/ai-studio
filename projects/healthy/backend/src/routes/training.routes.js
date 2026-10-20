/**
 * Rutas de entrenamiento (BE-03).
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { requireUuidParams } = require('../utils/query.util');
const ctrl = require('../controllers/training.controller');

router.use(authenticate);

// GET /training/today — Sesión programada para hoy
router.get('/today', ctrl.getTodaySession);

router.get('/sessions', ctrl.getSessions);
router.get('/sessions/:id', requireUuidParams('id'), ctrl.getSessionById);

// SEC-52 (SA-23): validación de completeSession (antes sin reglas)
const completeSessionValidation = [
  body('duration_minutes').optional({ values: 'null' })
    .isInt({ min: 1, max: 600 }).withMessage('duration_minutes debe estar entre 1 y 600').toInt(),
  body('calories_burned').optional({ values: 'null' })
    .isInt({ min: 0, max: 10000 }).withMessage('calories_burned debe estar entre 0 y 10000').toInt(),
  body('notes').optional({ values: 'null' })
    .isString().withMessage('notes debe ser texto')
    .isLength({ max: 1000 }).withMessage('notes admite como máximo 1000 caracteres'),
];
router.put('/sessions/:id/complete', requireUuidParams('id'), completeSessionValidation, validate, ctrl.completeSession);

// BE-03: Registrar serie de ejercicio
const exerciseSetsValidation = [
  body('reps').isInt({ gt: 0, max: 1000 }).withMessage('reps debe ser un entero entre 1 y 1000').toInt(),
  // SEC-52: tope acorde a la columna Decimal(6,2)
  body('weight_kg').optional().isFloat({ gt: 0, max: 1000 }).withMessage('weight_kg debe estar entre 0 y 1000').toFloat(),
  body('notes').optional().isString().isLength({ max: 1000 }),
];
const exerciseParams = requireUuidParams('id', 'exerciseId');
router.post('/sessions/:id/exercises/:exerciseId/sets', exerciseParams, exerciseSetsValidation, validate, ctrl.completeExercise);
// Alias por compatibilidad con el CLAUDE.md del backend stub
router.post('/sessions/:id/exercises/:exerciseId/complete', exerciseParams, exerciseSetsValidation, validate, ctrl.completeExercise);

module.exports = router;
