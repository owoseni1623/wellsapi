const mongoose = require('mongoose');
const User = require('../Model/UserModel');
// const CheckingAccount = require('../Model/CheckDepositLimit');
const CheckingAccount = require('../Model/CheckingAccountModel');
const { generateTransactionReference } = require('../Utils/transactionUtils');

/**
 * @desc    Get checking account by ID
 * @route   GET /api/checking/:accountId
 * @access  Private
 */
exports.getCheckingAccount = async (req, res) => {
  console.log(`getCheckingAccount called for accountId: ${req.params.accountId}`);
 
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
   
    console.log(`Fetching account for userId: ${userId}`);
    
    // Check if user exists and has account information in the User model
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
   
    // DEBUG: List all checking accounts for this user from CheckingAccount collection
    const allUserAccounts = await CheckingAccount.find({ userId: userId });
    console.log(`User has ${allUserAccounts.length} checking accounts in CheckingAccount collection`);
    
    // If user has no checking accounts in CheckingAccount collection, but has accounts in User model
    // then create checking account from User model data
    if (allUserAccounts.length === 0 && user.accounts && user.accounts.length > 0) {
      console.log('User has accounts in User model but none in CheckingAccount collection. Creating...');
      
      // Find checking accounts in user.accounts array
      const checkingAccounts = user.accounts.filter(acc => 
        acc.accountType && acc.accountType.toLowerCase() === 'checking' || 
        !acc.accountType // If accountType is not specified, assume it's checking
      );
      
      if (checkingAccounts.length > 0) {
        // Create checking accounts from user.accounts data
        for (let i = 0; i < checkingAccounts.length; i++) {
          const acc = checkingAccounts[i];
          
          const newCheckingAccount = new CheckingAccount({
            userId: userId,
            type: acc.accountName || 'Everyday Checking',
            accountNumber: acc.accountNumber,
            routingNumber: acc.routingNumber || '121000248',
            balance: acc.balance || 0,
            availableBalance: acc.balance || 0,
            isPrimary: i === 0, // First account is primary
            openedDate: user.createdAt || new Date(),
            // Add some initial transactions based on the balance
            transactions: [{
              date: user.createdAt || new Date(),
              description: 'Initial Deposit',
              status: 'Completed',
              type: 'deposit',
              amount: acc.balance || 0,
              balance: acc.balance || 0
            }]
          });
          
          await newCheckingAccount.save();
          console.log(`Created checking account ${newCheckingAccount.accountNumber} for user ${user.email}`);
          
          // If user has checkingAccounts array, update it
          if (!user.checkingAccounts) {
            user.checkingAccounts = [];
          }
          
          user.checkingAccounts.push(newCheckingAccount._id);
        }
        
        await user.save();
        console.log('Updated user with references to new checking accounts');
        
        // Re-fetch the accounts after creation
        allUserAccounts = await CheckingAccount.find({ userId: userId });
      }
    }
    
    // Special handling for primary account
    if (accountId === 'primary') {
      // First try to find a primary account
      let primaryAccount = await CheckingAccount.findOne({
        userId: userId,
        isPrimary: true
      });
     
      // If no primary found, get the first checking account
      if (!primaryAccount && allUserAccounts.length > 0) {
        primaryAccount = allUserAccounts[0];
        
        // Mark this account as primary for future reference
        primaryAccount.isPrimary = true;
        await primaryAccount.save();
      }
     
      if (!primaryAccount) {
        // If still no account, check if we need to create one from user.accounts data
        if (user.accounts && user.accounts.length > 0) {
          const firstAccount = user.accounts[0];
          
          // Create a checking account from the first user account
          const newCheckingAccount = new CheckingAccount({
            userId: userId,
            type: firstAccount.accountName || 'Everyday Checking',
            accountNumber: firstAccount.accountNumber || Math.floor(Math.random() * 9000000000) + 1000000000,
            routingNumber: firstAccount.routingNumber || '121000248',
            balance: firstAccount.balance || 600000,
            availableBalance: firstAccount.balance || 600000,
            isPrimary: true,
            openedDate: user.createdAt || new Date(),
            transactions: [{
              date: user.createdAt || new Date(),
              description: 'Initial Deposit',
              status: 'Completed',
              type: 'deposit',
              amount: firstAccount.balance || 600000,
              balance: firstAccount.balance || 600000
            }]
          });
          
          await newCheckingAccount.save();
          console.log(`Created primary checking account for user ${user.email}`);
          
          // Update user reference
          if (!user.checkingAccounts) {
            user.checkingAccounts = [];
          }
          user.checkingAccounts.push(newCheckingAccount._id);
          await user.save();
          
          primaryAccount = newCheckingAccount;
        } else {
          // Create a default checking account if no accounts exist
          const newCheckingAccount = new CheckingAccount({
            userId: userId,
            type: 'Everyday Checking',
            accountNumber: Math.floor(Math.random() * 9000000000) + 1000000000,
            routingNumber: '121000248',
            balance: 600000,
            availableBalance: 600000,
            isPrimary: true,
            transactions: [{
              date: new Date(),
              description: 'Initial Deposit',
              status: 'Completed',
              type: 'deposit',
              amount: 600000,
              balance: 600000
            }]
          });
          
          await newCheckingAccount.save();
          console.log(`Created default checking account for user ${user.email}`);
          
          // Update user reference
          if (!user.checkingAccounts) {
            user.checkingAccounts = [];
          }
          user.checkingAccounts.push(newCheckingAccount._id);
          await user.save();
          
          primaryAccount = newCheckingAccount;
        }
      }
     
      // Send response with primary account
      return sendFormattedAccountResponse(primaryAccount, res);
    }
   
    // For specific account ID
    let checkingAccount;
    try {
      // First try to find by MongoDB ObjectId
      if (mongoose.Types.ObjectId.isValid(accountId)) {
        checkingAccount = await CheckingAccount.findOne({
          _id: accountId,
          userId: userId
        });
      }
     
      // If not found, try finding by accountNumber
      if (!checkingAccount) {
        checkingAccount = await CheckingAccount.findOne({
          accountNumber: accountId,
          userId: userId
        });
      }
     
      console.log('Account lookup result:', checkingAccount ? 'Account found' : 'No account found');
    } catch (lookupError) {
      console.error('Error during account lookup:', lookupError);
      throw lookupError;
    }
   
    if (!checkingAccount) {
      // If we couldn't find the specific account, but there is a matching account in user.accounts
      if (user.accounts && user.accounts.length > 0) {
        const matchingAccount = user.accounts.find(acc => 
          acc.accountNumber === accountId || 
          (mongoose.Types.ObjectId.isValid(accountId) && acc._id && acc._id.toString() === accountId)
        );
        
        if (matchingAccount) {
          // Check if an account with this number already exists
          const existingAccountWithNumber = await CheckingAccount.findOne({
            accountNumber: matchingAccount.accountNumber
          });
          
          if (existingAccountWithNumber) {
            // If an account with this number already exists, use it instead of creating a new one
            checkingAccount = existingAccountWithNumber;
            console.log(`Found existing checking account with number: ${matchingAccount.accountNumber}`);
          } else {
            // Create a new checking account only if no account with this number exists
            const newCheckingAccount = new CheckingAccount({
              userId: userId,
              type: matchingAccount.accountName || 'Everyday Checking',
              accountNumber: matchingAccount.accountNumber,
              routingNumber: matchingAccount.routingNumber || '121000248',
              balance: matchingAccount.balance || 0,
              availableBalance: matchingAccount.balance || 0,
              isPrimary: allUserAccounts.length === 0, // Set as primary if it's the first account
              openedDate: user.createdAt || new Date(),
              transactions: [{
                date: user.createdAt || new Date(),
                description: 'Initial Deposit',
                status: 'Completed',
                type: 'deposit',
                amount: matchingAccount.balance || 0,
                balance: matchingAccount.balance || 0
              }]
            });
            
            await newCheckingAccount.save();
            console.log(`Created checking account from user.accounts data for accountId: ${accountId}`);
            
            // Update user reference
            if (!user.checkingAccounts) {
              user.checkingAccounts = [];
            }
            user.checkingAccounts.push(newCheckingAccount._id);
            await user.save();
            
            checkingAccount = newCheckingAccount;
          }
        }
      }
      
      // If still no checking account found, offer primary account as fallback
      if (!checkingAccount && allUserAccounts.length > 0) {
        console.log('Offering primary account as fallback since user has other accounts');
        return sendFormattedAccountResponse(allUserAccounts[0], res);
      }
     
      // If still no checking account, return 404
      if (!checkingAccount) {
        return res.status(404).json({
          success: false,
          error: 'Checking account not found or not associated with this user'
        });
      }
    }
   
    // Send response with the found account
    return sendFormattedAccountResponse(checkingAccount, res);
   
  } catch (error) {
    console.error('Error in getCheckingAccount:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching checking account details'
    });
  }
};

