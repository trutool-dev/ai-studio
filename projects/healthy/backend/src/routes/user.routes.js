/**
 * Rutas de usuario (RGPD).
 * DELETE /user/me      → derecho al olvido (Art. 17)
 * GET    /user/me/export → portabilidad de datos (Art. 20)
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

router.delete('/me', authenticate, userController.deleteAccount);
router.get('/me/profile', authenticate, userController.getProfile);
router.get('/me/export', authenticate, userController.exportData);

module.exports = router;
