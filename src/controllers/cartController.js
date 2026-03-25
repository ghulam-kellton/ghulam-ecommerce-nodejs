const cartService = require('../services/cartService');

exports.addItem = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;
        const cart = await cartService.addToCart(req.user.id, productId, quantity);

        res.status(200).json({ success: true, data: cart });
    } catch (error) {
        next(error);
    }
};

exports.viewCart = async (req, res, next) => {
    try {
        const cart = await cartService.getCart(req.user.id);
        res.status(200).json({ success: true, data: cart });
    } catch (error) {
        next(error);
    }
};

exports.clearCart = async (req, res, next) => {
    try {
        // req.user.id comes from the 'protect' middleware
        await cartService.clearUserCart(req.user.id);

        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully',
            data: []
        });
    } catch (error) {
        next(error);
    }
};