// Helper function to format and send account response
function sendFormattedAccountResponse(checkingAccount, res) {
  // Format transactions by date (newest first)
  const sortedTransactions = checkingAccount.transactions
    ? checkingAccount.transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  // Format account data for frontend
  const formattedAccount = {
    id: checkingAccount._id,
    accountNumber: maskAccountNumber(checkingAccount.accountNumber),
    routingNumber: checkingAccount.routingNumber,
    type: checkingAccount.type || 'Everyday Checking',
    accountName: checkingAccount.accountName || checkingAccount.type || 'Checking Account',
    balance: checkingAccount.balance,
    availableBalance: checkingAccount.availableBalance || checkingAccount.balance,
    openedDate: checkingAccount.openedDate || checkingAccount.createdAt,
    monthlyFee: (checkingAccount.monthlyFee || 0).toFixed(2),
    minBalance: (checkingAccount.minBalance || 0).toFixed(2),
    overdraftProtection: checkingAccount.overdraftProtection ? 'Enabled' : 'Disabled',
    interestRate: `${checkingAccount.interestRate || 0}%`,
    transactions: sortedTransactions.map(transaction => ({
      id: transaction._id,
      date: transaction.date,
      description: transaction.description,
      type: mapTransactionType(transaction.type, transaction.category),
      amount: transaction.amount,
      balance: transaction.balance,
      status: transaction.status || 'Completed'
    }))
  };

  return res.status(200).json({
    success: true,
    data: formattedAccount
  });
}

