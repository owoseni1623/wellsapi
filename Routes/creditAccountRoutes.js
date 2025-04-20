const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { protect } = require('../Middleware/authMiddleware'); // Changed from 'auth' to '{ protect }'
const creditAccountController = require('../Controller/creditAccountController');

// @route   GET /api/credit-accounts/primary
// @desc    Get user's primary credit account
// @access  Private
router.get('/primary', protect, creditAccountController.getPrimaryCreditAccount);

// @route   GET /api/credit-accounts/all
// @desc    Get all user's credit accounts
// @access  Private
router.get('/all', protect, creditAccountController.getAllCreditAccounts);

// @route   GET /api/credit-accounts/:accountId
// @desc    Get specific credit account by ID
// @access  Private
router.get('/:accountId', protect, creditAccountController.getCreditAccountById);

// @route   GET /api/credit-accounts/:accountId/transactions
// @desc    Get transactions for a credit account
// @access  Private
router.get('/:accountId/transactions', protect, creditAccountController.getTransactions);

// @route   POST /api/credit-accounts/create
// @desc    Create a new credit account
// @access  Private
router.post('/create', [
  protect,
  check('creditLimit', 'Credit limit is required').optional().isNumeric()
], creditAccountController.createCreditAccount);

// @route   POST /api/credit-accounts/:accountId/payment
// @desc    Make a payment on a credit account
// @access  Private
router.post('/:accountId/payment', [
  protect,
  check('amount', 'Amount is required').not().isEmpty().isNumeric(),
  check('description', 'Description is allowed').optional()
], creditAccountController.makePayment);

// @route   POST /api/credit-accounts/:accountId/purchase
// @desc    Make a purchase with a credit account
// @access  Private
router.post('/:accountId/purchase', [
  protect,
  check('amount', 'Amount is required').not().isEmpty().isNumeric(),
  check('description', 'Description is allowed').optional(),
  check('merchant', 'Merchant is allowed').optional(),
  check('category', 'Category is allowed').optional()
], creditAccountController.makePurchase);

// @route   POST /api/credit-accounts/:accountId/statement
// @desc    Generate a statement for a credit account
// @access  Private
router.post('/:accountId/statement', [
  protect,
  check('period', 'Statement period is required').not().isEmpty(),
  check('format', 'Format is required').isIn(['pdf', 'csv'])
], creditAccountController.generateStatement);

// @route   PUT /api/credit-accounts/:accountId
// @desc    Update credit account details
// @access  Private
router.put('/:accountId', [
  protect,
  check('isPrimary', 'isPrimary must be a boolean').optional().isBoolean()
], creditAccountController.updateCreditAccount);

// @route   POST /api/credit-accounts/:accountId/limit-increase
// @desc    Request a credit limit increase
// @access  Private
router.post('/:accountId/limit-increase', [
  protect,
  check('requestedLimit', 'Requested limit is required').not().isEmpty().isNumeric(),
  check('reason', 'Reason is allowed').optional()
], creditAccountController.requestCreditLimitIncrease);

// @route   DELETE /api/credit-accounts/:accountId
// @desc    Close a credit account (soft delete)
// @access  Private
router.delete('/:accountId', protect, creditAccountController.closeCreditAccount);

module.exports = router;