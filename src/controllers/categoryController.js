const categoryService = require('../services/categoryService');

exports.createCategory = async (req, res, next) => {
    try {
        const category = await categoryService.createCategory(req.body);
        res.status(201).json({ status: 'success', data: { category } });
    } catch (err) { next(err); }
};

exports.getAllCategories = async (req, res, next) => {
    try {
        const categories = await categoryService.getAllCategories();
        res.status(200).json({ status: 'success', results: categories.length, data: { categories } });
    } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        res.status(204).json({ status: 'success', data: null });
    } catch (err) { next(err); }
};

exports.editCategory = async (req, res, next) => {
    try {
        const categoryId = req.params.id;
        const updateData = req.body;

        // Call service to handle the logic
        const updatedProduct = await categoryService.updateProduct(categoryId, updateData);

        // Return standardized response
        return res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: updatedProduct
        });
    } catch (error) {
        // Pass error to the global error handler
        next(error);
    }
};