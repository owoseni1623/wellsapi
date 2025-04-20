// routes/depositRoutes.js
const express = require('express');
const { protect } = require('../Middleware/authMiddleware');
const depositController = require('../Controller/depositController');

const router = express.Router();

// Apply authentication middleware for all routes
router.use(protect);

// Get deposit limits
router.get('/limits', depositController.getDepositLimits);

// Get user accounts
router.get('/accounts', depositController.getUserAccounts);

// Get deposit history
router.get('/history', depositController.getDepositHistory);

// Submit a new deposit
router.post('/submit', depositController.submitDeposit);

// Get a single deposit by reference number
router.get('/:referenceNumber', depositController.getDepositByReference);

module.exports = router;