const cloudinary = require('cloudinary').v2;

exports.deleteImageFromCloudinary = async (imageUrl) => {
    try {
        // URL .../ecommerce-products/v12345/image_name.jpg
        // We need: ecommerce-products/image_name
        const parts = imageUrl.split('/');
        const fileName = parts[parts.length - 1].split('.')[0];
        const folderName = parts[parts.length - 2];
        const publicId = `${folderName}/${fileName}`;

        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error("Cloudinary Deletion Failed:", err);
    }
};