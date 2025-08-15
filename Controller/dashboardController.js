// controllers/dashboardController.js
const mongoose = require('mongoose');
const User = require('../Model/UserModel');
const CheckingAccount = require('../Model/CheckingAccountModel');
const { generateTransactionReference } = require('../Utils/transactionUtils');

// Get user dashboard data including accounts and recent transactions
exports.getDashboardData = async (req, res) => {
  try {
    // User ID comes from the auth middleware
    const userId = req.user.id;
    
    // Find user with populated accounts but limit transactions
    const user = await User.findById(userId).select('-password -securityAnswer -ssn');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get all checking accounts from CheckingAccount model instead of user.accounts
    const checkingAccounts = await CheckingAccount.find({ userId: userId });
    
    // If no checking accounts found but user has accounts in user.accounts, migrate them
    if (checkingAccounts.length === 0 && user.accounts && user.accounts.length > 0) {
      console.log('Migrating accounts from user.accounts to CheckingAccount collection');
      
      for (let i = 0; i < user.accounts.length; i++) {
        const acc = user.accounts[i];
        
        // Check if account is checking type or no type specified (default to checking)
        if (!acc.accountType || acc.accountType.toLowerCase() === 'checking') {
          const newCheckingAccount = new CheckingAccount({
            userId: userId,
            type: acc.accountName || acc.accountType || 'Everyday Checking',
            accountNumber: acc.accountNumber,
            routingNumber: acc.routingNumber || '121000248',
            balance: acc.balance || 0,
            availableBalance: acc.balance || 0,
            isPrimary: i === 0, // First account is primary
            openedDate: user.createdAt || new Date(),
            transactions: acc.transactions || []
          });
          
          await newCheckingAccount.save();
          console.log(`Migrated checking account ${newCheckingAccount.accountNumber}`);
        }
      }
      
      // Re-fetch checking accounts after migration
      const migratedAccounts = await CheckingAccount.find({ userId: userId });
      return formatDashboardResponse(user, migratedAccounts, res);
    }

    return formatDashboardResponse(user, checkingAccounts, res);
    
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching dashboard data'
    });
  }
};

// Helper function to format dashboard response
function formatDashboardResponse(user, checkingAccounts, res) {
  // Format account data for frontend using CheckingAccount data
  const formattedAccounts = checkingAccounts.map(account => ({
    id: account._id,
    accountNumber: account.accountNumber,
    routingNumber: account.routingNumber,
    type: account.type || 'Checking',
    accountName: account.type || 'Everyday Checking',
    balance: account.balance,
    // Get only the 5 most recent transactions
    recentTransactions: account.transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(transaction => ({
        id: transaction._id,
        date: transaction.date,
        description: transaction.description,
        type: mapTransactionType(transaction.type, transaction.category),
        amount: transaction.amount,
        balance: transaction.balance,
        status: transaction.status || 'Completed'
      }))
  }));

  return res.status(200).json({
    success: true,
    data: {
      accounts: formattedAccounts,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        address: user.address,
        phoneNumber: user.phoneNumber,
        preferences: user.preferences
      }
    }
  });
}

