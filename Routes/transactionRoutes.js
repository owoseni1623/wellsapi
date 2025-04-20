// Routes/accountRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../Middleware/authMiddleware');
const transactionController = require('../controllers/transactionController');

// All routes require authentication
router.use(protect);

// GET account transactions
router.get('/:accountId/transactions', transactionController.getAccountTransactions);

// Add your other account routes here

module.exports = router;