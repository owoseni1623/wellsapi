const express = require('express');
const router = express.Router();
const withdrawFundController = require('../Controller/withdrawFundController');
const { protect } = require('../Middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Process a withdrawal
router.post('/withdraw', withdrawFundController.processWithdrawal);

// Get withdrawal history for the authenticated user
router.get('/history', withdrawFundController.getWithdrawalHistory);

// Get nearby ATM locations - MUST be before /:id route to avoid conflict
router.get('/atms/nearby', withdrawFundController.getNearbyATMs);

// Send receipt for a transaction
router.post('/receipt', withdrawFundController.sendReceiptEmail);

// Get a specific withdrawal by ID - must come after other specific routes
router.get('/:id', withdrawFundController.getWithdrawalById);

// Cancel a scheduled withdrawal
router.post('/:id/cancel', withdrawFundController.cancelWithdrawal);

module.exports = router;