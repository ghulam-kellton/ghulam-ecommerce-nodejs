const mockConstructEvent = jest.fn();
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        checkout: {
            sessions: {
                create: jest.fn().mockResolvedValue({ id: 'sess_123', url: 'http://stripe.com' }),
            },
        },
        webhooks: {
            constructEvent: mockConstructEvent
        }
    }));
});

jest.mock('cloudinary', () => {
    const { PassThrough } = require('stream');

    return {
        v2: {
            config: jest.fn(),
            uploader: {
                upload_stream: jest.fn((options, callback) => {
                    const mockStream = new PassThrough();

                    mockStream.on('finish', () => {
                        if (callback) {
                            callback(null, {
                                secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
                                public_id: 'sample_id'
                            });
                        }
                    });

                    return mockStream;
                }),
                destroy: jest.fn().mockResolvedValue({ result: 'ok' })
            }
        }
    };
});
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/userModel');
const Order = require('../src/models/orderModel');
const Cart = require('../src/models/cartModel');
const Product = require('../src/models/productModel');
const Category = require('../src/models/categoryModel');
const path = require('path');
const fs = require('fs');

describe('E-Commerce Backend API', () => {
    let token;
    let userId;
    let productId;

    beforeAll(async () => {
        // Connect to the Test DB
        await mongoose.connect(process.env.MONGO_URI_TEST);

        // Clean up the data
        await Promise.all([
            User.deleteMany({}),
            Category.deleteMany({}),
            Product.deleteMany({}),
            Order.deleteMany({}),
            Cart.deleteMany({})
        ]);

        // Create a real Category document
        const category = await Category.create({
            name: 'Test Category',
            slug: 'test-category'
        });
        categoryId = category._id;

        // Pass the categoryId (the ObjectId) to the Product
        const product = await Product.create({
            name: 'Test T-Shirt',
            price: 25,
            description: 'A comfortable test shirt',
            category: categoryId,
            stock: 100
        });
        productId = product._id;
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    // Registration
    test('User Registration', async () => {
        const res = await request(app)
            .post('/api/v1/auth/signup')
            .send({ email: 'test@example.com', password: 'password123', name: 'Test User', role: 'admin' });

        expect(res.statusCode).toBe(201);
        userId = res.body.data.user._id;
    });

    // Login
    test('User Login', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        token = res.body.token;
        expect(token).toBeDefined();
    });

    // Create Checkout Session
    test('Create Stripe Session', async () => {
        await Cart.create({
            user: userId,
            items: [{ product: productId, quantity: 1, price: 100 }]
        });

        // Run the request
        const res = await request(app)
            .post('/api/v1/orders/checkout-session')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.checkout_url).toContain('stripe.com');
    });

    // Webhook Success (Finalize Order)
    test('Webhook Finalizes Order', async () => {
        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'sess_test_123',
                    client_reference_id: userId.toString(),
                    amount_total: 2500,
                    payment_status: 'paid',
                    collected_information: {
                        shipping_details: {
                            name: 'John Doe',
                            address: {
                                line1: '123 Test St', city: 'New York', state: 'NY',
                                postal_code: '10001', country: 'US'
                            }
                        }
                    }
                }
            }
        });

        // Trigger the webhook request
        const res = await request(app)
            .post('/webhook')
            .set('stripe-signature', 'mock_sig')
            .send({ type: 'checkout.session.completed' });

        // Assertions
        expect(res.statusCode).toBe(200);

        await new Promise((resolve) => setTimeout(resolve, 500));

        const savedOrder = await Order.findOne({ user: userId });
        expect(savedOrder).not.toBeNull();
    });

    // Get Users List (Admin)
    test('Get all users', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    // Edit User
    test(' Update user profile', async () => {
        const res = await request(app)
            .patch(`/api/v1/users/${userId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Test User' });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe('Updated Test User');
    });

    describe('Category Management', () => {
        let newCategoryId;

        // Create Category
        test('Create a new Category', async () => {
            const res = await request(app)
                .post('/api/v1/categories')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Electronics', slug: 'electronics' });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.category.name).toBe('Electronics');
            newCategoryId = res.body.data.category._id;
        });

        // Get All Categories
        test('Get all Categories', async () => {
            const res = await request(app)
                .get('/api/v1/categories');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data.categories)).toBe(true);
            expect(res.body.data.categories.length).toBeGreaterThanOrEqual(2);
        });

        // Edit Category
        test('Update a Category', async () => {
            const res = await request(app)
                .patch(`/api/v1/categories/${newCategoryId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Gadgets' });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.name).toBe('Gadgets');
        });

        // Delete Category
        test('Delete a Category', async () => {
            const res = await request(app)
                .delete(`/api/v1/categories/${newCategoryId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(204);

            // Verify it's gone
            const check = await Category.findById(newCategoryId);
            expect(check).toBeNull();
        });
    });

    describe('Product Management', () => {
        let newProductId;

        // Add Product
        test('Create a new Product (Admin)', async () => {
            // Ensure user is admin
            await User.findByIdAndUpdate(userId, { role: 'admin' });

            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'New Gaming Mouse',
                    price: 50,
                    description: 'High precision wireless mouse',
                    category: categoryId,
                    stock: 50
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.data.product.name).toBe('New Gaming Mouse');
            newProductId = res.body.data.product._id;
        });

        // Product List (Public)
        test('Get all Products', async () => {
            const res = await request(app).get('/api/v1/products');

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data.products)).toBe(true);
            expect(res.body.data.products.length).toBeGreaterThanOrEqual(2);
        });

        // Edit Product
        test('Update Product Details', async () => {
            const res = await request(app)
                .patch(`/api/v1/products/${newProductId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ price: 45, stock: 40 });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.price).toBe(45);
            expect(res.body.data.stock).toBe(40);
        });

        // Delete Product
        test('Delete a Product', async () => {
            const res = await request(app)
                .delete(`/api/v1/products/${newProductId}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(204);

            // Verify deleted from DB
            const deletedProduct = await Product.findById(newProductId);
            expect(deletedProduct).toBeNull();
        });
    });

    describe('Cart Management', () => {

        // Add Item to Cart
        test('Add product to Cart', async () => {
            const res = await request(app)
                .post('/api/v1/cart/add')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    productId: productId,
                    quantity: 2
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.data.items.length).toBeGreaterThan(0);
            expect(res.body.data.items[0].quantity).toBe(2);
        });

        // View Cart
        test('Get User Cart', async () => {
            const res = await request(app)
                .get('/api/v1/cart')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.user.toString()).toBe(userId.toString());
        });

        // Clear Cart
        test('Clear the entire Cart', async () => {
            const res = await request(app)
                .delete('/api/v1/cart')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            // Verify the cart is now empty
            const checkCart = await Cart.findOne({ user: userId });
            expect(checkCart.items.length).toBe(0);
        });
    });

    describe('Order History', () => {
        //  Get Current User's Orders
        test('Get "My Orders" list', async () => {
            const res = await request(app)
                .get('/api/v1/orders/my-orders')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);

            // Assertions to ensure the data is correct
            expect(Array.isArray(res.body.data.orders)).toBe(true);
            expect(res.body.data.orders.length).toBeGreaterThanOrEqual(1);

            // Verify the order belongs to the correct user
            expect(res.body.data.orders[0].user.toString()).toBe(userId.toString());
        });
    });

    describe('Product with Image Upload', () => {

        test('Create Product with Image (Stream Pipe)', async () => {
            // A real buffer to simulate a file upload
            const buffer = Buffer.from('fake-image-data');

            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${token}`)
                // Field name 'image' must match your upload.single('image') middleware
                .attach('images', buffer, 'test-product.jpg')
                .field('name', 'Streaming Product')
                .field('price', '99')
                .field('description', 'Testing stream pipe')
                .field('category', categoryId.toString())
                .field('stock', '5');

            expect(res.statusCode).toBe(201);
            expect(res.body.data.product.images[0]).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg');
        });
    });

    test('Delete product and its Cloudinary images', async () => {
        // Create a product with "URLs"
        // URL .../folderName/v12345/fileName.jpg
        const productWithImages = await Product.create({
            name: 'Product to Delete',
            description: 'Product to Delete Description',
            price: 10,
            category: categoryId,
            images: [
                'https://res.cloudinary.com/demo/image/upload/v1/test_folder/sample_id_1.jpg',
                'https://res.cloudinary.com/demo/image/upload/v1/test_folder/sample_id_2.jpg'
            ],
            stock: 5
        });

        // Perform the delete request
        const res = await request(app)
            .delete(`/api/v1/products/${productWithImages._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(204);

        // Verify Cloudinary was called with the extracted Public ID
        const cloudinary = require('cloudinary').v2;

        // folderName = parts[length - 2] -> "test_folder"
        // fileName = parts[length - 1].split('.')[0] -> "sample_id_1"
        const expectedId1 = "test_folder/sample_id_1";
        const expectedId2 = "test_folder/sample_id_2";

        expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(expectedId1);
        expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(expectedId2);
    });

    describe('Stripe Webhook Failure Cases', () => {
        let testOrderId;
        const mockFailedSessionId = 'sess_fail_999';

        beforeEach(async () => {
            // Clean up any existing orders for this test session to avoid conflicts
            await Order.deleteMany({ stripeSessionId: mockFailedSessionId });

            // Create a pending order with ALL required fields from your schema
            const order = await Order.create({
                user: userId,
                items: [{ product: productId, quantity: 1, price: 100 }],
                totalAmount: 100,
                shippingAddress: '123 Test Street, Test City',
                stripeSessionId: mockFailedSessionId,
                status: 'pending'
            });
            testOrderId = order._id;
        });

        // Session Expired
        test('Webhook - checkout.session.expired', async () => {
            // Mock the Stripe event for an expired session
            mockConstructEvent.mockReturnValue({
                type: 'checkout.session.expired',
                data: {
                    object: {
                        id: mockFailedSessionId,
                        metadata: { orderId: testOrderId.toString() },
                        client_reference_id: userId.toString()
                    }
                }
            });

            const res = await request(app)
                .post('/webhook')
                .set('stripe-signature', 'mock_sig')
                .send({ type: 'checkout.session.expired' });

            expect(res.statusCode).toBe(200);

            const updatedOrder = await Order.findById(testOrderId);
            expect(['pending', 'expired']).toContain(updatedOrder.status);
        });

        // Payment Failed
        test('Webhook - payment_intent.payment_failed', async () => {
            // Mock the Stripe event for a failed payment intent
            mockConstructEvent.mockReturnValue({
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        // payment_intent fail
                        id: 'pi_mock_failed_123',
                        metadata: { orderId: testOrderId.toString() },
                        last_payment_error: { message: 'Insufficient funds' }
                    }
                }
            });

            const res = await request(app)
                .post('/webhook')
                .set('stripe-signature', 'mock_sig')
                .send({ type: 'payment_intent.payment_failed' });

            expect(res.statusCode).toBe(200);

            // Verify order
            const failedOrder = await Order.findById(testOrderId);
            expect(failedOrder.status).toBe('pending');
        });
    });

    // Delete User
    test('Delete a user', async () => {
        const res = await request(app)
            .delete(`/api/v1/users/${userId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(204);

        // Verify deletion
        const deletedUser = await User.findById(userId);
        expect(deletedUser).toBeNull();
    });
});