// Get account details including all transactions
exports.getAccountDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;

    console.log(`Getting account details for accountId: ${accountId}, userId: ${userId}`);

    // Find the checking account from CheckingAccount model
    let checkingAccount;
    
    // Try to find by MongoDB ObjectId first
    if (mongoose.Types.ObjectId.isValid(accountId)) {
      checkingAccount = await CheckingAccount.findOne({
        _id: accountId,
        userId: userId
      });
    }
    
    // If not found by ObjectId, try finding by account number
    if (!checkingAccount) {
      checkingAccount = await CheckingAccount.findOne({
        accountNumber: accountId,
        userId: userId
      });
    }
    
    // If still not found, try to get primary account
    if (!checkingAccount && accountId === 'primary') {
      checkingAccount = await CheckingAccount.findOne({
        userId: userId,
        isPrimary: true
      });
      
      // If no primary found, get the first account
      if (!checkingAccount) {
        checkingAccount = await CheckingAccount.findOne({ userId: userId });
      }
    }

    if (!checkingAccount) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Format transactions by date (newest first)
    const sortedTransactions = checkingAccount.transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(transaction => ({
        id: transaction._id,
        date: transaction.date,
        description: transaction.description,
        type: mapTransactionType(transaction.type, transaction.category),
        amount: transaction.amount,
        balance: transaction.balance,
        status: transaction.status || 'Completed'
      }));

    return res.status(200).json({
      success: true,
      data: {
        id: checkingAccount._id,
        accountNumber: checkingAccount.accountNumber,
        routingNumber: checkingAccount.routingNumber,
        type: checkingAccount.type,
        accountName: checkingAccount.type || 'Checking Account',
        balance: checkingAccount.balance,
        availableBalance: checkingAccount.availableBalance || checkingAccount.balance,
        transactions: sortedTransactions
      }
    });
  } catch (error) {
    console.error('Error fetching account details:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching account details'
    });
  }
};

// Transfer money between accounts
exports.transferMoney = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { fromAccountId, toAccountId, amount, description } = req.body;
    
    // Validate request body
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Please provide fromAccountId, toAccountId, and amount'
      });
    }

    // Validate amount is positive
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Find both accounts from CheckingAccount model
    const fromAccount = await CheckingAccount.findOne({
      _id: fromAccountId,
      userId: userId
    }).session(session);
    
    const toAccount = await CheckingAccount.findOne({
      _id: toAccountId,
      userId: userId
    }).session(session);
    
    if (!fromAccount || !toAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'One or both accounts not found'
      });
    }

    // Ensure sufficient funds
    if (fromAccount.balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Insufficient funds for transfer'
      });
    }

    // Generate a reference number for this transaction
    const transactionRef = generateTransactionReference();
    const transferDescription = description || `Transfer to account ending in ${toAccount.accountNumber.slice(-4)}`;

    // Update balances
    fromAccount.balance -= amount;
    fromAccount.availableBalance = fromAccount.balance;
    toAccount.balance += amount;
    toAccount.availableBalance = toAccount.balance;
    
    // Add transactions to both accounts
    const transactionDate = new Date();
    
    // Debit transaction for source account
    fromAccount.transactions.push({
      date: transactionDate,
      description: transferDescription,
      amount: amount,
      type: 'debit',
      category: 'transfer',
      balance: fromAccount.balance,
      status: 'Completed'
    });
    
    // Credit transaction for destination account
    toAccount.transactions.push({
      date: transactionDate,
      description: `Transfer from account ending in ${fromAccount.accountNumber.slice(-4)}`,
      amount: amount,
      type: 'credit',
      category: 'transfer',
      balance: toAccount.balance,
      status: 'Completed'
    });

    // Save both accounts
    await fromAccount.save({ session });
    await toAccount.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        transactionRef,
        fromAccount: {
          id: fromAccount._id,
          type: fromAccount.type,
          newBalance: fromAccount.balance
        },
        toAccount: {
          id: toAccount._id,
          type: toAccount.type,
          newBalance: toAccount.balance
        },
        amount,
        date: transactionDate
      }
    });
  } catch (error) {
    console.error('Error during transfer:', error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      error: 'Server error during transfer'
    });
  }
};

