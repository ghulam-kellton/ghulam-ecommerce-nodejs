const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

exports.addToCart = async (userId, productId, quantity = 1) => {
    // Verify product exists and is in stock
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.stock < quantity) throw new Error('Not enough stock available');

    // Find user's cart or create a new one
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }

    // Check if product already exists in cart
    const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);

    if (itemIndex > -1) {
        // Product exists, update quantity
        cart.items[itemIndex].quantity += quantity;
    } else {
        // Product does not exist, push to array
        cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    return cart.populate('items.product', 'name price images');
}

/**
 * Get user's current cart
 */
exports.getCart = async (userId) => {
    const cart = await Cart.findOne({ user: userId }).populate('items.product', 'name price images stock');
    if (!cart) {
        // Return an empty structure if no cart exists yet
        return { user: userId, items: [] };
    }
    return cart;
}

/**
 * Clear all items from a user's cart
 * @param {String} userId 
 */
exports.clearUserCart = async (userId) => {
    const cart = await Cart.findOneAndUpdate(
        { user: userId },
        { $set: { items: [] } },
        { new: true }
    );

    if (!cart) {
        throw new Error('Cart not found for this user');
    }

    return cart;
}