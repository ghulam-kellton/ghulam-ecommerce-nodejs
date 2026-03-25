const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { globalErrorHandler } = require('./middleware/errorMiddleware');
const orderController = require('./controllers/orderController');

const app = express();

// Security & Logging Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
// Stripe Webhook (Raw body needed)
app.post('/webhook', express.raw({ type: 'application/json' }), orderController.stripeWebhook);
app.use(express.json());

// API Routes
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/products', require('./routes/productRoutes'));
app.use('/api/v1/categories', require('./routes/categoryRoutes'));
app.use('/api/v1/orders', require('./routes/orderRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/cart', require('./routes/cartRoutes'));

// Health Check
app.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
