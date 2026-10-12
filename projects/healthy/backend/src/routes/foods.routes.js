const router = require('express').Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/foods.controller');

router.use(authenticate);

router.get('/search', ctrl.searchFoods);
router.get('/barcode/:code', ctrl.getFoodByBarcode);

module.exports = router;
