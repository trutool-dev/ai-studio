const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ctrl = require('../controllers/progress.controller');

/**
 * Hosts permitidos para photo_url (PHOTO_URL_ALLOWED_HOSTS, separados por comas).
 * Se acepta el host exacto o un subdominio suyo. Por defecto (variable vacía) NO se
 * permite ningún host: la app no tiene almacenamiento propio de fotos y una URL
 * arbitraria permitiría seguimiento por píxel o contenido no deseado (SA-29).
 */
function allowedPhotoHosts() {
  return (process.env.PHOTO_URL_ALLOWED_HOSTS || '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
}

function isAllowedPhotoUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return allowedPhotoHosts().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

router.use(authenticate);

router.get('/', ctrl.getProgress);

// POST /progress — registrar nueva medición
router.post('/',
  [
    body('log_date').notEmpty().isISO8601().withMessage('Fecha inválida (ISO8601 requerido)'),
    body('weight_kg').optional().isFloat({ gt: 0, max: 999 }).withMessage('weight_kg debe estar entre 0 y 999'),
    body('body_fat_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('body_fat_percentage debe estar entre 0 y 100'),
    body('muscle_mass_kg').optional().isFloat({ gt: 0, max: 999 }).withMessage('muscle_mass_kg debe estar entre 0 y 999'),
    body('waist_cm').optional().isFloat({ gt: 0, max: 999 }).withMessage('waist_cm debe estar entre 0 y 999'),
    body('hip_cm').optional().isFloat({ gt: 0, max: 999 }).withMessage('hip_cm debe estar entre 0 y 999'),
    body('chest_cm').optional().isFloat({ gt: 0, max: 999 }).withMessage('chest_cm debe estar entre 0 y 999'),
    // SEC-52 / SA-28: texto libre acotado
    body('notes').optional({ values: 'null' }).isString().withMessage('notes debe ser texto')
      .isLength({ max: 1000 }).withMessage('notes admite como máximo 1000 caracteres'),
    // SEC-64 (SA-29): solo https y host en PHOTO_URL_ALLOWED_HOSTS
    body('photo_url').optional({ values: 'null' }).custom(isAllowedPhotoUrl)
      .withMessage('photo_url debe ser una URL https de un host permitido'),
  ],
  validate, ctrl.createProgress);

router.get('/stats', ctrl.getStats);

module.exports = router;
module.exports.isAllowedPhotoUrl = isAllowedPhotoUrl;
