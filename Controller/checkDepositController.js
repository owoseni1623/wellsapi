const CheckDeposit = require('../Model/CheckDepositModel');
const Account = require('../Model/Account');
const CheckDepositLimit = require('../Model/CheckDepositLimit');
const { uploadImage, deleteImage } = require('../Utils/fileUpload');
const { generateReferenceNumber } = require('../Utils/helpers');

// Helper function to get deposit limits and usage
const getUserDepositLimits = async (userId) => {
  try {
    // Get user's deposit limits
    let userLimits = await CheckDepositLimit.findOne({ userId });
    
    // If no limits set, create default limits
    if (!userLimits) {
      userLimits = await CheckDepositLimit.create({
        userId,
        limits: {
          minAmount: 0.01,
          maxAmount: 10000,
          dailyLimit: 5000,
          monthlyLimit: 20000
        },
        depositTotals: {
          today: 0,
          currentMonth: 0,
          lastUpdated: new Date()
        }
      });
    }
    
    // Check if we need to reset daily/monthly totals
    const now = new Date();
    const lastUpdated = userLimits.depositTotals.lastUpdated;
    
    // Reset daily total if lastUpdated is not today
    if (now.toDateString() !== lastUpdated.toDateString()) {
      userLimits.depositTotals.today = 0;
    }
    
    // Reset monthly total if lastUpdated is not in current month
    if (now.getMonth() !== lastUpdated.getMonth() || 
        now.getFullYear() !== lastUpdated.getFullYear()) {
      userLimits.depositTotals.currentMonth = 0;
    }
    
    // Update lastUpdated timestamp
    userLimits.depositTotals.lastUpdated = now;
    await userLimits.save();
    
    return {
      limits: userLimits.limits,
      usedToday: userLimits.depositTotals.today,
      usedThisMonth: userLimits.depositTotals.currentMonth
    };
  } catch (error) {
    console.error('Error getting deposit limits:', error);
    throw new Error('Failed to retrieve deposit limits');
  }
};

// Helper function to calculate availability date
const calculateAvailabilityDate = () => {
  const today = new Date();
  let availDate = new Date(today);
  
  // Add one business day (skip weekends)
  availDate.setDate(today.getDate() + 1);
  if (availDate.getDay() === 0) { // Sunday
    availDate.setDate(availDate.getDate() + 1);
  } else if (availDate.getDay() === 6) { // Saturday
    availDate.setDate(availDate.getDate() + 2);
  }
  
  return availDate;
};

// Helper function to update deposit totals
const updateDepositTotals = async (userId, amount) => {
  try {
    const userLimits = await CheckDepositLimit.findOne({ userId });
    if (userLimits) {
      userLimits.depositTotals.today += amount;
      userLimits.depositTotals.currentMonth += amount;
      await userLimits.save();
    }
  } catch (error) {
    console.error('Error updating deposit totals:', error);
    throw new Error('Failed to update deposit limits');
  }
};

// Get deposit limits for current user
exports.getDepositLimits = async (req, res) => {
  try {
    const userId = req.user.id;
    const limitsData = await getUserDepositLimits(userId);
    
    res.status(200).json({
      success: true,
      limits: limitsData.limits,
      usedToday: limitsData.usedToday,
      usedThisMonth: limitsData.usedThisMonth
    });
  } catch (error) {
    console.error('Get deposit limits error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve deposit limits'
    });
  }
};

// Get accounts available for deposits
exports.getDepositAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's accounts that allow deposits
    const accounts = await Account.find({
      userId: userId,
      allowDeposits: true,
      isActive: true
    }).select('name number type balance routingNumber');
    
    res.status(200).json({
      success: true,
      accounts: accounts
    });
  } catch (error) {
    console.error('Get deposit accounts error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve accounts'
    });
  }
};

// Get deposit history
exports.getDepositHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Optional query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get user's deposit history
    const deposits = await CheckDeposit.find({ userId })
      .sort({ depositDate: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await CheckDeposit.countDocuments({ userId });
    
    res.status(200).json({
      success: true,
      deposits,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get deposit history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve deposit history'
    });
  }
};

