/**
 * Rutas de autenticación (BE-01).
 * Las rutas sensibles tienen authRateLimiter (max 5 req / 15min por IP).
 */

const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authRateLimiter } = require('../middleware/rateLimiter.middleware');
const ctrl = require('../controllers/auth.controller');

// POST /auth/register
router.post('/register', authRateLimiter,
  [body('email').isEmail().withMessage('Email inválido'), body('phone_number').optional()],
  validate, ctrl.register);

// POST /auth/verify-email
router.post('/verify-email', authRateLimiter,
  [body('email').isEmail(), body('code').isLength({ min: 6, max: 6 }).withMessage('Código de 6 dígitos')],
  validate, ctrl.verifyEmail);

// POST /auth/set-password
router.post('/set-password',
  [body('email').isEmail(), body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')],
  validate, ctrl.setPassword);

// POST /auth/login
router.post('/login', authRateLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate, ctrl.login);

// POST /auth/forgot-password
router.post('/forgot-password', authRateLimiter,
  [body('email').isEmail()], validate, ctrl.forgotPassword);

// POST /auth/reset-password
router.post('/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 8 })],
  validate, ctrl.resetPassword);

// POST /auth/resend-code
router.post('/resend-code', authRateLimiter,
  [body('email').isEmail()], validate, ctrl.resendCode);

// POST /auth/refresh — Rotar refresh token
router.post('/refresh',
  [body('refresh_token').notEmpty().withMessage('Refresh token requerido')],
  validate, ctrl.refresh);

// Debug — solo staging/dev (el controlador lo bloquea en NODE_ENV=production)
router.get('/dev/code', ctrl.getDevCode);
router.post('/dev/auto-verify', [body('email').isEmail()], validate, ctrl.devAutoVerify);

// Rutas protegidas
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

module.exports = router;
