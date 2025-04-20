const express = require('express');
const router = express.Router();
const { protect } = require('../Middleware/authMiddleware');
const {
  getDashboardData,
  getAccountDetails,
  transferMoney,
  createAccount,
  withdrawFunds,
  depositFunds
} = require('../Controller/dashboardController');

// All dashboard routes require authentication
router.use(protect);

// Get dashboard data
router.get('/', getDashboardData);

// Get account details
router.get('/account/:accountId', getAccountDetails);

// Transfer money between accounts
router.post('/transfer', transferMoney);

// Open a new account
router.post('/account', createAccount);

// Withdraw funds
router.post('/withdraw', withdrawFunds);

// Deposit funds
router.post('/deposit', depositFunds);

module.exports = router;