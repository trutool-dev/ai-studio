/**
 * Rutas de usuario (RGPD).
 * DELETE /user/me        → derecho de supresión (Art. 17). Body: { password } (reautenticación)
 * GET    /user/me/export → acceso y portabilidad de datos (Art. 15/20)
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { sensitiveActionLimiter } = require('../middleware/platformRateLimit.middleware');
const userController = require('../controllers/user.controller');

// SEC-48: reautenticación con la contraseña actual y límite de intentos por usuario
router.delete('/me',
  authenticate,
  sensitiveActionLimiter,
  [body('password').isString().withMessage('Se requiere la contraseña actual')
    .bail().isLength({ min: 1, max: 200 }).withMessage('Se requiere la contraseña actual')],
  validate,
  userController.deleteAccount);
router.get('/me/profile', authenticate, userController.getProfile);
router.get('/me/export', authenticate, userController.exportData);

module.exports = router;
