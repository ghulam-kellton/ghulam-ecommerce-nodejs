const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, lowercase: true, unique: true },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    description: String
}, { timestamps: true });

// Auto-generate slug (e.g., "Home Appliances" -> "home-appliances")
categorySchema.pre('save', function (next) {
    this.slug = this.name.split(' ').join('-').toLowerCase();
    next();
});

module.exports = mongoose.model('Category', categorySchema);