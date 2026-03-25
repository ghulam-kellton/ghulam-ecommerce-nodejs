const express = require('express');
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All order routes require login
router.use(protect);

router.post('/checkout', orderController.checkout);
router.get('/my-orders', orderController.getMyOrders);
// POST /api/v1/orders/checkout-session
router.post('/checkout-session', orderController.getCheckoutSession);

module.exports = router;