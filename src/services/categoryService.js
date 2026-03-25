const Category = require('../models/categoryModel');

exports.getOrCreateCategory = async (categoryName) => {
    let category = await Category.findOne({ name: categoryName });
    if (!category) {
        category = await Category.create({ name: categoryName });
    }
    return category._id;
};

exports.createCategory = async (data) => {
    return await Category.create(data);
};

exports.getAllCategories = async () => {
    // Populate parentCategory to see the name of the parent in the list
    return await Category.find().populate('parentCategory', 'name');
};

exports.getCategoryBySlug = async (slug) => {
    const category = await Category.findOne({ slug });
    if (!category) throw new Error('Category not found');
    return category;
};

exports.updateProduct = async (categoryId, updateData) => {
    // 1. Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new Error('Category not found');
    }

    // 2. If name is being updated, we might need to regenerate the slug
    // (This assumes your model has a slug field)
    if (updateData.name) {
        updateData.slug = updateData.name.toLowerCase().split(' ').join('-');
    }

    // 3. Perform the update
    // { new: true } returns the document AFTER the update
    // { runValidators: true } ensures the new data follows Schema rules (e.g., price > 0)
    const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        updateData,
        { new: true, runValidators: true }
    );

    return updatedCategory;
};

exports.deleteCategory = async (id) => {
    return await Category.findByIdAndDelete(id);
};