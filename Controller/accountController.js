const Account = require('../Model/Account');
const asyncHandler = require('../Middleware/async');

// @desc    Get all accounts for a user
// @route   GET /api/accounts
// @access  Private
exports.getAccounts = asyncHandler(async (req, res) => {
  const accounts = await Account.find({ user: req.user.id });
  
  res.status(200).json({
    success: true,
    count: accounts.length,
    data: accounts
  });
});

// @desc    Get single account
// @route   GET /api/accounts/:id
// @access  Private
exports.getAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Account not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: account
  });
});

// @desc    Create new account
// @route   POST /api/accounts
// @access  Private
exports.createAccount = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.user = req.user.id;
  
  const account = await Account.create(req.body);
  
  res.status(201).json({
    success: true,
    data: account
  });
});

// @desc    Update account
// @route   PUT /api/accounts/:id
// @access  Private
exports.updateAccount = asyncHandler(async (req, res) => {
  let account = await Account.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Account not found'
    });
  }
  
  account = await Account.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: account
  });
});

// @desc    Delete account
// @route   DELETE /api/accounts/:id
// @access  Private
exports.deleteAccount = asyncHandler(async (req, res) => {
  const account = await Account.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Account not found'
    });
  }
  
  await account.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});