const express = require('express');
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All order routes require login
router.use(protect);

router.get('/', cartController.viewCart);
router.post('/add', cartController.addItem);
router.delete('/', cartController.clearCart);

module.exports = router;