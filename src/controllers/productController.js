const categoryService = require('../services/categoryService');
const productService = require('../services/productService');

exports.getProducts = async (req, res, next) => {
    try {
        const products = await productService.getAllProducts(req.query);
        res.status(200).json({ status: 'success', results: products.length, data: { products } });
    } catch (err) { next(err); }
};

exports.addProduct = async (req, res, next) => {
    try {
        // req.files is populated by Multer
        if (req.files) {
            req.body.images = req.files.map(file => file.path);
        }
        // If 'category' is a string name, convert it to an ID
        if (typeof req.body.category === 'string' && req.body.category.length !== 24 && !req.body.category.startsWith('{{')) {
            req.body.category = await categoryService.getOrCreateCategory(req.body.category);
        }
        const product = await productService.createProduct(req.body);
        res.status(201).json({ status: 'success', data: { product } });
    } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
    try {
        await productService.deleteProduct(req.params.id);

        res.status(204).json({
            status: 'success',
            data: null
        });
    } catch (err) {
        next(err);
    }
};

exports.editProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const updateData = req.body;

        // req.files is populated by Multer
        if (req.files) {
            req.body.images = req.files.map(file => file.path);
        }

        // Call service to handle the logic
        const updatedProduct = await productService.updateProduct(productId, updateData);

        // Return standardized response
        return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: updatedProduct
        });
    } catch (error) {
        // Pass error to the global error handler
        next(error);
    }
};