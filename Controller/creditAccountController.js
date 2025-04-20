const mongoose = require('mongoose');
const CreditAccount = require('../Model/CreditAccountModel');
const User = require('../Model/UserModel');
const { validationResult } = require('express-validator');

// Get primary credit account for current user
const getPrimaryCreditAccount = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming auth middleware sets req.user
    
    // Find the primary credit account for this user
    let account = await CreditAccount.findOne({ 
      userId: userId,
      isPrimary: true,
      type: { $regex: /credit/i }
    });
    
    // If no primary account exists, get the first credit account
    if (!account) {
      account = await CreditAccount.findOne({ 
        userId: userId,
        type: { $regex: /credit/i }
      });
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'No credit account found for this user'
      });
    }
    
    // Format account data for frontend
    const formattedAccount = formatAccountForResponse(account);
    
    return res.status(200).json({
      success: true,
      data: formattedAccount
    });
  } catch (error) {
    console.error('Error fetching primary credit account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching primary credit account'
    });
  }
};

// Get credit account by ID
const getCreditAccountById = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    
    console.log(`Looking for credit account with ID: ${accountId} for user: ${userId}`);
    
    // Handle account IDs that start with any prefix
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    
    let account;
    // First try to find by cleaned account number
    account = await CreditAccount.findOne({ 
      accountNumber: cleanAccountId,
      userId: userId
    });
    console.log(`Searching by cleaned accountNumber: ${cleanAccountId}, found:`, !!account);
    
    if (!account && mongoose.Types.ObjectId.isValid(accountId)) {
      account = await CreditAccount.findOne({ 
        _id: accountId,
        userId: userId
      });
      console.log(`Searching by ObjectId: ${accountId}, found:`, !!account);
    }
    
    if (!account) {
      account = await CreditAccount.findOne({ 
        accountNumber: { $regex: new RegExp(cleanAccountId, 'i') },
        userId: userId
      });
      console.log(`Searching by accountNumber regex: ${cleanAccountId}, found:`, !!account);
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit account not found'
      });
    }
    
    // Check if this is actually a credit account
    if (!account.type.toLowerCase().includes('credit')) {
      return res.status(400).json({
        success: false,
        error: 'This is not a credit account'
      });
    }
    
    // Format account data for frontend
    const formattedAccount = formatAccountForResponse(account);
    
    return res.status(200).json({
      success: true,
      data: formattedAccount
    });
  } catch (error) {
    console.error('Error fetching credit account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching credit account'
    });
  }
};

