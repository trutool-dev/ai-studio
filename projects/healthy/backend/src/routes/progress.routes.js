const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ctrl = require('../controllers/progress.controller');

router.use(authenticate);

router.get('/', ctrl.getProgress);

// POST /progress — registrar nueva medición
router.post('/',
  [
    body('log_date').notEmpty().isISO8601().withMessage('Fecha inválida (ISO8601 requerido)'),
    body('weight_kg').optional().isFloat({ gt: 0 }).withMessage('weight_kg debe ser positivo'),
    body('body_fat_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('body_fat_percentage debe estar entre 0 y 100'),
    body('muscle_mass_kg').optional().isFloat({ gt: 0 }).withMessage('muscle_mass_kg debe ser positivo'),
    body('waist_cm').optional().isFloat({ gt: 0 }).withMessage('waist_cm debe ser positivo'),
    body('hip_cm').optional().isFloat({ gt: 0 }).withMessage('hip_cm debe ser positivo'),
    body('chest_cm').optional().isFloat({ gt: 0 }).withMessage('chest_cm debe ser positivo'),
    body('photo_url').optional().isURL().withMessage('photo_url debe ser una URL válida'),
  ],
  validate, ctrl.createProgress);

router.get('/stats', ctrl.getStats);

module.exports = router;
