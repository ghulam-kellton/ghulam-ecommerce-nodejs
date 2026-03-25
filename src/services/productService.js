const Product = require('../models/productModel');
const { deleteImageFromCloudinary } = require('../utils/cloudinaryHelper');

exports.createProduct = async (productData) => {
    return await Product.create(productData);
};

exports.getAllProducts = async (filters) => {
    // Simple filtering (can be expanded to include price ranges, etc.)
    const query = {};
    if (filters.category) query.category = filters.category;

    return await Product.find(query).populate('category', 'name');
};

exports.getProductById = async (id) => {
    const product = await Product.findById(id).populate('category');
    if (!product) throw new Error('Product not found');
    return product;
};

exports.deleteProduct = async (productId) => {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');

    // 1. Delete all associated images from Cloudinary
    if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(imgUrl => deleteImageFromCloudinary(imgUrl));
        await Promise.all(deletePromises);
    }

    // 2. Delete product from Database
    return await Product.findByIdAndDelete(productId);
};

exports.updateProduct = async (productId, updateData) => {
    // 1. Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error('Product not found');
    }

    // 2. If name is being updated, we might need to regenerate the slug
    // (This assumes your model has a slug field)
    if (updateData.name) {
        updateData.slug = updateData.name.toLowerCase().split(' ').join('-');
    }

    // 3. Perform the update
    // { new: true } returns the document AFTER the update
    // { runValidators: true } ensures the new data follows Schema rules (e.g., price > 0)
    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
    );

    return updatedProduct;
};