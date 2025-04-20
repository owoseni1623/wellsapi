const express = require('express');
const router = express.Router();
const { protect } = require('../Middleware/authMiddleware');
const checkDepositController = require('../Controller/checkDepositController');
const fileUpload = require('../Middleware/fileUploadMiddleware');

// Get deposit limits
router.get('/limits', protect, checkDepositController.getDepositLimits);

// Get accounts available for deposits
router.get('/accounts', protect, checkDepositController.getDepositAccounts);

// Get deposit history
router.get('/history', protect, checkDepositController.getDepositHistory);

// Submit a new deposit
router.post(
  '/',
  protect,
  fileUpload.fields([
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 }
  ]),
  checkDepositController.submitDeposit
);

// Get details for a specific deposit
router.get('/:id', protect, checkDepositController.getDepositDetails);

// Cancel a pending deposit
router.delete('/:id', protect, checkDepositController.cancelDeposit);

module.exports = router;