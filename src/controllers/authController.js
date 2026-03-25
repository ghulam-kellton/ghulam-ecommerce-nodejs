const authService = require('../services/authService');

exports.signup = async (req, res, next) => {
    try {
        const { token, user } = await authService.register(req.body);
        res.status(201).json({
            status: 'success',
            token,
            data: { user }
        });
    } catch (err) {
        next(err); // Passes to the global error handler
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const { token, user } = await authService.login(email, password);
        res.status(200).json({
            status: 'success',
            token,
            data: { user }
        });
    } catch (err) {
        next(err);
    }
};