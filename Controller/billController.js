const Bill = require('../Model/Bill');
const Payee = require('../Model/Payee');
const asyncHandler = require('../Middleware/async');

// @desc    Get all bills for a user
// @route   GET /api/bills
// @access  Private
exports.getBills = asyncHandler(async (req, res) => {
  let query = { user: req.user.id };
  
  // Add status filter if provided
  if (req.query.status) {
    query.status = req.query.status;
  }
  
  // Add search functionality
  if (req.query.search) {
    const payees = await Payee.find({
      user: req.user.id,
      name: new RegExp(req.query.search, 'i')
    });
    
    const payeeIds = payees.map(payee => payee._id);
    
    if (payeeIds.length > 0) {
      query.payee = { $in: payeeIds };
    } else {
      // If no matching payees found, return empty result
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }
  }
  
  // Handle sorting
  const sort = {};
  if (req.query.sortBy) {
    const parts = req.query.sortBy.split(':');
    sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
  } else {
    // Default sort by due date ascending
    sort.dueDate = 1;
  }
  
  const bills = await Bill.find(query)
    .sort(sort)
    .populate({
      path: 'payee',
      select: 'name nickname category'
    });
  
  res.status(200).json({
    success: true,
    count: bills.length,
    data: bills
  });
});

// @desc    Get upcoming bills (due within the next 30 days)
// @route   GET /api/bills/upcoming
// @access  Private
exports.getUpcomingBills = asyncHandler(async (req, res) => {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const bills = await Bill.find({
    user: req.user.id,
    dueDate: { $gte: today, $lte: thirtyDaysFromNow },
    status: 'upcoming'
  })
  .sort({ dueDate: 1 })
  .populate({
    path: 'payee',
    select: 'name nickname category'
  });
  
  res.status(200).json({
    success: true,
    count: bills.length,
    data: bills
  });
});

// @desc    Get single bill
// @route   GET /api/bills/:id
// @access  Private
exports.getBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne({
    _id: req.params.id,
    user: req.user.id
  }).populate({
    path: 'payee',
    select: 'name nickname category'
  });
  
  if (!bill) {
    return res.status(404).json({
      success: false,
      error: 'Bill not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: bill
  });
});

// @desc    Create new bill
// @route   POST /api/bills
// @access  Private
exports.createBill = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.user = req.user.id;
  
  // Check if payee exists and belongs to user
  const payee = await Payee.findOne({
    _id: req.body.payee,
    user: req.user.id
  });
  
  if (!payee) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payee selected'
    });
  }
  
  const bill = await Bill.create(req.body);
  
  // Populate payee information
  const populatedBill = await Bill.findById(bill._id).populate({
    path: 'payee',
    select: 'name nickname category'
  });
  
  res.status(201).json({
    success: true,
    data: populatedBill
  });
});

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private
exports.updateBill = asyncHandler(async (req, res) => {
  let bill = await Bill.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!bill) {
    return res.status(404).json({
      success: false,
      error: 'Bill not found'
    });
  }
  
  // Check if payee exists and belongs to user if being updated
  if (req.body.payee) {
    const payee = await Payee.findOne({
      _id: req.body.payee,
      user: req.user.id
    });
    
    if (!payee) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payee selected'
      });
    }
  }
  
  bill = await Bill.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate({
    path: 'payee',
    select: 'name nickname category'
  });
  
  res.status(200).json({
    success: true,
    data: bill
  });
});

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Private
exports.deleteBill = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!bill) {
    return res.status(404).json({
      success: false,
      error: 'Bill not found'
    });
  }
  
  await bill.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Toggle autopay for a bill
// @route   PUT /api/bills/:id/autopay
// @access  Private
exports.toggleAutopay = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!bill) {
    return res.status(404).json({
      success: false,
      error: 'Bill not found'
    });
  }
  
  bill.autopay = !bill.autopay;
  await bill.save();
  
  res.status(200).json({
    success: true,
    data: bill
  });
});

// @desc    Toggle reminder for a bill
// @route   PUT /api/bills/:id/reminder
// @access  Private
exports.toggleReminder = asyncHandler(async (req, res) => {
  const bill = await Bill.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!bill) {
    return res.status(404).json({
      success: false,
      error: 'Bill not found'
    });
  }
  
  bill.reminderSet = !bill.reminderSet;
  
  // If setting reminder, set reminder date to 3 days before due date
  if (bill.reminderSet) {
    const reminderDate = new Date(bill.dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    bill.reminderDate = reminderDate;
  } else {
    bill.reminderDate = null;
  }
  
  await bill.save();
  
  res.status(200).json({
    success: true,
    data: bill
  });
});