/**
 * @desc    Get transactions for specific checking account
 * @route   GET /api/checking/:accountId/transactions
 * @access  Private
 */
exports.getCheckingTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { filter, dateRange } = req.query;
    
    // Find the specific checking account that belongs to the user
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specified account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // Get all transactions
    let transactions = [...account.transactions];
    
    // Apply type filter
    if (filter && filter !== 'all') {
      // Filter based on transaction type and category
      transactions = transactions.filter(transaction => {
        if (filter === 'deposit') {
          return transaction.type === 'credit';
        } else if (filter === 'withdrawal') {
          return transaction.type === 'debit' && transaction.category === 'withdrawal';
        } else if (filter === 'payment') {
          return transaction.type === 'debit' && transaction.category === 'payment';
        } else if (filter === 'purchase') {
          return transaction.type === 'debit' && transaction.category === 'purchase';
        }
        return true;
      });
    }
    
    // Apply date filter
    if (dateRange) {
      const today = new Date();
      let startDate = new Date(0); // Beginning of time
      
      if (dateRange === '30days') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
      } else if (dateRange === '60days') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 60);
      } else if (dateRange === '90days') {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 90);
      }
      
      transactions = transactions.filter(transaction => 
        new Date(transaction.date) >= startDate
      );
    }
    
    // Sort by date (newest first)
    transactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Format for frontend
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      date: transaction.date,
      description: transaction.description,
      type: mapTransactionType(transaction.type, transaction.category),
      amount: transaction.amount,
      balance: transaction.balance,
      status: transaction.status
    }));
    
    return res.status(200).json({
      success: true,
      count: formattedTransactions.length,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching checking transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching checking transactions'
    });
  }
};