// Get transactions for a credit account
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    let accountId = req.params.accountId;
    const { filter, dateRange } = req.query;
    
    console.log(`Original accountId parameter: ${accountId}`);
    
    // Always strip any prefix if present
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    console.log(`Looking for transactions with accountId: ${accountId}, cleanAccountId: ${cleanAccountId}`);
    
    // Find the account in multiple ways
    let account = null;
    
    // Handle the "primary" case first
    if (accountId === 'primary') {
      account = await CreditAccount.findOne({ 
        userId: userId,
        isPrimary: true,
        type: { $regex: /credit/i }
      });
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          userId: userId,
          type: { $regex: /credit/i }
        });
      }
    } else {
      // Try multiple ways to find the account
      
      // 1. Try by account number (exact match with cleaned ID)
      account = await CreditAccount.findOne({ 
        accountNumber: cleanAccountId,
        userId: userId
      });
      console.log(`Lookup by accountNumber=${cleanAccountId}: ${account ? 'Found' : 'Not found'}`);
      
      // 2. Try by MongoDB ObjectId if valid
      if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
        account = await CreditAccount.findOne({ 
          _id: cleanAccountId,
          userId: userId
        });
        console.log(`Lookup by _id=${cleanAccountId}: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 3. Try with original accountId (in case the prefix is part of the actual ID)
      if (!account && mongoose.Types.ObjectId.isValid(accountId)) {
        account = await CreditAccount.findOne({ 
          _id: accountId,
          userId: userId
        });
        console.log(`Lookup by original _id=${accountId}: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 4. Try with regex for partial account number match
      if (!account) {
        account = await CreditAccount.findOne({
          accountNumber: { $regex: new RegExp(cleanAccountId, 'i') },
          userId: userId
        });
        console.log(`Lookup by regex accountNumber match: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 5. Last attempt - get any credit account for this user (fallback)
      if (!account) {
        console.log('No exact matches found, checking all user accounts');
        // Get all accounts for this user and loop through them
        const allAccounts = await CreditAccount.find({ userId });
        
        if (allAccounts.length > 0) {
          // Try to find a credit account
          for (const acc of allAccounts) {
            if (acc.type && acc.type.toLowerCase().includes('credit')) {
              console.log(`Found credit account: ${acc._id}`);
              account = acc;
              break;
            }
          }
          
          // If no credit account found, just use the first account
          if (!account && allAccounts.length > 0) {
            account = allAccounts[0];
            console.log(`Using first available account: ${account._id}`);
          }
        }
      }
    }
    
    if (!account) {
      // Debug: Log all accounts for this user
      const allAccounts = await CreditAccount.find({ userId });
      console.log(`User has ${allAccounts.length} accounts:`);
      allAccounts.forEach(acc => {
        console.log(`ID: ${acc._id}, Number: ${acc.accountNumber}, Type: ${acc.type}`);
      });
      
      return res.status(404).json({
        success: false,
        error: `Account not found with ID: ${accountId}`
      });
    }
    
    // At this point, we have found the account
    console.log(`Found account: ${account._id}, processing transactions...`);
    
    // Filter transactions
    let transactions = [...account.transactions];
    
    // Apply transaction type filter
    if (filter && filter !== 'all') {
      transactions = transactions.filter(tx => tx.type === filter);
    }
    
    // Apply date range filter
    const now = new Date();
    if (dateRange) {
      let startDate;
      
      switch (dateRange) {
        case '30days':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        case '60days':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 60);
          break;
        case '90days':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 90);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1); // First day of current year
          break;
        case 'all':
        default:
          startDate = null;
      }
      
      if (startDate) {
        transactions = transactions.filter(tx => new Date(tx.date) >= startDate);
      }
    }
    
    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error in getTransactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching transactions'
    });
  }
};

// Process a payment on a credit account (functionally similar to a deposit)
const makePayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { amount, description } = req.body;
    
    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid positive amount'
      });
    }
    
    // Find the account (either specific or primary)
    let account;
    
    // Handle the special 'primary' case
    if (accountId === 'primary') {
      account = await CreditAccount.findOne({ 
        userId: userId,
        isPrimary: true,
        type: { $regex: /credit/i }
      });
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          userId: userId,
          type: { $regex: /credit/i }
        });
      }
    } else {
      // Key fix: Extract the actual ID from formats like "acc-1234567890"
      const actualId = accountId.includes('-') ? accountId.split('-')[1] : accountId;
      console.log(`Looking for account with cleaned ID: ${actualId} for user: ${userId}`);
      
      // Find by original MongoDB ID first
      if (mongoose.Types.ObjectId.isValid(accountId)) {
        account = await CreditAccount.findOne({ 
          _id: accountId,
          userId: userId
        });
      }
      
      // Try by the account _id
      if (!account && mongoose.Types.ObjectId.isValid(actualId)) {
        account = await CreditAccount.findOne({ 
          _id: actualId,
          userId: userId
        });
      }
      
      // Try by accountNumber (exact match)
      if (!account) {
        account = await CreditAccount.findOne({ 
          accountNumber: actualId,
          userId: userId
        });
      }
      
      // Try with original accountId as accountNumber
      if (!account) {
        account = await CreditAccount.findOne({ 
          accountNumber: accountId,
          userId: userId
        });
      }
      
      // Last resort - check all accounts for this user and debug
      if (!account) {
        const allAccounts = await CreditAccount.find({ userId });
        console.log(`No account found with ID ${actualId}. User has ${allAccounts.length} accounts:`);
        
        for (const acc of allAccounts) {
          console.log(`Account: ${acc._id}, Number: ${acc.accountNumber}, Type: ${acc.type}`);
          
          // Try to match by the last part of the accountId (if it contains numbers from accountNumber)
          if (actualId.includes(acc.accountNumber) || acc.accountNumber.includes(actualId)) {
            console.log(`Found potential match by partial account number`);
            account = acc;
            break;
          }
        }
      }
    }
    
    // If still no account found, try one last approach - get the user's primary credit account
    if (!account) {
      console.log(`No account found with any matching criteria, falling back to primary account`);
      account = await CreditAccount.findOne({ 
        userId: userId,
        type: { $regex: /credit/i }
      });
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: `Account not found with ID: ${accountId}`
      });
    }
    
    // Create the new transaction - for credit accounts, payments reduce debt (increase balance)
    const newBalance = account.balance + paymentAmount;
    const newTransaction = {
      date: new Date(),
      description: description || 'Payment - Thank You',
      type: 'payment',
      amount: paymentAmount, // Payment is a positive amount for credit accounts
      status: 'Completed',
      balance: newBalance
    };
    
    // Update account with new balance and transaction
    account.balance = newBalance;
    account.availableCredit = account.creditLimit - Math.abs(newBalance);
    account.lastPaymentDate = new Date();
    account.lastPaymentAmount = paymentAmount;
    account.transactions.push(newTransaction);
    
    // Save the updated account
    await account.save();
    
    return res.status(200).json({
      success: true,
      data: {
        transaction: newTransaction,
        newBalance: newBalance
      },
      message: 'Payment processed successfully'
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while processing payment'
    });
  }
};

// Generate statement for credit account
const generateStatement = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    let accountId = req.params.accountId;
    
    console.log(`Attempting to generate statement for account: ${accountId}, user: ${userId}`);
    
    // Always strip any prefix if present
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    console.log(`Cleaned accountId for statement: ${cleanAccountId}`);
    
    // Find the account (using the same robust lookup logic as getTransactions)
    let account = null;
    
    // Handle the "primary" case first
    if (accountId === 'primary') {
      account = await CreditAccount.findOne({ 
        userId: userId,
        isPrimary: true,
        type: { $regex: /credit/i }
      });
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          userId: userId,
          type: { $regex: /credit/i }
        });
      }
    } else {
      // Try multiple ways to find the account
      
      // 1. Try by account number (exact match with cleaned ID)
      account = await CreditAccount.findOne({ 
        accountNumber: cleanAccountId,
        userId: userId
      });
      console.log(`Statement lookup by accountNumber=${cleanAccountId}: ${account ? 'Found' : 'Not found'}`);
      
      // 2. Try by MongoDB ObjectId if valid
      if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
        account = await CreditAccount.findOne({ 
          _id: cleanAccountId,
          userId: userId
        });
        console.log(`Statement lookup by _id=${cleanAccountId}: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 3. Try with original accountId (in case the prefix is part of the actual ID)
      if (!account && mongoose.Types.ObjectId.isValid(accountId)) {
        account = await CreditAccount.findOne({ 
          _id: accountId,
          userId: userId
        });
        console.log(`Statement lookup by original _id=${accountId}: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 4. Try with regex for partial account number match
      if (!account) {
        account = await CreditAccount.findOne({
          accountNumber: { $regex: new RegExp(cleanAccountId, 'i') },
          userId: userId
        });
        console.log(`Statement lookup by regex accountNumber match: ${account ? 'Found' : 'Not found'}`);
      }
      
      // 5. Last attempt - get any credit account for this user (fallback)
      if (!account) {
        console.log('No exact matches found for statement, checking all user accounts');
        // Get all accounts for this user and loop through them
        const allAccounts = await CreditAccount.find({ userId });
        
        if (allAccounts.length > 0) {
          // Try to find a credit account
          for (const acc of allAccounts) {
            if (acc.type && acc.type.toLowerCase().includes('credit')) {
              console.log(`Found credit account for statement: ${acc._id}`);
              account = acc;
              break;
            }
          }
          
          // If no credit account found, just use the first account
          if (!account && allAccounts.length > 0) {
            account = allAccounts[0];
            console.log(`Using first available account for statement: ${account._id}`);
          }
        }
      }
    }
    
    if (!account) {
      // Debug: Log all accounts for this user
      const allAccounts = await CreditAccount.find({ userId });
      console.log(`User has ${allAccounts.length} accounts (statement debug):`);
      allAccounts.forEach(acc => {
        console.log(`ID: ${acc._id}, Number: ${acc.accountNumber}, Type: ${acc.type}`);
      });
      
      return res.status(404).json({
        success: false,
        error: `Account not found with ID: ${accountId}`
      });
    }
    
    console.log(`Statement being generated for account: ${account.accountNumber}`);
    
    // In a real implementation, you would generate a statement file
    // and return a download URL or stream the file
    
    // For now, simulate success
    const statementId = Math.floor(Math.random() * 1000000);
    const downloadUrl = `/api/statement/${statementId}.${req.body.format}`;
    
    return res.status(200).json({
      success: true,
      data: {
        statementId,
        downloadUrl,
        period: req.body.period,
        format: req.body.format
      },
      message: 'Statement generated successfully'
    });
  } catch (error) {
    console.error('Error generating statement:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while generating statement'
    });
  }
};

// Create a new credit account for user
const createCreditAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    const { creditLimit } = req.body;
    
    // Validate credit limit
    const limit = parseFloat(creditLimit) || 5000;
    if (isNaN(limit) || limit <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid positive credit limit'
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Generate account number
    const accountNumber = await CreditAccount.generateAccountNumber();
    
    // Check if user already has a primary credit account
    const existingPrimary = await CreditAccount.findOne({
      userId,
      isPrimary: true,
      type: { $regex: /credit/i }
    });
    
    // Create new account
    const newAccount = new CreditAccount({
      userId,
      accountNumber,
      type: 'Credit Account',
      balance: 0, // Start with zero balance
      creditLimit: limit,
      availableCredit: limit,
      openedDate: new Date(),
      isPrimary: !existingPrimary // Make primary if no primary exists
    });
    
    // Set due date to 30 days from now
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    newAccount.dueDate = dueDate;
    
    // Save the account
    await newAccount.save();
    
    // Format account for response
    const formattedAccount = formatAccountForResponse(newAccount);
    
    return res.status(201).json({
      success: true,
      data: formattedAccount,
      message: 'Credit account created successfully'
    });
  } catch (error) {
    console.error('Error creating credit account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while creating credit account'
    });
  }
};

// Process a purchase on a credit account
const makePurchase = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { amount, description, merchant, category } = req.body;
    
    // Validate amount
    const purchaseAmount = parseFloat(amount);
    if (isNaN(purchaseAmount) || purchaseAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid positive amount'
      });
    }
    
    // Find the account using same logic as other methods
    let account;
    
    if (accountId === 'primary') {
      account = await CreditAccount.findOne({ 
        userId: userId,
        isPrimary: true,
        type: { $regex: /credit/i }
      });
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          userId: userId,
          type: { $regex: /credit/i }
        });
      }
    } else {
      const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
      
      // Try various ways to find the account
      if (mongoose.Types.ObjectId.isValid(accountId)) {
        account = await CreditAccount.findOne({ 
          _id: accountId,
          userId: userId
        });
      }
      
      if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
        account = await CreditAccount.findOne({ 
          _id: cleanAccountId,
          userId: userId
        });
      }
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          accountNumber: cleanAccountId,
          userId: userId
        });
      }
      
      if (!account) {
        account = await CreditAccount.findOne({ 
          accountNumber: { $regex: new RegExp(cleanAccountId, 'i') },
          userId: userId
        });
      }
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: `Credit account not found with ID: ${accountId}`
      });
    }
    
    // Check if purchase would exceed credit limit
    const newBalance = account.balance - purchaseAmount; // Negative for purchases
    if (Math.abs(newBalance) > account.creditLimit) {
      return res.status(400).json({
        success: false,
        error: 'This purchase would exceed your credit limit'
      });
    }
    
    // Create the new transaction
    const newTransaction = {
      date: new Date(),
      description: description || 'Purchase',
      type: 'purchase',
      amount: -purchaseAmount, // Negative for credit card purchases
      status: 'Completed',
      balance: newBalance,
      merchant: merchant || '',
      category: category || ''
    };
    
    // Update account with new balance and transaction
    account.balance = newBalance;
    account.availableCredit = account.creditLimit - Math.abs(newBalance);
    account.transactions.push(newTransaction);
    
    // Update reward points (typically 1 point per dollar spent)
    account.rewardPoints += Math.floor(purchaseAmount);
    
    // Save the updated account
    await account.save();
    
    return res.status(200).json({
      success: true,
      data: {
        transaction: newTransaction,
        newBalance: newBalance,
        availableCredit: account.availableCredit,
        rewardPoints: account.rewardPoints
      },
      message: 'Purchase processed successfully'
    });
  } catch (error) {
    console.error('Error processing purchase:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while processing purchase'
    });
  }
};

// Update credit account details
const updateCreditAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { isPrimary } = req.body;
    
    // Find the account with consistent lookup strategy
    let account;
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      account = await CreditAccount.findOne({ 
        _id: accountId,
        userId: userId
      });
    }
    
    if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
      account = await CreditAccount.findOne({ 
        _id: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      account = await CreditAccount.findOne({ 
        accountNumber: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit account not found'
      });
    }
    
    // If making this account primary, first remove primary status from other accounts
    if (isPrimary) {
      await CreditAccount.updateMany(
        { userId: userId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
      account.isPrimary = true;
    }
    
    // Save the updated account
    await account.save();
    
    // Format account for response
    const formattedAccount = formatAccountForResponse(account);
    
    return res.status(200).json({
      success: true,
      data: formattedAccount,
      message: 'Credit account updated successfully'
    });
  } catch (error) {
    console.error('Error updating credit account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while updating credit account'
    });
  }
};

// Delete credit account (soft delete by setting status to Closed)
const closeCreditAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;
    
    // Find the account
    let account;
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      account = await CreditAccount.findOne({ 
        _id: accountId,
        userId: userId
      });
    }
    
    if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
      account = await CreditAccount.findOne({ 
        _id: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      account = await CreditAccount.findOne({ 
        accountNumber: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit account not found'
      });
    }
    
    // Ensure account has zero balance before closing
    if (account.balance !== 0) {
      return res.status(400).json({
        success: false,
        error: 'Account must have zero balance before closing'
      });
    }
    
    // Set status to Closed
    account.status = 'Closed';
    await account.save();
    
    return res.status(200).json({
      success: true,
      message: 'Credit account closed successfully'
    });
  } catch (error) {
    console.error('Error closing credit account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while closing credit account'
    });
  }
};

// Get all credit accounts for a user
const getAllCreditAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all credit accounts for this user
    const accounts = await CreditAccount.find({ 
      userId: userId,
      type: { $regex: /credit/i } 
    });
    
    if (!accounts || accounts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No credit accounts found for this user'
      });
    }
    
    // Format accounts for response
    const formattedAccounts = accounts.map(account => formatAccountForResponse(account));
    
    return res.status(200).json({
      success: true,
      data: formattedAccounts
    });
  } catch (error) {
    console.error('Error fetching credit accounts:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching credit accounts'
    });
  }
};

// Apply for credit limit increase
const requestCreditLimitIncrease = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0].msg
      });
    }
    
    const userId = req.user.id;
    const accountId = req.params.accountId;
    const { requestedLimit, reason } = req.body;
    
    // Validate requested limit
    const newLimit = parseFloat(requestedLimit);
    if (isNaN(newLimit) || newLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid positive credit limit'
      });
    }
    
    // Find the account
    let account;
    const cleanAccountId = accountId.replace(/^[a-z]+-/, '');
    
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      account = await CreditAccount.findOne({ 
        _id: accountId,
        userId: userId
      });
    }
    
    if (!account && mongoose.Types.ObjectId.isValid(cleanAccountId)) {
      account = await CreditAccount.findOne({ 
        _id: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      account = await CreditAccount.findOne({ 
        accountNumber: cleanAccountId,
        userId: userId
      });
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Credit account not found'
      });
    }
    
    // In a real app, you would submit this request for review
    // For demo purposes, we'll automatically approve if account is in good standing
    
    // Check if requested limit is more than double current limit
    if (newLimit > account.creditLimit * 2) {
      return res.status(400).json({
        success: false,
        error: 'Requested limit exceeds maximum allowable increase'
      });
    }
    
    // Check account age (must be at least 6 months old)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (account.openedDate > sixMonthsAgo) {
      return res.status(400).json({
        success: false,
        error: 'Account must be at least 6 months old for a credit limit increase'
      });
    }
    
    // Update credit limit and available credit
    const oldLimit = account.creditLimit;
    account.creditLimit = newLimit;
    account.availableCredit = account.creditLimit - Math.abs(account.balance);
    
    // Add a note in transactions
    account.transactions.push({
      date: new Date(),
      description: `Credit limit increased from $${oldLimit} to $${newLimit}`,
      type: 'other',
      amount: 0,
      status: 'Completed',
      balance: account.balance
    });
    
    // Save the updated account
    await account.save();
    
    return res.status(200).json({
      success: true,
      data: {
        oldLimit,
        newLimit: account.creditLimit,
        availableCredit: account.availableCredit
      },
      message: 'Credit limit increase approved'
    });
  } catch (error) {
    console.error('Error processing credit limit increase:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while processing credit limit increase'
    });
  }
};

module.exports = {
  getPrimaryCreditAccount,
  getCreditAccountById,
  getTransactions,
  makePayment,
  generateStatement,
  createCreditAccount,
  makePurchase,
  updateCreditAccount,
  closeCreditAccount,
  getAllCreditAccounts,
  requestCreditLimitIncrease
};