const express = require('express');
const router = express.Router();
const transferController = require('../Controller/transferController');
const { protect, adminOnly } = require('../Middleware/authMiddleware');

console.log('📋 Transfer routes file loaded');

// Public routes
router.get('/banks', transferController.getAllBanks);

// Protected routes (requires authentication)
router.get('/accounts', protect, transferController.getUserAccounts);
router.get('/recipients', protect, transferController.getSavedRecipients);

// ⭐ THE CRITICAL ROUTE - Your transfer endpoint
router.post('/transfer', protect, transferController.createTransfer);

router.post('/verify', protect, transferController.verifyTransfer);
router.get('/status/:transferId', protect, transferController.getTransferStatus);

// Admin routes
router.get('/admin/transfers', protect, adminOnly, transferController.getAllTransfers);
router.put('/admin/approve/:transferId', protect, adminOnly, transferController.approveTransfer);

console.log('✅ Transfer routes configured');

module.exports = router;