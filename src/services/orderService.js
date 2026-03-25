const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cartService = require('./cartService');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const mongoose = require('mongoose');

exports.createOrder = async (userId, orderData) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        let totalAmount = 0;
        const orderItems = [];

        for (const item of orderData.items) {
            // 1. Find product and check stock
            const product = await Product.findById(item.productId).session(session);

            if (!product) throw new Error(`Product ${item.productId} not found`);
            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name}`);
            }

            // 2. Decrement stock
            product.stock -= item.quantity;
            await product.save({ session });

            // 3. Prepare item snapshot
            totalAmount += product.price * item.quantity;
            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity: item.quantity
            });
        }

        // 4. Create the Order
        const order = await Order.create([{
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress: orderData.shippingAddress
        }], { session });

        await session.commitTransaction();
        return order[0];
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

exports.getUserOrders = async (userId) => {
    return await Order.find({ user: userId }).sort('-createdAt');
};

exports.createCheckoutSession = async (userId) => {
    // 1. Fetch user's cart with product details
    const cart = await cartService.getCart(userId);

    if (!cart || cart.items.length === 0) {
        throw new Error('Your cart is empty');
    }

    // 2. Map cart items to Stripe "Line Items" format
    const lineItems = cart.items.map(item => {
        return {
            price_data: {
                currency: 'inr',
                product_data: {
                    name: item.product.name,
                    images: item.product.images, // Array of strings
                },
                unit_amount: Math.round(item.product.price * 100), // Convert $ to Cents
            },
            quantity: item.quantity,
        };
    });

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cart`,
        customer_email: cart.user.email,
        client_reference_id: userId.toString(), // Crucial for Webhook
        line_items: lineItems,
        mode: 'payment',
        // 1. ADD THIS: Tell Stripe to collect the address
        shipping_address_collection: {
            allowed_countries: ['IN'], // List the ISO codes you support
        },

        // 2. OPTIONAL: Collect phone number if needed for delivery
        phone_number_collection: {
            enabled: true,
        },
        // Metadata allows us to pass extra info to the Webhook
        metadata: {
            cartId: cart._id.toString()
        },
        client_reference_id: userId.toString(),
        line_items: lineItems,
    });

    return session;
};

exports.finalizeOrder = async (session) => {
    const userId = session.client_reference_id;
    const cart = await cartService.getCart(userId);
    // Extracting details provided by Stripe
    const shippingDetails = session.collected_information.shipping_details;
    const address = shippingDetails.address; // contains line1, city, state, postal_code, country

    // 1. Create the Order document
    const order = await Order.create({
        user: userId,
        items: cart.items.map(item => ({
            product: item.product._id,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity
        })),
        totalAmount: session.amount_total / 100, // Convert back from cents
        paymentStatus: 'paid',
        stripeSessionId: session.id,
        // 3. SAVE TO DB: Store the address we got from Stripe
        shippingAddress: {
            recipientName: shippingDetails.name,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            postalCode: address.postal_code,
            country: address.country
        }
    });

    // 2. Clear the User's Cart
    await cartService.clearUserCart(userId);

    // 3. Optional: Trigger Email or Stock Reduction here
    return order;
};

exports.handlePaymentFailure = async (session, reason) => {
    const userId = session.client_reference_id;

    // Log the failure in your database or a logging service (like Winston/Sentry)
    console.error(`Payment ${reason} for User ${userId}. Session ID: ${session.id}`);

    // OPTIONAL: Create a "Failed" order record so you can see it in your admin panel
    // or send a "Hey, did you forget something?" email.
    /*
    await Order.create({
      user: userId,
      paymentStatus: 'failed',
      stripeSessionId: session.id,
      // totalAmount, etc.
    });
    */
};