const express = require('express');
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Admin Only Routes
router.get(
    '/',
    protect,
    restrictTo(ROLES.ADMIN),
    userController.getUsers
);

// PATCH for partial updates
router.patch(
    '/:id',
    protect,
    restrictTo(ROLES.ADMIN),
    userController.editUser
);

router.delete('/:id', protect, restrictTo(ROLES.ADMIN), userController.deleteUser);

module.exports = router;