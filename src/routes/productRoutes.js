const express = require('express');
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../config/cloudinary');

const router = express.Router();

// Public Routes
router.get('/', productController.getProducts);

// Admin Only Routes
router.post(
    '/',
    protect,
    restrictTo('admin'),
    upload.array('images', 5), // Allow up to 5 images per product
    productController.addProduct
);

// PATCH for partial updates
router.patch(
    '/:id',
    protect,
    restrictTo('admin'),
    upload.array('images', 5), // limit to 5 files
    productController.editProduct
);

router.delete('/:id', protect, restrictTo('admin'), productController.deleteProduct);

module.exports = router;