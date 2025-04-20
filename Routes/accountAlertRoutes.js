const express = require('express');
const router = express.Router();
const alertController = require('../Controller/accountAlertController');
const { protect } = require('../Middleware/authMiddleware');

router.use((req, res, next) => {
  console.log(`Checking route hit: ${req.method} ${req.originalUrl}`);
  console.log('User ID:', req.user ? req.user.id : 'None');
  console.log('Params:', req.params);
  next();
});

// Get all alerts for the authenticated user
router.get('/', protect, alertController.getUserAlerts);

// Update balance alerts
router.put('/balance', protect, alertController.updateBalanceAlerts);

// Update transaction alerts by category
router.put('/transaction/:category', protect, (req, res) => {
  req.body.category = req.params.category;
  alertController.updateTransactionAlerts(req, res);
});

// Update security alerts by category
router.put('/security/:category', protect, (req, res) => {
  req.body.category = req.params.category;
  alertController.updateSecurityAlerts(req, res);
});

// Update statement alerts by category
router.put('/statement/:category', protect, (req, res) => {
  req.body.category = req.params.category;
  alertController.updateStatementAlerts(req, res);
});

// Update contact information
router.put('/contact', protect, alertController.updateContactInfo);

// Update all alert settings at once
router.put('/', protect, alertController.updateAllAlertSettings);

module.exports = router;