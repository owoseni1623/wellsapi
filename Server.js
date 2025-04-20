const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const errorHandler = require('./Middleware/errorMiddleware');

// Load env vars
dotenv.config();

// Check for essential environment variables
if (!process.env.MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI environment variable is not defined');
  process.exit(1);
}

// Route files
const authRoutes = require('./Routes/authRoutes');
const dashboardRoutes = require('./Routes/dashboardRoutes');
const checkingRoutes = require('./Routes/checkingRoutes');
const savingsAccountRoutes = require('./Routes/savingsAccountRoutes');
const transferRoutes = require('./Routes/transferRoutes');
const accountRoutes = require('./Routes/accountRoutes');
const billRoutes = require('./Routes/billRoutes');
const payeeRoutes = require('./Routes/payeeRoutes');
const paymentRoutes = require('./Routes/paymentRoutes');
const depositRoutes = require('./Routes/depositRoutes');
const checkDepositRoutes = require('./Routes/checkDepositRoutes');
const newAccountOpenRoutes = require('./Routes/newAccountOpenRoutes');
const withdrawalRoutes = require('./Routes/withdrawFundRoutes');
const orderCheckRoutes = require('./Routes/orderCheckRoutes')
const autopayRoutes = require('./Routes/autopayRoutes');
const accountAlertRoutes = require('./Routes/accountAlertRoutes');
const disputeTransactionRoutes = require('./Routes/disputeTransactionRoutes');
const creditAccountRoutes = require('./Routes/creditAccountRoutes');
const profileRoutes = require('./Routes/profileRoutes');

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api/auth/register', (req, res, next) => {
  if (req.body.firstName && req.body.lastName) {
    req.body.name = `${req.body.firstName} ${req.body.lastName}`;
    console.log('Middleware added name:', req.body.name);
  }
  next();
});

// Add Vercel frontend URL to allowed origins
const allowedOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',') : 
  ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://wells-gilt.vercel.app'];

// Ensure Vercel frontend is included if not already
if (!allowedOrigins.includes('https://wells-gilt.vercel.app')) {
  allowedOrigins.push('https://wells-gilt.vercel.app');
}

// Log CORS configuration for debugging
console.log('CORS allowed origins:', allowedOrigins);

// Enable CORS with proper credential handling
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow anyway in production, but log it
    }
  },
  credentials: true,
  methods: process.env.CORS_METHODS ? 
    process.env.CORS_METHODS.split(',') : 
    ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: process.env.ALLOWED_HEADERS ? 
    process.env.ALLOWED_HEADERS.split(',') : 
    ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/checking', checkingRoutes);
app.use('/api/savings', savingsAccountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payees', payeeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/check-deposits', checkDepositRoutes);
app.use('/api', newAccountOpenRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/order-checks', orderCheckRoutes)
app.use('/api/autopay', autopayRoutes);
app.use('/api/account-alerts', accountAlertRoutes);
app.use('/api/dispute-transactions', disputeTransactionRoutes);
app.use('/api/credit-accounts', creditAccountRoutes);
app.use('/api/profile', profileRoutes);

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running' });
});

// Preflight route for CORS issues
app.options('*', cors());

// Custom error handler - must be after routes
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB with proper error handling
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE || 10,
    minPoolSize: process.env.MONGODB_MIN_POOL_SIZE || 2
  })
  .then(() => {
    console.log('MongoDB Connected');
    // Start server after successful database connection
    const server = app.listen(
      PORT,
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
    );
   
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err, promise) => {
      console.log(`Error: ${err.message}`);
      // Close server & exit process
      server.close(() => process.exit(1));
    });
   
    module.exports = server; // Export for testing purposes
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });