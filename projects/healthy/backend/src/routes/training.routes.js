/**
 * Rutas de entrenamiento (BE-03).
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ctrl = require('../controllers/training.controller');

router.use(authenticate);

// GET /training/today — Sesión programada para hoy
router.get('/today', ctrl.getTodaySession);

router.get('/sessions', ctrl.getSessions);
router.get('/sessions/:id', ctrl.getSessionById);
router.put('/sessions/:id/complete', ctrl.completeSession);

// BE-03: Registrar serie de ejercicio
const exerciseSetsValidation = [
  body('reps').isInt({ gt: 0 }).withMessage('reps debe ser un entero positivo'),
  body('weight_kg').optional().isFloat({ gt: 0 }).withMessage('weight_kg debe ser positivo'),
  body('notes').optional().isString(),
];
router.post('/sessions/:id/exercises/:exerciseId/sets', exerciseSetsValidation, validate, ctrl.completeExercise);
// Alias por compatibilidad con el CLAUDE.md del backend stub
router.post('/sessions/:id/exercises/:exerciseId/complete', exerciseSetsValidation, validate, ctrl.completeExercise);

module.exports = router;
