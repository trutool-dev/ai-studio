const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const ctrl = require('../controllers/onboarding.controller');

// Todos los endpoints de onboarding requieren autenticación
router.use(authenticate);

router.post('/start', ctrl.start);

// PUT /onboarding/profile
router.put('/profile',
  [
    body('name').notEmpty().withMessage('El nombre es obligatorio'),
    body('birthdate').notEmpty().isISO8601().withMessage('Fecha de nacimiento inválida (ISO8601)'),
    body('gender').optional().isIn(['male', 'female']).withMessage('Género inválido'),
    body('weight_kg').optional().isFloat({ gt: 0 }).withMessage('Peso debe ser positivo'),
    body('height_cm').optional().isFloat({ gt: 0 }).withMessage('Altura debe ser positiva'),
    body('body_type').optional().isIn(['ectomorph', 'mesomorph', 'endomorph']).withMessage('Tipo de cuerpo inválido'),
    body('activity_level').optional().isIn(['sedentary', 'light', 'moderate', 'active', 'very_active']).withMessage('Nivel de actividad inválido'),
    body('goal').optional().isIn(['lose_weight', 'gain_muscle', 'maintain', 'general_health']).withMessage('Objetivo inválido'),
  ],
  validate, ctrl.saveProfile);

// PUT /onboarding/lifestyle
router.put('/lifestyle',
  [
    body('work_type').optional().isIn(['office', 'physical', 'standing', 'mixed']).withMessage('Tipo de trabajo inválido'),
    body('work_hours_per_day').optional().isInt({ min: 0, max: 24 }).withMessage('Horas laborales deben estar entre 0 y 24'),
    body('stress_level').optional().isInt({ min: 1, max: 5 }).withMessage('Nivel de estrés debe estar entre 1 y 5'),
    body('usual_schedule').optional().isIn(['morning', 'afternoon', 'night']).withMessage('Horario habitual inválido'),
    body('sleep_hours_usual').optional().isFloat({ min: 0, max: 24 }).withMessage('Horas de sueño deben estar entre 0 y 24'),
    body('sleep_quality').optional().isIn(['good', 'regular', 'bad']).withMessage('Calidad de sueño inválida'),
    body('alcohol_consumption').optional().isIn(['never', 'occasional', 'frequent']).withMessage('Consumo de alcohol inválido'),
    body('smoker').optional().isBoolean().withMessage('Fumador debe ser booleano'),
    body('daily_water_glasses').optional().isInt({ min: 0 }).withMessage('Vasos de agua debe ser un entero positivo'),
  ],
  validate, ctrl.saveLifestyle);

// PUT /onboarding/training
router.put('/training',
  [
    body('available_days_per_week').isInt({ min: 1, max: 7 }).withMessage('Días disponibles deben estar entre 1 y 7'),
    body('max_session_duration_minutes').optional().isInt({ gt: 0 }).withMessage('Duración de sesión debe ser positiva'),
    body('preferred_training_time').optional().isIn(['morning', 'afternoon', 'night']).withMessage('Horario de entrenamiento inválido'),
    body('has_gym_access').optional().isBoolean().withMessage('has_gym_access debe ser booleano'),
    body('home_equipment').optional().isIn(['none', 'dumbbells', 'bands', 'machines', 'full']).withMessage('Equipamiento inválido'),
    body('experience_level').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Nivel de experiencia inválido'),
  ],
  validate, ctrl.saveTraining);

// PUT /onboarding/nutrition
router.put('/nutrition',
  [
    body('diet_type').optional().isIn(['omnivore', 'vegetarian', 'vegan', 'gluten_free', 'lactose_free']).withMessage('Tipo de dieta inválido'),
    body('meals_per_day_preferred').optional().isInt({ min: 1, max: 8 }).withMessage('Comidas por día deben estar entre 1 y 8'),
    body('cooks_at_home').optional().isBoolean().withMessage('cooks_at_home debe ser booleano'),
    body('eats_out_frequency').optional().isIn(['never', 'sometimes', 'often', 'always']).withMessage('Frecuencia de comer fuera inválida'),
    body('monthly_food_budget_range').optional().isIn(['low', 'medium', 'high']).withMessage('Rango de presupuesto inválido'),
  ],
  validate, ctrl.saveNutrition);

// PUT /onboarding/health
router.put('/health',
  [
    body('conditions').optional().isArray().withMessage('conditions debe ser un array'),
    body('conditions.*.condition_name').if(body('conditions').exists()).notEmpty().withMessage('condition_name es obligatorio'),
    body('conditions.*.condition_type').optional().isString().withMessage('condition_type inválido'),
    body('conditions.*.affects_training').optional().isBoolean(),
    body('conditions.*.affects_nutrition').optional().isBoolean(),
    body('food_restrictions').optional().isArray().withMessage('food_restrictions debe ser un array'),
    body('food_restrictions.*.restriction_type').if(body('food_restrictions').exists()).isIn(['allergy', 'intolerance', 'dislike']).withMessage('restriction_type inválido'),
    body('food_restrictions.*.food_name').if(body('food_restrictions').exists()).notEmpty().withMessage('food_name es obligatorio'),
    body('food_restrictions.*.severity').optional().isIn(['mild', 'moderate', 'severe']).withMessage('severity inválida'),
  ],
  validate, ctrl.saveHealth);

// PUT /onboarding/motivation
router.put('/motivation',
  [
    body('main_motivation').optional().isIn(['health', 'aesthetics', 'performance', 'mental_wellbeing']).withMessage('Motivación principal inválida'),
    body('previous_attempts').optional().isBoolean().withMessage('previous_attempts debe ser booleano'),
    body('tracking_preference').optional().isIn(['detailed', 'basic', 'results_only']).withMessage('Preferencia de seguimiento inválida'),
    body('has_support_network').optional().isBoolean().withMessage('has_support_network debe ser booleano'),
  ],
  validate, ctrl.saveMotivation);

router.post('/complete', ctrl.complete);

module.exports = router;