/**
 * @desc    Download statement for specific checking account
 * @route   POST /api/checking/:accountId/statement
 * @access  Private
 */
exports.downloadStatement = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { period, format } = req.body;
    
    // Find user and verify account ownership
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specific account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // In a real implementation, you would:
    // 1. Generate a PDF or CSV statement based on format
    // 2. Include transactions for the specified period
    // 3. Either return a download link or stream the file
    
    // For this example, we'll just acknowledge the request
    return res.status(200).json({
      success: true,
      data: {
        message: `Statement for period ${period} will be prepared for download in ${format} format`,
        downloadUrl: `/api/statements/${accountId}_${period}.${format}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Link expires in 24 hours
      }
    });
  } catch (error) {
    console.error('Error generating statement:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while generating statement'
    });
  }
};

/**
 * @desc    Set up auto-pay for specific checking account
 * @route   POST /api/checking/:accountId/autopay
 * @access  Private
 */
exports.setupAutoPay = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { payee, amount, frequency, startDate, endDate } = req.body;
    
    // Validate required fields
    if (!payee || !amount || !frequency || !startDate) {
      return res.status(400).json({
        success: false, 
        error: 'Please provide payee, amount, frequency, and start date'
      });
    }
    
    // Find user and verify account ownership
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specific account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // Create auto-pay setup
    const newAutoPay = {
      payee,
      amount,
      frequency,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: 'Active',
      createdAt: new Date()
    };
    
    account.autoPayments.push(newAutoPay);
    await account.save();
    
    return res.status(201).json({
      success: true,
      data: newAutoPay
    });
  } catch (error) {
    console.error('Error setting up auto-pay:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while setting up auto-pay'
    });
  }
};

/**
 * @desc    Order checks for specific checking account
 * @route   POST /api/checking/:accountId/order-checks
 * @access  Private
 */
exports.orderChecks = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { quantity, design, shippingAddress } = req.body;
    
    // Validate required fields
    if (!quantity || !design || !shippingAddress) {
      return res.status(400).json({
        success: false, 
        error: 'Please provide quantity, design, and shipping address'
      });
    }
    
    // Find user and verify account ownership
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specific account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // Create a new check order
    const newOrder = {
      orderId: generateOrderReference(),
      quantity,
      design,
      shippingAddress,
      status: 'Processing',
      orderDate: new Date(),
      estimatedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
    };
    
    account.checkOrders.push(newOrder);
    await account.save();
    
    return res.status(201).json({
      success: true,
      data: newOrder
    });
  } catch (error) {
    console.error('Error ordering checks:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while ordering checks'
    });
  }
};

/**
 * @desc    Deposit money to checking account
 * @route   POST /api/checking/:accountId/deposit
 * @access  Private
 */
exports.depositMoney = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { amount, description, approvalCode } = req.body;
    
    console.log(`Processing deposit for account ${accountId}, amount: ${amount}`);
    
    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid positive amount'
      });
    }
    
    // Validate approval code
    if (!approvalCode) {
      return res.status(400).json({
        success: false,
        error: 'Transaction Approval Code is required to complete this deposit'
      });
    }
    
    // Find the specific account using proper methods
    let account;
    
    // Try to find by MongoDB ObjectId first
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      account = await CheckingAccount.findOne({
        _id: accountId,
        userId: userId
      });
    }
    
    // If not found by ObjectId, try finding by account number
    if (!account) {
      account = await CheckingAccount.findOne({
        accountNumber: accountId,
        userId: userId
      });
    }
    
    // If still not found, try to get primary account
    if (!account) {
      account = await CheckingAccount.findOne({
        userId: userId,
        isPrimary: true
      });
    }
    
    // If still no account found, return error
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Parse amount to ensure it's a number
    const depositAmount = parseFloat(amount);
    
    // Update balances
    const oldBalance = account.balance;
    account.balance += depositAmount;
    account.availableBalance += depositAmount;
    
    // Create transaction record
    const newTransaction = {
      date: new Date(),
      description: description || 'Deposit',
      status: 'Completed',
      type: 'credit',
      category: 'deposit',
      amount: depositAmount,
      balance: account.balance
    };
    
    // Add transaction to account
    account.transactions.push(newTransaction);
    
    // Save the updated account
    await account.save();
    
    console.log(`Deposit completed: $${depositAmount} added to account ${account.accountNumber}`);
    
    // Return the updated account information
    return res.status(200).json({
      success: true,
      data: {
        newBalance: account.balance,
        transaction: newTransaction
      },
      message: `Successfully deposited $${depositAmount} to account`
    });
  } catch (error) {
    console.error('Error depositing money:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while processing deposit'
    });
  }
};


/**
 * @desc    Dispute transaction for specific account
 * @route   POST /api/checking/:accountId/dispute-transaction
 * @access  Private
 */
exports.disputeTransaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { transactionId, reason, description } = req.body;
    
    // Validate required fields
    if (!transactionId || !reason) {
      return res.status(400).json({
        success: false, 
        error: 'Please provide transaction ID and reason for dispute'
      });
    }
    
    // Find user and verify account ownership
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specific account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // Find the transaction
    const transaction = account.transactions.id(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Create dispute case
    const newDispute = {
      disputeId: generateDisputeReference(),
      accountId: account._id,
      transactionId: transactionId,
      transactionDate: transaction.date,
      transactionAmount: transaction.amount,
      reason,
      description,
      status: 'Under Review',
      createdAt: new Date(),
      estimatedResolution: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) // 10 days from now
    };
    
    account.disputes.push(newDispute);
    await account.save();
    
    return res.status(201).json({
      success: true,
      data: newDispute
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while creating dispute'
    });
  }
};

/**
 * @desc    Setup account alerts for specific account
 * @route   POST /api/checking/:accountId/alerts
 * @access  Private
 */
exports.setupAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { alertType, threshold, notificationMethod } = req.body;
    
    // Validate required fields
    if (!alertType || !notificationMethod) {
      return res.status(400).json({
        success: false, 
        error: 'Please provide alert type and notification method'
      });
    }
    
    // Validate alert type
    const validAlertTypes = ['balance-low', 'large-transaction', 'deposit', 'withdrawal'];
    if (!validAlertTypes.includes(alertType)) {
      return res.status(400).json({
        success: false, 
        error: `Alert type must be one of: ${validAlertTypes.join(', ')}`
      });
    }
    
    // Find user and verify account ownership
    const user = await User.findById(userId).populate('checkingAccounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Verify that the account belongs to the user
    if (!user.checkingAccounts || !user.checkingAccounts.some(account => account._id.toString() === accountId)) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found or not associated with this user'
      });
    }
    
    // Get the specific account
    const account = await CheckingAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Checking account not found'
      });
    }
    
    // Create alert setup
    const newAlert = {
      alertType,
      threshold,
      notificationMethod,
      status: 'Active',
      createdAt: new Date()
    };
    
    account.alerts.push(newAlert);
    await account.save();
    
    return res.status(201).json({
      success: true,
      data: newAlert
    });
  } catch (error) {
    console.error('Error setting up alert:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while setting up alert'
    });
  }
};

// Helper functions
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '****0000';
  return '****' + accountNumber.slice(-4);
}

function mapTransactionType(type, category) {
  if (type === 'credit') {
    return 'deposit';
  }
  if (type === 'debit') {
    return category || 'withdrawal'; // return the category if present, otherwise default to withdrawal
  }
  return type;
}

function generateOrderReference() {
  return 'ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateDisputeReference() {
  return 'DSP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateAccountNumber() {
  // Generate a random 10-digit account number
  const min = 1000000000;
  const max = 9999999999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}