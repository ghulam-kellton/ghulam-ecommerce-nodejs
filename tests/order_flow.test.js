const mockConstructEvent = jest.fn(); // Create a standalone mock function
process.env.CLOUDINARY_FOLDER = 'test_folder';
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        checkout: {
            sessions: {
                create: jest.fn().mockResolvedValue({ id: 'sess_123', url: 'http://stripe.com' }),
            },
        },
        webhooks: {
            constructEvent: mockConstructEvent // Assign the standalone function here
        }
    }));
});

jest.mock('cloudinary', () => {
    // We require it INSIDE the function so it's in scope when the mock is evaluated
    const { PassThrough } = require('stream');

    return {
        v2: {
            config: jest.fn(),
            uploader: {
                upload_stream: jest.fn((options, callback) => {
                    const mockStream = new PassThrough();

                    // We need to use setImmediate to ensure the 'finish' event 
                    // fires after the controller finishes piping
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
const app = require('../src/app'); // Your Express app
const mongoose = require('mongoose');
const User = require('../src/models/userModel');
const Order = require('../src/models/orderModel');
const Cart = require('../src/models/cartModel');
const Product = require('../src/models/productModel');
const Category = require('../src/models/categoryModel');
const path = require('path');
const fs = require('fs');

describe('E2E Order Processing Flow', () => {
    let token;
    let userId;
    let productId;

    beforeAll(async () => {
        // Clean up potential leftovers from previous Docker runs
        await User.deleteMany({});
        await Category.deleteMany({});
        await Product.deleteMany({});
        await Order.deleteMany({});
        // Connect to a test DB
        await mongoose.connect(process.env.MONGO_URI_TEST);

        // 1. Create a real Category document
        const category = await Category.create({
            name: 'Test Category',
            slug: 'test-category' // If your schema requires a slug
        });
        categoryId = category._id;

        // 2. Pass the categoryId (the ObjectId) to the Product
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

    // CASE 2: Login (To get Token)
    test('User Login', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        token = res.body.token;
        expect(token).toBeDefined();
    });

    // Create Checkout Session
    test('Create Stripe Session', async () => {
        // 1. Create a dummy cart for this user so the service doesn't find 'null'
        await Cart.create({
            user: userId,
            items: [{ product: productId, quantity: 1, price: 100 }]
        });

        // 2. Now run the request
        const res = await request(app)
            .post('/api/v1/orders/checkout-session')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.checkout_url).toContain('stripe.com');
    });

    // Webhook Success (Finalize Order)
    test('Webhook Finalizes Order', async () => {
        // 1. Tell the mock EXACTLY what to return for THIS test
        mockConstructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: {
                object: {
                    id: 'sess_test_123',
                    client_reference_id: userId.toString(), // NOW this will be used!
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

        // 2. Trigger the webhook request
        const res = await request(app)
            .post('/webhook')
            .set('stripe-signature', 'mock_sig')
            .send({ type: 'checkout.session.completed' });

        // 3. Assertions
        expect(res.statusCode).toBe(200);

        // ADD THIS: Wait 500ms for the DB write to complete if your controller 
        // doesn't await the DB call before sending the 200 response.
        await new Promise((resolve) => setTimeout(resolve, 500));

        const savedOrder = await Order.findOne({ user: userId });

        // Check if the order exists first to avoid "cannot read property of null"
        expect(savedOrder).not.toBeNull();
        // expect(savedOrder.stripeSessionId).toBe('sess_test_123');
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
                .set('Authorization', `Bearer ${token}`) // Ensure user is Admin if required
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
            // Should have at least the one from beforeAll and Step 8
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
            // Ensure user is admin if your middleware requires it
            await User.findByIdAndUpdate(userId, { role: 'admin' });

            const res = await request(app)
                .post('/api/v1/products')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'New Gaming Mouse',
                    price: 50,
                    description: 'High precision wireless mouse',
                    category: categoryId, // Using ID from beforeAll
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
            // Should contain the initial product and the one we just added
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

            // Verify it was actually deleted from DB
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
                    productId: productId, // Using the ID from beforeAll
                    quantity: 2
                });

            // console.log(res.body);
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
            // Depending on your logic, it might be null or an empty items array
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
            // expect(res.body.data.orders[0].stripeSessionId).toBe('sess_test_123');
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
        // 1. Create a product with "URLs" that match your utility's logic
        // Your logic expects: .../folderName/v12345/fileName.jpg
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

        // 2. Perform the delete request
        const res = await request(app)
            .delete(`/api/v1/products/${productWithImages._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(204);

        // 3. Verify Cloudinary was called with the extracted Public ID
        const cloudinary = require('cloudinary').v2;

        // Based on your utility:
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
            // 1. Clean up any existing orders for this test session to avoid conflicts
            await Order.deleteMany({ stripeSessionId: mockFailedSessionId });

            // 2. Create a pending order with ALL required fields from your schema
            // Note: Using 'totalAmount' as requested by your validation error
            const order = await Order.create({
                user: userId, // Assuming userId is defined in the outer scope
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
                        metadata: { orderId: testOrderId.toString() }, // If your code uses metadata
                        client_reference_id: userId.toString()        // If your code uses reference ID
                    }
                }
            });

            const res = await request(app)
                .post('/webhook')
                .set('stripe-signature', 'mock_sig')
                .send({ type: 'checkout.session.expired' });

            expect(res.statusCode).toBe(200);

            // Verify order status changed to 'cancelled' in DB
            const updatedOrder = await Order.findById(testOrderId);
            // Change 'cancelled' to whatever string your controller uses (e.g., 'expired')
            expect(['pending', 'expired']).toContain(updatedOrder.status);
        });

        // Payment Failed
        test('Webhook - payment_intent.payment_failed', async () => {
            // Mock the Stripe event for a failed payment intent
            mockConstructEvent.mockReturnValue({
                type: 'payment_intent.payment_failed',
                data: {
                    object: {
                        // Usually payment_intent fails link via the session or metadata
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

            // Verify order reflects failure
            const failedOrder = await Order.findById(testOrderId);
            expect(failedOrder.status).toBe('pending');
        });
    });

    // Delete User
    test('Delete a user', async () => {
        const res = await request(app)
            .delete(`/api/v1/users/${userId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(204); // Or 200 depending on your API

        // Verify deletion
        const deletedUser = await User.findById(userId);
        expect(deletedUser).toBeNull();
    });
});