// Create a new account for existing user
exports.createAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountType, initialDeposit = 0 } = req.body;
    
    // Validate request body
    if (!accountType) {
      return res.status(400).json({
        success: false,
        error: 'Please provide account type'
      });
    }

    // Validate initial deposit is non-negative
    if (isNaN(initialDeposit) || initialDeposit < 0) {
      return res.status(400).json({
        success: false,
        error: 'Initial deposit must be a non-negative number'
      });
    }

    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate account number and routing number
    const accountNumber = generateAccountNumber();
    const routingNumber = '121000248';
    
    // Check if this is the first checking account
    const existingAccounts = await CheckingAccount.find({ userId: userId });
    const isPrimary = existingAccounts.length === 0;
    
    // Create initial transaction if there's a deposit
    const transactions = [];
    if (initialDeposit > 0) {
      transactions.push({
        date: new Date(),
        description: 'Initial deposit',
        amount: initialDeposit,
        type: 'credit',
        category: 'deposit',
        balance: initialDeposit,
        status: 'Completed'
      });
    }
    
    // Create new checking account
    const newCheckingAccount = new CheckingAccount({
      userId: userId,
      type: accountType === 'Checking' ? 'Everyday Checking' : accountType,
      accountNumber: accountNumber,
      routingNumber: routingNumber,
      balance: initialDeposit,
      availableBalance: initialDeposit,
      isPrimary: isPrimary,
      openedDate: new Date(),
      transactions: transactions
    });

    await newCheckingAccount.save();

    // Return the new account details
    return res.status(201).json({
      success: true,
      data: {
        account: {
          id: newCheckingAccount._id,
          accountNumber: newCheckingAccount.accountNumber,
          routingNumber: newCheckingAccount.routingNumber,
          type: newCheckingAccount.type,
          accountName: newCheckingAccount.type,
          balance: newCheckingAccount.balance,
          transactions: newCheckingAccount.transactions
        }
      }
    });
  } catch (error) {
    console.error('Error creating account:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while creating account'
    });
  }
};

// Process withdrawal request (requires verification code in real-world)
exports.withdrawFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId, amount, withdrawalCode } = req.body;
    
    // Validate request body
    if (!accountId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Please provide accountId and amount'
      });
    }

    // In a real app, we would validate withdrawalCode here
    if (!withdrawalCode || withdrawalCode.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid withdrawal authorization code'
      });
    }

    // Validate amount is positive
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Find the checking account
    const account = await CheckingAccount.findOne({
      _id: accountId,
      userId: userId
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Ensure sufficient funds
    if (account.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient funds for withdrawal'
      });
    }

    // Update balance
    account.balance -= amount;
    account.availableBalance = account.balance;
    
    // Add withdrawal transaction
    account.transactions.push({
      date: new Date(),
      description: 'ATM Withdrawal',
      amount: amount,
      type: 'debit',
      category: 'withdrawal',
      balance: account.balance,
      status: 'Completed'
    });

    // Save changes
    await account.save();

    return res.status(200).json({
      success: true,
      data: {
        accountId: account._id,
        newBalance: account.balance,
        withdrawalAmount: amount,
        transactionId: account.transactions[account.transactions.length - 1]._id
      }
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during withdrawal'
    });
  }
};

// Process deposit
exports.depositFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId, amount, depositMethod } = req.body;
    
    // Validate request body
    if (!accountId || !amount || !depositMethod) {
      return res.status(400).json({
        success: false,
        error: 'Please provide accountId, amount, and depositMethod'
      });
    }

    // Validate amount is positive
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Find the checking account
    const account = await CheckingAccount.findOne({
      _id: accountId,
      userId: userId
    });
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Update balance
    account.balance += amount;
    account.availableBalance = account.balance;
    
    // Add deposit transaction
    account.transactions.push({
      date: new Date(),
      description: `${depositMethod} Deposit`,
      amount: amount,
      type: 'credit',
      category: 'deposit',
      balance: account.balance,
      status: 'Completed'
    });

    // Save changes
    await account.save();

    return res.status(200).json({
      success: true,
      data: {
        accountId: account._id,
        newBalance: account.balance,
        depositAmount: amount,
        transactionId: account.transactions[account.transactions.length - 1]._id
      }
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error during deposit'
    });
  }
};

// Helper function to map transaction types
function mapTransactionType(type, category) {
  if (type === 'credit') {
    return 'deposit';
  }
  if (type === 'debit') {
    return category || 'withdrawal';
  }
  return type;
}

// Utility function to generate a random account number
function generateAccountNumber() {
  const prefix = '12345'; // A fixed prefix for Wells Fargo-like accounts
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return prefix + randomDigits;
}