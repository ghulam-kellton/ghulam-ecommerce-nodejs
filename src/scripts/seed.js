const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/userModel');
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');

dotenv.config();

const seedData = async () => {
    try {
        // 1. Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to Database...');

        // 2. Clear existing data
        await User.deleteMany();
        await Category.deleteMany();
        await Product.deleteMany();
        console.log('Existing data cleared.');

        // 3. Seed Admin User
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@ecommerce.com',
            password: 'password123', // Ensure your User model hashes this in a 'pre-save' hook
            role: 'admin'
        });
        console.log('Admin User created.');

        // 4. Seed Categories
        const electronics = await Category.create({
            name: 'Electronics',
            slug: 'electronics',
            description: 'High-tech gadgets and devices'
        });

        const fashion = await Category.create({
            name: 'Fashion',
            slug: 'fashion',
            description: 'Clothing and accessories'
        });
        console.log('Categories created.');

        // 5. Seed Products
        const products = [
            {
                name: 'Smartphone X',
                description: 'Latest flagship smartphone',
                price: 999,
                category: electronics._id,
                stock: 50,
                images: ['https://placehold.co/400']
            },
            {
                name: 'Leather Jacket',
                description: 'Genuine black leather jacket',
                price: 150,
                category: fashion._id,
                stock: 20,
                images: ['https://placehold.co/400']
            }
        ];

        await Product.insertMany(products);
        console.log('Products created.');

        console.log('Database Seeded Successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedData();