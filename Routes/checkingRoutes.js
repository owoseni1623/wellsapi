const express = require('express');
const router = express.Router();
const { protect } = require('../Middleware/authMiddleware');
const checkingAccountController = require('../Controller/checkingAccountController');

// Test route for checking if the API is working
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Checking routes are working'
  });
});

// Debug route to verify authentication
router.get('/debug', (req, res) => {
  console.log('Debug route called');
  console.log('User in request:', req.user);
  res.status(200).json({
    success: true,
    message: 'Debug route working',
    userId: req.user ? req.user.id : 'not set'
  });
});

// All checking account routes require authentication
router.use(protect);

// Get primary checking account (default)
router.get('/primary', checkingAccountController.getCheckingAccount);
router.get('/primary/transactions', checkingAccountController.getCheckingTransactions);
router.post('/primary/statement', checkingAccountController.downloadStatement);
router.post('/primary/autopay', checkingAccountController.setupAutoPay);
router.post('/primary/order-checks', checkingAccountController.orderChecks);
router.post('/primary/dispute-transaction', checkingAccountController.disputeTransaction);
router.post('/primary/alerts', checkingAccountController.setupAlerts);
router.post('/primary/deposit', checkingAccountController.depositMoney);
router.post('/primary/withdraw', checkingAccountController.withdrawMoney); // Added withdraw route

// Get specific checking account by ID
router.get('/:accountId', checkingAccountController.getCheckingAccount);
router.get('/:accountId/transactions', checkingAccountController.getCheckingTransactions);
router.post('/:accountId/statement', checkingAccountController.downloadStatement);
router.post('/:accountId/autopay', checkingAccountController.setupAutoPay);
router.post('/:accountId/order-checks', checkingAccountController.orderChecks);
router.post('/:accountId/dispute-transaction', checkingAccountController.disputeTransaction);
router.post('/:accountId/alerts', checkingAccountController.setupAlerts);
router.post('/:accountId/deposit', checkingAccountController.depositMoney);
router.post('/:accountId/withdraw', checkingAccountController.withdrawMoney); // Added withdraw route

module.exports = router;