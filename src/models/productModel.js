const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    stock: { type: Number, required: true, default: 0 },
    images: [String] // URLs to Cloudinary/S3
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);