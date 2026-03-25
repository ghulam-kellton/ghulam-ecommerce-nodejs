const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

exports.register = async (userData) => {
    const newUser = await User.create(userData);
    const token = signToken(newUser._id);

    // Remove password from output
    newUser.password = undefined;
    return { token, user: newUser };
};

exports.login = async (email, password) => {
    // 1. Check if email and password exist
    if (!email || !password) throw new Error('Please provide email and password');

    // 2. Check if user exists & password is correct
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        throw new Error('Incorrect email or password');
    }

    // 3. If everything ok, send token
    const token = signToken(user._id);
    user.password = undefined;
    return { token, user };
};