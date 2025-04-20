const express = require('express');
const router = express.Router();
const newAccountOpenController = require('../Controller/newAccountOpenController');
const { protect } = require('../Middleware/authMiddleware');

// Apply token verification middleware to all routes
router.use(protect);

// Create a new account
router.post('/open-account', newAccountOpenController.createNewAccount);

// Get account details for a specific account
router.get('/open-account/:accountId', newAccountOpenController.getNewAccountDetails);

// Get all new accounts for a user
router.get('/open-accounts', newAccountOpenController.getAllNewAccounts);

module.exports = router;