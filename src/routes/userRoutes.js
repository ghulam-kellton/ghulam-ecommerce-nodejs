const express = require('express');
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin Only Routes
router.get(
    '/',
    protect,
    restrictTo('admin'),
    userController.getUsers
);

// PATCH for partial updates
router.patch(
    '/:id',
    protect,
    restrictTo('admin'),
    userController.editUser
);

router.delete('/:id', protect, restrictTo('admin'), userController.deleteUser);

module.exports = router;