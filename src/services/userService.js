const User = require('../models/userModel');

exports.getAllUsers = async () => {
    return await User.find().select('-password');
};

exports.deleteUser = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // 2. Delete user from Database
    return await User.findByIdAndDelete(userId);
};

exports.updateUser = async (userId, updateData) => {
    // 1. Check if user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
    ).select('-password');

    return updatedUser;
};