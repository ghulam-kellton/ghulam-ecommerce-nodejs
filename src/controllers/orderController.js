const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const orderService = require('../services/orderService');

exports.checkout = async (req, res, next) => {
    try {
        // req.user is populated by the 'protect' middleware
        const order = await orderService.createOrder(req.user._id, req.body);

        res.status(201).json({
            status: 'success',
            data: { order }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

exports.getMyOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getUserOrders(req.user._id);
        res.status(200).json({ status: 'success', data: { orders } });
    } catch (err) { next(err); }
};

exports.stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Verify the event with your Webhook Secret from Stripe Dashboard/CLI
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    switch (event.type) {
        case 'checkout.session.completed':
            // Success!
            await orderService.finalizeOrder(session);
            break;

        case 'checkout.session.expired':
            // User abandoned the cart
            console.log(`Session Expired: ${session.id}`);
            await orderService.handlePaymentFailure(session, 'expired');
            break;

        case 'payment_intent.payment_failed':
            // Card declined / technical error
            console.log(`Payment Failed: ${session.id}. Reason: ${session.last_payment_error?.message}`);
            await orderService.handlePaymentFailure(session, 'failed');
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
};

exports.getCheckoutSession = async (req, res, next) => {
    try {
        // req.user.id is populated by your 'protect' middleware
        const session = await orderService.createCheckoutSession(req.user.id);

        res.status(200).json({
            success: true,
            session_id: session.id,
            checkout_url: session.url // Frontend redirects the user to this URL
        });
    } catch (error) {
        next(error);
    }
};