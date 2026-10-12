const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const { planRegenerateLimiter } = require('../middleware/rateLimiter.middleware');
const ctrl = require('../controllers/plans.controller');

router.use(authenticate);

router.get('/', ctrl.getActivePlan);
router.get('/:id', ctrl.getPlanById);
// Limitar regeneraciones de plan a máx. 3 por usuario cada 24 horas (RGPD + control de costes IA)
router.post('/regenerate', planRegenerateLimiter, ctrl.regeneratePlan);
router.put('/:id/pause', ctrl.pausePlan);

module.exports = router;
