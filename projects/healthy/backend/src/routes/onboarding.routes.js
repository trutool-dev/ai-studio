const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { planGenerationLimiter } = require('../middleware/rateLimiter.middleware');
const ctrl = require('../controllers/onboarding.controller');
const { TEXT_LIMITS, MAX_ITEMS } = require('../validation/onboardingInput');

// Todos los endpoints de onboarding requieren autenticación
router.use(authenticate);

// La normalización completa (formato del frontend y formato antiguo, edad ≥ 16,
// rangos fisiológicos, enums) se hace en validation/onboardingInput.js (SEC-28/29).
// Aquí se aplican límites baratos de tipo y longitud (SEC-63 / SA-28).
const maxText = (field, limit) => body(field).optional({ values: 'null' }).isString().withMessage(`${field} debe ser texto`)
  .bail().isLength({ max: limit }).withMessage(`${field} supera ${limit} caracteres`);
const maxArray = (field, limit) => body(field).optional({ values: 'null' }).isArray({ max: limit })
  .withMessage(`${field} debe ser un array de como máximo ${limit} elementos`);

router.post('/start', ctrl.start);

// PUT /onboarding/profile — {age|birthdate, weight_kg, height_cm, gender, body_type, goal}
router.put('/profile',
  [
    maxText('name', TEXT_LIMITS.name),
    body('birthdate').optional({ values: 'null' }).isISO8601().withMessage('Fecha de nacimiento inválida (ISO8601)'),
    body('age').optional({ values: 'null' }).isInt().withMessage('Edad inválida'),
    body('gender').optional({ values: 'null' }).isIn(['male', 'female', 'other']).withMessage('Género inválido'),
    body('weight_kg').optional({ values: 'null' }).isFloat().withMessage('Peso inválido'),
    body('height_cm').optional({ values: 'null' }).isFloat().withMessage('Altura inválida'),
  ],
  validate, ctrl.saveProfile);

// PUT /onboarding/lifestyle
router.put('/lifestyle',
  [
    maxText('profession', TEXT_LIMITS.profession),
    body('work_hours_per_day').optional({ values: 'null' }).isInt({ min: 0, max: 24 }).withMessage('Horas laborales deben estar entre 0 y 24'),
    body('stress_level').optional({ values: 'null' }).isInt({ min: 1, max: 5 }).withMessage('Nivel de estrés debe estar entre 1 y 5'),
    body('sleep_hours_usual').optional({ values: 'null' }).isFloat({ min: 0, max: 24 }).withMessage('Horas de sueño deben estar entre 0 y 24'),
    body('smoker').optional({ values: 'null' }).isBoolean({ strict: true }).withMessage('Fumador debe ser booleano'),
  ],
  validate, ctrl.saveLifestyle);

// PUT /onboarding/training — {days_per_week, equipment[], experience} o {available_days_per_week, ...}
router.put('/training',
  [
    maxArray('equipment', MAX_ITEMS.equipment),
    body('has_gym_access').optional({ values: 'null' }).isBoolean({ strict: true }).withMessage('has_gym_access debe ser booleano'),
  ],
  validate, ctrl.saveTraining);

// PUT /onboarding/nutrition — {diet_type, restrictions[], budget}
router.put('/nutrition',
  [
    maxArray('restrictions', MAX_ITEMS.restrictions),
    maxArray('food_restrictions', MAX_ITEMS.restrictions),
    maxText('restrictions.*', TEXT_LIMITS.food_name),
    body('cooks_at_home').optional({ values: 'null' }).isBoolean({ strict: true }).withMessage('cooks_at_home debe ser booleano'),
  ],
  validate, ctrl.saveNutrition);

// PUT /onboarding/health — {conditions[], injuries[], healthConsent: true}
router.put('/health',
  [
    maxArray('conditions', MAX_ITEMS.conditions),
    maxArray('injuries', MAX_ITEMS.injuries),
    maxArray('food_restrictions', MAX_ITEMS.restrictions),
    maxArray('restrictions', MAX_ITEMS.restrictions),
    maxText('conditions.*.condition_name', TEXT_LIMITS.condition_name),
    maxText('conditions.*.notes', TEXT_LIMITS.condition_notes),
    maxText('food_restrictions.*.food_name', TEXT_LIMITS.food_name),
    maxText('injuries_or_limitations', TEXT_LIMITS.injuries_or_limitations),
  ],
  validate, ctrl.saveHealth);

// DELETE /onboarding/health-consent — retirada del consentimiento art. 9 (SEC-47)
router.delete('/health-consent', ctrl.withdrawHealthConsent);

// PUT /onboarding/motivation
router.put('/motivation',
  [
    maxArray('motivations', MAX_ITEMS.motivations),
    maxText('previous_attempts_notes', TEXT_LIMITS.previous_attempts_notes),
    maxText('main_challenge', TEXT_LIMITS.main_challenge),
  ],
  validate, ctrl.saveMotivation);

// SEC-06: máx 1 plan nuevo por usuario/día
router.post('/complete',
  [
    maxArray('answers', MAX_ITEMS.answers),
    maxText('lifestyle.profession', TEXT_LIMITS.profession),
    maxText('motivation.main_challenge', TEXT_LIMITS.main_challenge),
  ],
  validate, planGenerationLimiter, ctrl.complete);

module.exports = router;
