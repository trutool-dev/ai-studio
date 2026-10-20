const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { planRegenerateLimiter } = require('../middleware/rateLimiter.middleware');
const ctrl = require('../controllers/plans.controller');
const { TEXT_LIMITS } = require('../validation/onboardingInput');

router.use(authenticate);

router.get('/', ctrl.getActivePlan);
router.get('/:id', ctrl.getPlanById);
// Limitar regeneraciones de plan a máx. 3 por usuario cada 24 horas (RGPD + control de costes IA)
// SEC-63: `reason` acotado (el controlador lo normaliza a una lista blanca)
router.post('/regenerate',
  [body('reason').optional({ values: 'null' }).isString().withMessage('reason debe ser texto')
    .bail().isLength({ max: TEXT_LIMITS.reason }).withMessage(`reason supera ${TEXT_LIMITS.reason} caracteres`)],
  validate, planRegenerateLimiter, ctrl.regeneratePlan);
router.put('/:id/pause', ctrl.pausePlan);

module.exports = router;
