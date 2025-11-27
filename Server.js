const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const mongoose = require('mongoose');
const errorHandler = require('./Middleware/errorMiddleware');

// Load env vars FIRST
dotenv.config();

// Check for essential environment variables
if (!process.env.MONGODB_URI) {
  console.error('FATAL ERROR: MONGODB_URI environment variable is not defined');
  process.exit(1);
}

const app = express();

// ============================================
// MIDDLEWARE - ORDER IS CRITICAL!
// ============================================

// 1. Body parser - MUST BE FIRST
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 3. CORS Configuration - CRITICAL FOR YOUR ISSUE
const allowedOrigins = [
  'https://wellsfargoca.net',
  'https://www.wellsfargoca.net',
  'https://wells-fargo-seven.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

// Add origins from environment variable
if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  envOrigins.forEach(origin => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

console.log('🔐 CORS allowed origins:', allowedOrigins);

// CORS options - Enhanced to fix 405 error
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      console.log('✅ Request with no origin - allowed');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.some(allowedOrigin => origin.includes(allowedOrigin.replace(/^https?:\/\//, '')))) {
      console.log('✅ Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('⚠️  Origin not in whitelist (allowing anyway for testing):', origin);
      callback(null, true); // Allow for testing - change to callback(new Error('Not allowed by CORS')) in strict production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods',
    'x-auth-token'
  ],
  exposedHeaders: ['Content-Length', 'X-JSON', 'Authorization'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle ALL preflight OPTIONS requests
app.options('*', cors(corsOptions));

// Additional CORS headers middleware - CRITICAL FIX
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed.replace(/^https?:\/\//, '')))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-auth-token');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log('✈️  Preflight request for:', req.path);
    return res.status(200).end();
  }
  
  next();
});

// 4. Request logging middleware
app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.originalUrl}`);
  console.log('Origin:', req.headers.origin || 'No origin');
  console.log('Authorization:', req.headers.authorization ? 'Present' : 'Not present');
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body keys:', Object.keys(req.body));
  }
  next();
});

// 5. Name middleware for registration
app.use('/api/auth/register', (req, res, next) => {
  if (req.body.firstName && req.body.lastName) {
    req.body.name = `${req.body.firstName} ${req.body.lastName}`;
    console.log('Middleware added name:', req.body.name);
  }
  next();
});

// ============================================
// ROUTES
// ============================================

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
const orderCheckRoutes = require('./Routes/orderCheckRoutes');
const autopayRoutes = require('./Routes/autopayRoutes');
const accountAlertRoutes = require('./Routes/accountAlertRoutes');
const disputeTransactionRoutes = require('./Routes/disputeTransactionRoutes');
const creditAccountRoutes = require('./Routes/creditAccountRoutes');
const profileRoutes = require('./Routes/profileRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/checking', checkingRoutes);
app.use('/api/savings', savingsAccountRoutes);
app.use('/api/transfers', transferRoutes); // ⭐ YOUR CRITICAL TRANSFER ROUTES
app.use('/api/accounts', accountRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payees', payeeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/check-deposits', checkDepositRoutes);
app.use('/api', newAccountOpenRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/order-checks', orderCheckRoutes);
app.use('/api/autopay', autopayRoutes);
app.use('/api/account-alerts', accountAlertRoutes);
app.use('/api/dispute-transactions', disputeTransactionRoutes);
app.use('/api/credit-accounts', creditAccountRoutes);
app.use('/api/profile', profileRoutes);

console.log('✅ All routes mounted successfully');

// ============================================
// HEALTH CHECK & ERROR HANDLERS
// ============================================

// Health check
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Wells Fargo API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'API test endpoint working',
    env: process.env.NODE_ENV,
    cors: 'enabled'
  });
});

// Test transfer endpoint accessibility
app.get('/api/transfers/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Transfer endpoint is accessible',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });
});

// 404 handler
app.use((req, res, next) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'POST /api/transfers/transfer',
      'GET /api/transfers/accounts',
      'GET /api/transfers/banks'
    ]
  });
});

// Error handler - must be last
app.use(errorHandler);

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2
  })
  .then(() => {
    console.log('✅ MongoDB Connected');
    
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`📍 API URL: http://localhost:${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/test`);
      console.log(`📍 Transfer endpoint: http://localhost:${PORT}/api/transfers/transfer`);
      console.log(`📍 Transfer test: http://localhost:${PORT}/api/transfers/test\n`);
    });
   
    process.on('unhandledRejection', (err, promise) => {
      console.log(`❌ Error: ${err.message}`);
      server.close(() => process.exit(1));
    });
   
    module.exports = server;
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });