/**
 * Rutas de autenticación (BE-01).
 * Todas las rutas públicas tienen limitador (SEC-43 / SA-12): por IP y, en las que
 * envían emails o validan credenciales, también por email (hash). Ver rateLimiter.middleware.js.
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const {
  authRateLimiter, registrationLimiter, verifyLimiter, setPasswordLimiter, forgotPasswordLimiter,
  resetPasswordLimiter, refreshLimiter, devEndpointsLimiter, loginEmailLimiter, emailActionLimiter,
} = require('../middleware/rateLimiter.middleware');
const ctrl = require('../controllers/auth.controller');

// POST /auth/register — SEC-05: máx 3 cuentas/hora por IP
router.post('/register', registrationLimiter, authRateLimiter, emailActionLimiter,
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('phone_number').optional(),
    // SEC-33: si se envía, el consentimiento debe ser booleano estricto (no "true", 1, fechas...)
    body('health_consent').optional().custom((v) => typeof v === 'boolean').withMessage('health_consent debe ser booleano'),
  ],
  validate, ctrl.register);

// POST /auth/verify-email
// (los intentos por código los limita además el contador OTP, SEC-31)
router.post('/verify-email', verifyLimiter,
  [body('email').isEmail(), body('code').isLength({ min: 6, max: 6 }).withMessage('Código de 6 dígitos')],
  validate, ctrl.verifyEmail);

// POST /auth/set-password — SEC-27: exige el OTP verificado (prueba de posesión de un solo uso)
router.post('/set-password', setPasswordLimiter,
  [
    body('email').isEmail(),
    body('code').isString().matches(/^\d{6}$/).withMessage('Código de 6 dígitos'),
    body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
  ],
  validate, ctrl.setPassword);

// POST /auth/login
router.post('/login', authRateLimiter, loginEmailLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate, ctrl.login);

// POST /auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, emailActionLimiter,
  [body('email').isEmail()], validate, ctrl.forgotPassword);

// POST /auth/reset-password
router.post('/reset-password', resetPasswordLimiter,
  [body('token').notEmpty(), body('password').isLength({ min: 8 })],
  validate, ctrl.resetPassword);

// POST /auth/resend-code
router.post('/resend-code', authRateLimiter, emailActionLimiter,
  [body('email').isEmail()], validate, ctrl.resendCode);

// POST /auth/refresh — Rotar refresh token
router.post('/refresh', refreshLimiter,
  [body('refresh_token').notEmpty().withMessage('Refresh token requerido')],
  validate, ctrl.refresh);

// Debug — SEC-30 (SA-04): deshabilitados por defecto (404). Requieren ENABLE_DEV_ENDPOINTS=true,
// NODE_ENV en allowlist y cabecera X-Dev-Token. El email va en el body, nunca en la query (SA-22).
router.post('/dev/code', devEndpointsLimiter, ctrl.requireDevEndpoints,
  [body('email').isEmail()], validate, ctrl.getDevCode);
router.post('/dev/auto-verify', devEndpointsLimiter, ctrl.requireDevEndpoints,
  [body('email').isEmail(), body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')],
  validate, ctrl.devAutoVerify);

// Rutas protegidas
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
