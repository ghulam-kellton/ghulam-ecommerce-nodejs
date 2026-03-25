const Product = require('../models/productModel');
const { deleteImageFromCloudinary } = require('../utils/cloudinaryHelper');

exports.createProduct = async (productData) => {
    return await Product.create(productData);
};

exports.getAllProducts = async (filters) => {
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

    // Delete all associated images from Cloudinary
    if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(imgUrl => deleteImageFromCloudinary(imgUrl));
        await Promise.all(deletePromises);
    }

    // Delete product from Database
    return await Product.findByIdAndDelete(productId);
};

exports.updateProduct = async (productId, updateData) => {
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error('Product not found');
    }

    // If name is being updated, we might need to regenerate the slug
    if (updateData.name) {
        updateData.slug = updateData.name.toLowerCase().split(' ').join('-');
    }

    // Perform the update
    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
    );

    return updatedProduct;
};