// Submit a new deposit
exports.submitDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get form data
    const { 
      amount, 
      accountId, 
      emailReceipt, 
      mobileReceipt, 
      endorsementConfirmed,
      referenceNumber: providedRefNumber
    } = req.body;
    
    // Validate required fields
    if (!amount || !accountId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount and account'
      });
    }
    
    // Check if amount is a valid number
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid deposit amount'
      });
    }
    
    // Verify account exists and belongs to user
    const account = await Account.findOne({
      _id: accountId,
      userId,
      allowDeposits: true,
      isActive: true
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found or not eligible for deposits'
      });
    }
    
    // Check deposit limits
    const limitsData = await getUserDepositLimits(userId);
    
    if (depositAmount < limitsData.limits.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit amount is $${limitsData.limits.minAmount}`
      });
    }
    
    if (depositAmount > limitsData.limits.maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum deposit amount is $${limitsData.limits.maxAmount}`
      });
    }
    
    if (depositAmount + limitsData.usedToday > limitsData.limits.dailyLimit) {
      return res.status(400).json({
        success: false,
        message: `This deposit would exceed your daily limit of $${limitsData.limits.dailyLimit}`
      });
    }
    
    // Generate reference number if not provided
    const referenceNumber = providedRefNumber || generateReferenceNumber();
    
    // Check if files were uploaded
    if (!req.files || !req.files.frontImage || !req.files.backImage) {
      return res.status(400).json({
        success: false,
        message: 'Please provide images of both sides of the check'
      });
    }
    
    // Upload check images
    const frontImagePath = await uploadImage(req.files.frontImage, `checkDeposits/${userId}/front_${referenceNumber}`);
    const backImagePath = await uploadImage(req.files.backImage, `checkDeposits/${userId}/back_${referenceNumber}`);
    
    // Calculate availability date
    const availabilityDate = calculateAvailabilityDate();
    
    // Create deposit record
    const newDeposit = await CheckDeposit.create({
      userId,
      accountId,
      amount: depositAmount,
      frontImage: frontImagePath,
      backImage: backImagePath,
      referenceNumber,
      emailReceipt: emailReceipt === undefined ? true : emailReceipt,
      mobileReceipt: mobileReceipt === undefined ? true : mobileReceipt,
      endorsementConfirmed: endorsementConfirmed || false,
      availabilityDate,
      status: 'pending'
    });
    
    // Update account balance (pending deposit)
    account.balance += depositAmount;
    await account.save();
    
    // Update deposit totals for limits
    await updateDepositTotals(userId, depositAmount);
    
    // TODO: Send receipt if requested
    // This would typically be handled by a separate service
    
    res.status(201).json({
      success: true,
      deposit: {
        id: newDeposit._id,
        referenceNumber: newDeposit.referenceNumber,
        amount: newDeposit.amount,
        status: newDeposit.status,
        depositDate: newDeposit.depositDate,
        availabilityDate: newDeposit.availabilityDate
      },
      message: 'Deposit submitted successfully'
    });
  } catch (error) {
    console.error('Submit deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process deposit'
    });
  }
};

// Get details for a specific deposit
exports.getDepositDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const deposit = await CheckDeposit.findOne({
      _id: id,
      userId
    });
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      success: true,
      deposit
    });
  } catch (error) {
    console.error('Get deposit details error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve deposit details'
    });
  }
};

// Cancel a pending deposit
exports.cancelDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const deposit = await CheckDeposit.findOne({
      _id: id,
      userId,
      status: 'pending' // Can only cancel pending deposits
    });
    
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Pending deposit not found'
      });
    }
    
    // Update deposit status
    deposit.status = 'rejected';
    deposit.rejectionReason = 'Canceled by user';
    await deposit.save();
    
    // Revert account balance
    const account = await Account.findById(deposit.accountId);
    if (account) {
      account.balance -= deposit.amount;
      await account.save();
    }
    
    // Update deposit totals for limits
    const userLimits = await CheckDepositLimit.findOne({ userId });
    if (userLimits) {
      userLimits.depositTotals.today -= deposit.amount;
      userLimits.depositTotals.currentMonth -= deposit.amount;
      await userLimits.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Deposit canceled successfully'
    });
  } catch (error) {
    console.error('Cancel deposit error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel deposit'
    });
  }
};