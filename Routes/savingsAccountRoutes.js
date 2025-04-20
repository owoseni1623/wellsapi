const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect } = require('../Middleware/authMiddleware');
const SavingsAccount = require('../Model/SavingsAccountModel');
const savingsAccountController = require('../Controller/savingsAccountController');



router.get('/debug-accounts', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all accounts for this user
    const accounts = await SavingsAccount.find({ userId });
    
    const accountDetails = accounts.map(acc => ({
      id: acc._id,
      accountNumber: acc.accountNumber,
      isPrimary: acc.isPrimary,
      type: acc.type
    }));
    
    return res.status(200).json({
      success: true,
      data: accountDetails
    });
  } catch (error) {
    console.error('Error debugging accounts:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error in debug endpoint'
    });
  }
});


router.get('/diagnostic/:userId', protect, async (req, res) => {
    try {
      if (req.user.id !== req.params.userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this data'
        });
      }
      
      // Get all accounts for this user
      const accounts = await SavingsAccount.find({ userId: req.params.userId });
      
      const accountInfo = accounts.map(acc => ({
        id: acc._id,
        accountNumber: acc.accountNumber,
        type: acc.type,
        balance: acc.balance,
        transactionCount: acc.transactions.length
      }));
      
      return res.status(200).json({
        success: true,
        data: accountInfo
      });
    } catch (error) {
      console.error('Diagnostic error:', error);
      return res.status(500).json({
        success: false,
        error: 'Server error in diagnostic endpoint'
      });
    }
  });

// Fix the route order - specific routes first, then param routes
// Primary account routes
router.get('/primary', protect, savingsAccountController.getPrimarySavingsAccount);
router.get('/primary/transactions', protect, savingsAccountController.getTransactions);
router.post('/primary/deposit', [
  protect,
  check('amount', 'Amount is required').notEmpty(),
  check('amount', 'Amount must be a positive number').isFloat({ min: 0.01 })
], savingsAccountController.makeDeposit);
router.post('/primary/statement', [
  protect,
  check('period', 'Statement period is required').notEmpty(),
  check('format', 'Format must be either pdf or csv').isIn(['pdf', 'csv'])
], savingsAccountController.generateStatement);

// Create new savings account
router.post('/', [
  protect,
  check('initialDeposit', 'Initial deposit must be a number if provided').optional().isFloat({ min: 0 })
], savingsAccountController.createSavingsAccount);

// Specific account routes - these must come last
router.get('/:accountId', protect, savingsAccountController.getSavingsAccountById);
router.get('/:accountId/transactions', protect, savingsAccountController.getTransactions);
router.post('/:accountId/deposit', [
  protect,
  check('amount', 'Amount is required').notEmpty(),
  check('amount', 'Amount must be a positive number').isFloat({ min: 0.01 })
], savingsAccountController.makeDeposit);
router.post('/:accountId/statement', [
  protect,
  check('period', 'Statement period is required').notEmpty(),
  check('format', 'Format must be either pdf or csv').isIn(['pdf', 'csv'])
], savingsAccountController.generateStatement);

module.exports = router;