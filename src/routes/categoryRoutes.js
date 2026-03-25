const express = require('express');
const categoryController = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// Public: Everyone can see categories
router.get('/', categoryController.getAllCategories);

// Protected: Only Admin can manage categories
router.use(protect, restrictTo('admin'));

router.post('/', categoryController.createCategory);
router.delete('/:id', categoryController.deleteCategory);

// PATCH is preferred for partial updates
router.patch('/:id', categoryController.editCategory);

module.exports = router;