const Payment = require('../Model/Payment');
const Bill = require('../Model/Bill');
const Payee = require('../Model/Payee');
const Account = require('../Model/Account');
const asyncHandler = require('../Middleware/async');
const { format } = require('date-fns');

// @desc    Get all payments for a user
// @route   GET /api/payments
// @access  Private
exports.getPayments = asyncHandler(async (req, res) => {
  let query = { user: req.user.id };
  
  // Add status filter if provided
  if (req.query.status && req.query.status !== 'all') {
    query.status = req.query.status;
  }
  
  // Add search functionality
  if (req.query.search) {
    // First find matching payees
    const payees = await Payee.find({
      user: req.user.id,
      name: new RegExp(req.query.search, 'i')
    });
    
    const payeeIds = payees.map(payee => payee._id);
    
    // Then search for payments by payee or confirmation number
    query = {
      ...query,
      $or: [
        { payee: { $in: payeeIds } },
        { confirmationNumber: new RegExp(req.query.search, 'i') }
      ]
    };
  }
  
  // Handle sorting
  let sort = { date: -1 }; // Default sort by date, newest first
  
  if (req.query.sort) {
    switch(req.query.sort) {
      case 'date-asc':
        sort = { date: 1 };
        break;
      case 'date-desc':
        sort = { date: -1 };
        break;
      case 'amount-asc':
        sort = { amount: 1 };
        break;
      case 'amount-desc':
        sort = { amount: -1 };
        break;
      default:
        sort = { date: -1 };
    }
  }
  
  const payments = await Payment.find(query)
    .sort(sort)
    .populate({
      path: 'payee',
      select: 'name nickname category'
    })
    .populate({
      path: 'account',
      select: 'name accountNumber'
    });
  
  res.status(200).json({
    success: true,
    count: payments.length,
    data: payments
  });
});

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
exports.getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id
  })
  .populate({
    path: 'payee',
    select: 'name nickname category'
  })
  .populate({
    path: 'account',
    select: 'name accountNumber'
  })
  .populate({
    path: 'bill',
    select: 'dueDate amount'
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Create new payment
// @route   POST /api/payments
// @access  Private
exports.createPayment = asyncHandler(async (req, res) => {
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
  
  // Check if account exists and belongs to user
  const account = await Account.findOne({
    _id: req.body.account,
    user: req.user.id
  });
  
  if (!account) {
    return res.status(400).json({
      success: false,
      error: 'Invalid account selected'
    });
  }
  
  // If bill ID is provided, check if it exists and belongs to user
  if (req.body.bill) {
    const bill = await Bill.findOne({
      _id: req.body.bill,
      user: req.user.id
    });
    
    if (!bill) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bill selected'
      });
    }
    
    // Update the bill if it exists
    bill.status = 'paid';
    bill.paymentSource = account._id;
    bill.paymentAmount = req.body.amount;
    bill.lastPaymentDate = req.body.date || new Date();
    await bill.save();
  }
  
  // Calculate nextPaymentDate if frequency is not 'once'
  if (req.body.paymentFrequency && req.body.paymentFrequency !== 'once') {
    const paymentDate = new Date(req.body.date || new Date());
    
    if (req.body.paymentFrequency === 'weekly') {
      paymentDate.setDate(paymentDate.getDate() + 7);
    } else if (req.body.paymentFrequency === 'monthly') {
      paymentDate.setMonth(paymentDate.getMonth() + 1);
    }
    
    req.body.nextPaymentDate = paymentDate;
  }
  
  // Create the payment
  const payment = await Payment.create(req.body);
  
  // Update account balance (subtract payment amount for checking/savings, add for credit)
  if (account.type === 'checking' || account.type === 'savings') {
    account.balance -= req.body.amount;
  } else if (account.type === 'credit') {
    account.balance += req.body.amount;
  }
  
  await account.save();
  
  // Populate related information
  const populatedPayment = await Payment.findById(payment._id)
    .populate({
      path: 'payee',
      select: 'name nickname category'
    })
    .populate({
      path: 'account',
      select: 'name accountNumber'
    });
  
  res.status(201).json({
    success: true,
    data: populatedPayment
  });
});

// @desc    Update payment status
// @route   PUT /api/payments/:id/status
// @access  Private
exports.updatePaymentStatus = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  // Only allow status changes for pending payments
  if (payment.status !== 'Pending' && req.body.status !== 'Canceled') {
    return res.status(400).json({
      success: false,
      error: 'Only pending payments can be updated'
    });
  }
  
  // Handle payment cancellation
  if (req.body.status === 'Canceled') {
    // If payment is tied to a bill, update the bill
    if (payment.bill) {
      const bill = await Bill.findById(payment.bill);
      if (bill) {
        bill.status = 'upcoming';
        await bill.save();
      }
    }
    
    // Revert the account balance change
    const account = await Account.findById(payment.account);
    if (account) {
      if (account.type === 'checking' || account.type === 'savings') {
        account.balance += payment.amount;
      } else if (account.type === 'credit') {
        account.balance -= payment.amount;
      }
      await account.save();
    }
  }
  
  payment.status = req.body.status;
  await payment.save();
  
  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Get payment receipt/details
// @route   GET /api/payments/:id/receipt
// @access  Private
exports.getPaymentReceipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id
  })
  .populate({
    path: 'payee',
    select: 'name nickname category address'
  })
  .populate({
    path: 'account',
    select: 'name accountNumber type'
  })
  .populate({
    path: 'bill',
    select: 'dueDate'
  })
  .populate({
    path: 'user',
    select: 'name email'
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  // Format receipt data
  const receipt = {
    id: payment._id,
    confirmationNumber: payment.confirmationNumber,
    date: payment.date,
    payee: {
      name: payment.payee.name,
      category: payment.payee.category,
      address: payment.payee.address
    },
    amount: payment.amount,
    status: payment.status,
    account: {
      name: payment.account.name,
      accountNumber: payment.account.accountNumber,
      type: payment.account.type
    },
    memo: payment.memo || 'No memo provided',
    paidBy: {
      name: payment.user.name,
      email: payment.user.email
    },
    scheduledDate: payment.date,
    processingDate: payment.processingDate || null,
    billDate: payment.bill ? payment.bill.dueDate : null
  };
  
  res.status(200).json({
    success: true,
    data: receipt
  });
});

// @desc    Update payment details
// @route   PUT /api/payments/:id
// @access  Private
exports.updatePayment = asyncHandler(async (req, res) => {
  let payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  // Only allow updates for pending payments
  if (payment.status !== 'Pending') {
    return res.status(400).json({
      success: false,
      error: 'Only pending payments can be updated'
    });
  }
  
  // Handle amount changes by updating account balance
  if (req.body.amount && req.body.amount !== payment.amount) {
    const account = await Account.findById(payment.account);
    if (account) {
      // Revert the old amount
      if (account.type === 'checking' || account.type === 'savings') {
        account.balance += payment.amount;
        account.balance -= req.body.amount;
      } else if (account.type === 'credit') {
        account.balance -= payment.amount;
        account.balance += req.body.amount;
      }
      await account.save();
    }
  }
  
  // Calculate nextPaymentDate if frequency is changed
  if (req.body.paymentFrequency && req.body.paymentFrequency !== 'once') {
    const paymentDate = new Date(req.body.date || payment.date);
    
    if (req.body.paymentFrequency === 'weekly') {
      paymentDate.setDate(paymentDate.getDate() + 7);
    } else if (req.body.paymentFrequency === 'monthly') {
      paymentDate.setMonth(paymentDate.getMonth() + 1);
    }
    
    req.body.nextPaymentDate = paymentDate;
  } else if (req.body.paymentFrequency === 'once') {
    req.body.nextPaymentDate = null;
  }
  
  // Update payment
  payment = await Payment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate({
    path: 'payee',
    select: 'name nickname category'
  }).populate({
    path: 'account',
    select: 'name accountNumber'
  });
  
  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private
exports.deletePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
  
  // Only allow deletion of pending payments
  if (payment.status !== 'Pending') {
    return res.status(400).json({
      success: false,
      error: 'Only pending payments can be deleted'
    });
  }
  
  // Revert account balance changes
  const account = await Account.findById(payment.account);
  if (account) {
    if (account.type === 'checking' || account.type === 'savings') {
      account.balance += payment.amount;
    } else if (account.type === 'credit') {
      account.balance -= payment.amount;
    }
    await account.save();
  }
  
  // If payment is tied to a bill, update the bill
  if (payment.bill) {
    const bill = await Bill.findById(payment.bill);
    if (bill) {
      bill.status = 'upcoming';
      bill.paymentSource = null;
      bill.paymentAmount = null;
      await bill.save();
    }
  }
  
  await payment.remove();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get upcoming automatic payments
// @route   GET /api/payments/autopay
// @access  Private
exports.getAutopayments = asyncHandler(async (req, res) => {
  const autopayments = await Payment.find({
    user: req.user.id,
    paymentFrequency: { $ne: 'once' },
    nextPaymentDate: { $ne: null }
  })
  .sort({ nextPaymentDate: 1 })
  .populate({
    path: 'payee',
    select: 'name nickname category'
  })
  .populate({
    path: 'account',
    select: 'name accountNumber'
  });
  
  res.status(200).json({
    success: true,
    count: autopayments.length,
    data: autopayments
  });
});

// @desc    Generate payment stats
// @route   GET /api/payments/stats
// @access  Private
exports.getPaymentStats = asyncHandler(async (req, res) => {
  // Get date range for stats (default: last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  // Get payment totals by category
  const categoryStats = await Payment.aggregate([
    {
      $match: {
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate },
        status: 'Processed'
      }
    },
    {
      $lookup: {
        from: 'payees',
        localField: 'payee',
        foreignField: '_id',
        as: 'payeeInfo'
      }
    },
    { $unwind: '$payeeInfo' },
    {
      $group: {
        _id: '$payeeInfo.category',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
  
  // Get payment totals by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const monthlyStats = await Payment.aggregate([
    {
      $match: {
        user: req.user._id,
        date: { $gte: sixMonthsAgo },
        status: 'Processed'
      }
    },
    {
      $group: {
        _id: { $month: '$date' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Format monthly stats with month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const formattedMonthlyStats = monthlyStats.map(stat => ({
    month: monthNames[stat._id - 1],
    totalAmount: stat.totalAmount,
    count: stat.count
  }));
  
  // Get top payees by payment amount
  const topPayees = await Payment.aggregate([
    {
      $match: {
        user: req.user._id,
        status: 'Processed',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'payees',
        localField: 'payee',
        foreignField: '_id',
        as: 'payeeInfo'
      }
    },
    { $unwind: '$payeeInfo' },
    {
      $group: {
        _id: '$payee',
        payeeName: { $first: '$payeeInfo.name' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } },
    { $limit: 5 }
  ]);
  
  // Get payment stats by account
  const accountStats = await Payment.aggregate([
    {
      $match: {
        user: req.user._id,
        status: 'Processed',
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'accounts',
        localField: 'account',
        foreignField: '_id',
        as: 'accountInfo'
      }
    },
    { $unwind: '$accountInfo' },
    {
      $group: {
        _id: '$account',
        accountName: { $first: '$accountInfo.name' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
  
  res.status(200).json({
    success: true,
    data: {
      categoryStats,
      monthlyStats: formattedMonthlyStats,
      topPayees,
      accountStats,
      totalProcessed: {
        amount: categoryStats.reduce((total, cat) => total + cat.totalAmount, 0),
        count: categoryStats.reduce((total, cat) => total + cat.count, 0)
      }
    }
  });
});

// @desc    Get recurring payment summary
// @route   GET /api/payments/recurring
// @access  Private
exports.getRecurringPayments = asyncHandler(async (req, res) => {
  const recurringPayments = await Payment.find({
    user: req.user.id,
    paymentFrequency: { $ne: 'once' }
  })
  .populate({
    path: 'payee',
    select: 'name nickname category'
  })
  .populate({
    path: 'account',
    select: 'name accountNumber type'
  });
  
  // Group by frequency
  const grouped = {
    weekly: recurringPayments.filter(p => p.paymentFrequency === 'weekly'),
    monthly: recurringPayments.filter(p => p.paymentFrequency === 'monthly')
  };
  
  // Calculate total monthly cost
  const weeklyCost = grouped.weekly.reduce((sum, payment) => sum + payment.amount, 0);
  const monthlyCost = grouped.monthly.reduce((sum, payment) => sum + payment.amount, 0);
  const totalMonthlyCost = monthlyCost + (weeklyCost * 4); // Approximate weekly to monthly
  
  res.status(200).json({
    success: true,
    data: {
      recurring: recurringPayments,
      grouped,
      summary: {
        total: recurringPayments.length,
        weekly: grouped.weekly.length,
        monthly: grouped.monthly.length,
        weeklyCost,
        monthlyCost,
        totalMonthlyCost
      }
    }
  });
});

// @desc    Get payment calendar events
// @route   GET /api/payments/calendar
// @access  Private
exports.getPaymentCalendar = asyncHandler(async (req, res) => {
  // Get month and year from query or use current month
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  
  // Create date range for the specified month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  // Get all payments in the date range
  const payments = await Payment.find({
    user: req.user.id,
    $or: [
      { date: { $gte: startDate, $lte: endDate } },
      { nextPaymentDate: { $gte: startDate, $lte: endDate } }
    ]
  })
  .populate({
    path: 'payee',
    select: 'name category'
  });
  
  // Get bills due in the date range
  const bills = await Bill.find({
    user: req.user.id,
    dueDate: { $gte: startDate, $lte: endDate }
  })
  .populate({
    path: 'payee',
    select: 'name category'
  });
  
  // Format calendar events
  const calendarEvents = [
    // Payment events
    ...payments.map(payment => ({
      id: `payment-${payment._id}`,
      title: `Payment: ${payment.payee.name}`,
      date: format(payment.date, 'yyyy-MM-dd'),
      type: 'payment',
      status: payment.status,
      amount: payment.amount,
      category: payment.payee.category
    })),
    
    // Next scheduled payment events for recurring payments
    ...payments
      .filter(payment => payment.nextPaymentDate && payment.paymentFrequency !== 'once')
      .map(payment => ({
        id: `next-payment-${payment._id}`,
        title: `Next Payment: ${payment.payee.name}`,
        date: format(payment.nextPaymentDate, 'yyyy-MM-dd'),
        type: 'scheduled',
        frequency: payment.paymentFrequency,
        amount: payment.amount,
        category: payment.payee.category
      })),
    
    // Bill due date events
    ...bills.map(bill => ({
      id: `bill-${bill._id}`,
      title: `Due: ${bill.payee.name}`,
      date: format(bill.dueDate, 'yyyy-MM-dd'),
      type: 'bill',
      status: bill.status,
      amount: bill.amount,
      category: bill.payee.category,
      autopay: bill.autopay
    }))
  ];
  
  res.status(200).json({
    success: true,
    data: {
      month,
      year,
      events: calendarEvents
    }
  });
});

// @desc    Schedule recurring payments
// @route   POST /api/payments/recurring
// @access  Private
exports.scheduleRecurringPayment = asyncHandler(async (req, res) => {
  // Add user to request body
  req.body.user = req.user.id;
  
  // Validate payee
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
  
  // Validate account
  const account = await Account.findOne({
    _id: req.body.account,
    user: req.user.id
  });
  
  if (!account) {
    return res.status(400).json({
      success: false,
      error: 'Invalid account selected'
    });
  }
  
  // Require a frequency for recurring payments
  if (!req.body.paymentFrequency || req.body.paymentFrequency === 'once') {
    return res.status(400).json({
      success: false,
      error: 'A frequency must be specified for recurring payments'
    });
  }
  
  // Calculate next payment date based on frequency
  const startDate = new Date(req.body.startDate || new Date());
  let nextPaymentDate;
  
  if (req.body.paymentFrequency === 'weekly') {
    nextPaymentDate = new Date(startDate);
    nextPaymentDate.setDate(startDate.getDate() + 7);
  } else if (req.body.paymentFrequency === 'monthly') {
    nextPaymentDate = new Date(startDate);
    nextPaymentDate.setMonth(startDate.getMonth() + 1);
  }
  
  // Create initial payment
  const payment = await Payment.create({
    ...req.body,
    date: startDate,
    nextPaymentDate,
    status: 'Pending',
    confirmationNumber: `RC${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`,
    isRecurring: true
  });
  
  // Update account balance
  if (account.type === 'checking' || account.type === 'savings') {
    account.balance -= req.body.amount;
  } else if (account.type === 'credit') {
    account.balance += req.body.amount;
  }
  
  await account.save();
  
  // Populate related information
  const populatedPayment = await Payment.findById(payment._id)
    .populate({
      path: 'payee',
      select: 'name nickname category'
    })
    .populate({
      path: 'account',
      select: 'name accountNumber'
    });
    
  res.status(201).json({
    success: true,
    data: populatedPayment
  });
});

// @desc    Update recurring payment
// @route   PUT /api/payments/recurring/:id
// @access  Private
exports.updateRecurringPayment = asyncHandler(async (req, res) => {
  let payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id,
    isRecurring: true
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Recurring payment not found'
    });
  }
  
  // Handle amount changes by updating account balance
  if (req.body.amount && req.body.amount !== payment.amount) {
    const account = await Account.findById(payment.account);
    if (account) {
      // Revert the old amount
      if (account.type === 'checking' || account.type === 'savings') {
        account.balance += payment.amount;
        account.balance -= req.body.amount;
      } else if (account.type === 'credit') {
        account.balance -= payment.amount;
        account.balance += req.body.amount;
      }
      await account.save();
    }
  }
  
  // Recalculate next payment date if frequency is changed
  if (req.body.paymentFrequency && req.body.paymentFrequency !== payment.paymentFrequency) {
    const baseDate = new Date(req.body.startDate || payment.date);
    
    if (req.body.paymentFrequency === 'weekly') {
      baseDate.setDate(baseDate.getDate() + 7);
    } else if (req.body.paymentFrequency === 'monthly') {
      baseDate.setMonth(baseDate.getMonth() + 1);
    }
    
    req.body.nextPaymentDate = baseDate;
  }
  
  // Update payment
  payment = await Payment.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate({
    path: 'payee',
    select: 'name nickname category'
  }).populate({
    path: 'account',
    select: 'name accountNumber'
  });
  
  res.status(200).json({
    success: true,
    data: payment
  });
});

// @desc    Cancel recurring payment
// @route   DELETE /api/payments/recurring/:id
// @access  Private
exports.cancelRecurringPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    user: req.user.id,
    isRecurring: true
  });
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Recurring payment not found'
    });
  }
  
  // Update payment to show it's been canceled
  payment.status = 'Canceled';
  payment.isRecurring = false;
  payment.nextPaymentDate = null;
  await payment.save();
  
  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Generate payment report
// @route   GET /api/payments/report
// @access  Private
exports.generatePaymentReport = asyncHandler(async (req, res) => {
  // Get date range from query parameters
  const { startDate, endDate, category, payee, status } = req.query;
  
  let query = { user: req.user.id };
  
  // Add date range to query if provided
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  // Add status filter if provided
  if (status && status !== 'all') {
    query.status = status;
  }
  
  // Handle payee filter if provided
  if (payee) {
    const payeeObj = await Payee.findOne({
      _id: payee,
      user: req.user.id
    });
    
    if (payeeObj) {
      query.payee = payeeObj._id;
    }
  }
  
  // Handle category filter if provided
  if (category) {
    // Find payees in the specified category
    const categoryPayees = await Payee.find({
      user: req.user.id,
      category
    });
    
    const payeeIds = categoryPayees.map(p => p._id);
    query.payee = { $in: payeeIds };
  }
  
  // Get payments based on the query
  const payments = await Payment.find(query)
    .sort({ date: -1 })
    .populate({
      path: 'payee',
      select: 'name nickname category'
    })
    .populate({
      path: 'account',
      select: 'name accountNumber type'
    });
  
  // Calculate report summary
  const summary = {
    totalPayments: payments.length,
    totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
    byStatus: {
      Pending: payments.filter(p => p.status === 'Pending').length,
      Processed: payments.filter(p => p.status === 'Processed').length,
      Failed: payments.filter(p => p.status === 'Failed').length,
      Canceled: payments.filter(p => p.status === 'Canceled').length
    },
    dateRange: {
      start: startDate ? new Date(startDate) : null,
      end: endDate ? new Date(endDate) : null
    }
  };
  
  res.status(200).json({
    success: true,
    data: {
      payments,
      summary
    }
  });
});

module.exports = exports;