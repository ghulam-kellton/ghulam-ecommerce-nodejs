const express = require('express');
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../config/cloudinary');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Public Routes
router.get('/', productController.getProducts);

// Admin Only Routes
router.post(
    '/',
    protect,
    restrictTo(ROLES.ADMIN),
    upload.array('images', 5), // Allow up to 5 images per product
    productController.addProduct
);

// PATCH for partial updates
router.patch(
    '/:id',
    protect,
    restrictTo(ROLES.ADMIN),
    upload.array('images', 5), // limit to 5 files
    productController.editProduct
);

router.delete('/:id', protect, restrictTo(ROLES.ADMIN), productController.deleteProduct);

module.exports = router;