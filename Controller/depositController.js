// controllers/depositController.js
const Deposit = require('../Model/depositModel');
const Account = require('../Model/Account');
const DepositLimit = require('../Model/depositLimitModel');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure multer for image storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper to calculate availability date (next business day)
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

// Helper to generate reference number
const generateReferenceNumber = () => {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DEP-${timestamp}-${random}`;
};

// Helper to check and update deposit limits
const checkAndUpdateLimits = async (userId, amount) => {
  try {
    let limits = await DepositLimit.findOne({ userId });
    
    // Create default limits if none exist
    if (!limits) {
      limits = new DepositLimit({
        userId,
        dailyDeposited: 0,
        monthlyDeposited: 0
      });
    }
    
    // Reset daily limit if past reset date
    const now = new Date();
    if (now > limits.dailyResetDate) {
      limits.dailyDeposited = 0;
      limits.dailyResetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
    
    // Reset monthly limit if past reset date
    if (now > limits.monthlyResetDate) {
      limits.monthlyDeposited = 0;
      limits.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
    
    // Check limits
    if (amount < limits.minAmount) {
      return { success: false, message: `Minimum deposit amount is $${limits.minAmount}` };
    }
    
    if (amount > limits.maxAmount) {
      return { success: false, message: `Maximum deposit amount is $${limits.maxAmount}` };
    }
    
    if (amount + limits.dailyDeposited > limits.dailyLimit) {
      return { success: false, message: `This deposit would exceed your daily limit of $${limits.dailyLimit}` };
    }
    
    if (amount + limits.monthlyDeposited > limits.monthlyLimit) {
      return { success: false, message: `This deposit would exceed your monthly limit of $${limits.monthlyLimit}` };
    }
    
    // Update limits
    limits.dailyDeposited += amount;
    limits.monthlyDeposited += amount;
    await limits.save();
    
    return { 
      success: true, 
      dailyDepositedAmount: limits.dailyDeposited,
      dailyLimitRemaining: limits.dailyLimit - limits.dailyDeposited,
      limits
    };
  } catch (error) {
    console.error('Error checking deposit limits:', error);
    return { success: false, message: 'Error checking deposit limits' };
  }
};

// Send receipt (mock implementation)
const sendReceipt = async (deposit, user, type) => {
  console.log(`Sending ${type} receipt to user ${user._id} for deposit ${deposit._id}`);
  // In a real implementation, you would send an email or SMS here
  return true;
};

// Get deposit limits for current user
exports.getDepositLimits = async (req, res) => {
  try {
    const userId = req.user._id;
    let limits = await DepositLimit.findOne({ userId });
    
    // Create default limits if none exist
    if (!limits) {
      limits = new DepositLimit({
        userId,
        dailyDeposited: 0,
        monthlyDeposited: 0
      });
      await limits.save();
    }
    
    // Reset daily and monthly limits if needed
    const now = new Date();
    if (now > limits.dailyResetDate) {
      limits.dailyDeposited = 0;
      limits.dailyResetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      await limits.save();
    }
    
    if (now > limits.monthlyResetDate) {
      limits.monthlyDeposited = 0;
      limits.monthlyResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      await limits.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        minAmount: limits.minAmount,
        maxAmount: limits.maxAmount,
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit,
        dailyDepositedAmount: limits.dailyDeposited,
        dailyLimitRemaining: limits.dailyLimit - limits.dailyDeposited,
        monthlyDepositedAmount: limits.monthlyDeposited,
        monthlyLimitRemaining: limits.monthlyLimit - limits.monthlyDeposited
      }
    });
  } catch (error) {
    console.error('Error getting deposit limits:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve deposit limits'
    });
  }
};


// Get user accounts
exports.getUserAccounts = async (req, res) => {
    try {
      const userId = req.user._id;
      let accounts = await Account.find({ userId });
      
      if (!accounts || accounts.length === 0) {
        // Create default accounts if none exist (for demonstration)
        const defaultAccounts = [
          {
            userId,
            accountId: 'checking',
            name: 'Everyday Checking',
            number: '****5678',
            balance: 4578.92,
            available: 4578.92,
            type: 'checking',
            recentDeposits: 0
          },
          {
            userId,
            accountId: 'savings',
            name: 'Way2Save Savings',
            number: '****9012',
            balance: 20345.67,
            available: 20345.67,
            type: 'savings',
            recentDeposits: 0
          },
          {
            userId,
            accountId: 'businessChecking',
            name: 'Business Checking',
            number: '****3456',
            balance: 35789.45,
            available: 35109.45,
            type: 'businessChecking',
            recentDeposits: 0
          }
        ];
        
        accounts = await Account.insertMany(defaultAccounts);
      }
      
      // Format the accounts to match what the frontend expects
      const formattedAccounts = accounts.map(account => ({
        id: account.accountId,
        name: account.name,
        number: account.number,
        balance: account.balance,
        available: account.available,
        type: account.type
      }));
      
      // Return accounts directly instead of nesting under data
      res.status(200).json({
        accounts: formattedAccounts
      });
    } catch (error) {
      console.error('Error getting user accounts:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve accounts'
      });
    }
  };

// Get deposit history
exports.getDepositHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const deposits = await Deposit.find({ userId }).sort({ depositDate: -1 });
    
    res.status(200).json({
      status: 'success',
      data: deposits
    });
  } catch (error) {
    console.error('Error getting deposit history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve deposit history'
    });
  }
};

// Submit a new deposit
exports.submitDeposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      accountId,
      amount,
      frontImageBase64,
      backImageBase64,
      emailReceipt,
      mobileReceipt,
      endorsementConfirmed,
      saveInformation
    } = req.body;
    
    // Validate input
    if (!accountId || !amount || !frontImageBase64 || !backImageBase64) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }
    
    // Validate amount
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid deposit amount'
      });
    }
    
    // Check deposit limits
    const limitsCheck = await checkAndUpdateLimits(userId, numAmount);
    if (!limitsCheck.success) {
      return res.status(400).json({
        status: 'error',
        message: limitsCheck.message
      });
    }
    
    // Verify account exists
    const account = await Account.findOne({ userId, accountId });
    if (!account) {
      return res.status(404).json({
        status: 'error',
        message: 'Account not found'
      });
    }
    
    // Process images (in a real implementation, you would save these to a storage service)
    const saveFrontImage = async (base64Image) => {
      // Remove the data:image/jpeg;base64, prefix
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileName = `front-${Date.now()}.jpg`;
      const filePath = path.join(__dirname, '../uploads', fileName);
      
      await fs.promises.writeFile(filePath, buffer);
      return `/uploads/${fileName}`;
    };
    
    const saveBackImage = async (base64Image) => {
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const fileName = `back-${Date.now()}.jpg`;
      const filePath = path.join(__dirname, '../uploads', fileName);
      
      await fs.promises.writeFile(filePath, buffer);
      return `/uploads/${fileName}`;
    };
    
    const frontImagePath = await saveFrontImage(frontImageBase64);
    const backImagePath = await saveBackImage(backImageBase64);
    
    // Calculate availability date
    const availabilityDate = calculateAvailabilityDate();
    
    // Create deposit record
    const newDeposit = new Deposit({
      userId,
      accountId,
      amount: numAmount,
      frontImage: frontImagePath,
      backImage: backImagePath,
      referenceNumber: generateReferenceNumber(),
      depositDate: new Date(),
      availabilityDate,
      status: 'Pending',
      emailReceipt: emailReceipt || false,
      mobileReceipt: mobileReceipt || false,
      endorsementConfirmed
    });
    
    await newDeposit.save();
    
    // Update account (in a real implementation, this would be pending until verification)
    account.recentDeposits += numAmount;
    await account.save();
    
    // Send receipts if requested
    if (emailReceipt) {
      sendReceipt(newDeposit, req.user, 'email');
    }
    
    if (mobileReceipt) {
      sendReceipt(newDeposit, req.user, 'mobile');
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        deposit: newDeposit,
        dailyDepositedAmount: limitsCheck.dailyDepositedAmount,
        dailyLimitRemaining: limitsCheck.dailyLimitRemaining
      }
    });
  } catch (error) {
    console.error('Error submitting deposit:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to submit deposit'
    });
  }
};

// Get a single deposit by reference number
exports.getDepositByReference = async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const userId = req.user._id;
    
    const deposit = await Deposit.findOne({ userId, referenceNumber });
    
    if (!deposit) {
      return res.status(404).json({
        status: 'error',
        message: 'Deposit not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: deposit
    });
  } catch (error) {
    console.error('Error getting deposit:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve deposit information'
    });
  }
};