const Payee = require('../Model/Payee');
const asyncHandler = require('../Middleware/async');

// @desc    Get all payees for a user
// @route   GET /api/payees
// @access  Private
exports.getPayees = asyncHandler(async (req, res) => {
  let query = { user: req.user.id };
  
  // Add category filter if provided
  if (req.query.category && req.query.category !== 'all') {
    query.category = req.query.category;
  }
  
  // Add search functionality
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search, 'i');
    query = {
      ...query,
      $or: [
        { name: searchRegex },
        { nickname: searchRegex },
        { category: searchRegex }
      ]
    };
  }
  
  const payees = await Payee.find(query);
  
  res.status(200).json({
    success: true,
    count: payees.length,
    data: payees
  });
});

// @desc    Get single payee
// @route   GET /api/payees/:id
// @access  Private
exports.getPayee = asyncHandler(async (req, res) => {
  const payee = await Payee.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payee) {
    return res.status(404).json({
      success: false,
      error: 'Payee not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: payee
  });
});

// @desc    Create new payee
// @route   POST /api/payees
// @access  Private
exports.createPayee = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.user = req.user.id;
  
  // Set nickname to name if not provided
  if (!req.body.nickname) {
    req.body.nickname = req.body.name;
  }
  
  // Mask account number for security
  if (req.body.accountNumber) {
    const lastFour = req.body.accountNumber.slice(-4);
    req.body.accountNumber = `****${lastFour}`;
  }
  
  const payee = await Payee.create(req.body);
  
  res.status(201).json({
    success: true,
    data: payee
  });
});

// @desc    Update payee
// @route   PUT /api/payees/:id
// @access  Private
exports.updatePayee = asyncHandler(async (req, res) => {
  let payee = await Payee.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payee) {
    return res.status(404).json({
      success: false,
      error: 'Payee not found'
    });
  }
  
  // Mask account number if it's being updated
  if (req.body.accountNumber && !req.body.accountNumber.startsWith('****')) {
    const lastFour = req.body.accountNumber.slice(-4);
    req.body.accountNumber = `****${lastFour}`;
  }
  
  payee = await Payee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: payee
  });
});

// @desc    Delete payee
// @route   DELETE /api/payees/:id
// @access  Private
exports.deletePayee = asyncHandler(async (req, res) => {
  const payee = await Payee.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payee) {
    return res.status(404).json({
      success: false,
      error: 'Payee not found'
    });
  }
  
  await payee.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});