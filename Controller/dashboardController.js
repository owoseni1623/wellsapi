// controllers/dashboardController.js
const mongoose = require('mongoose');
const User = require('../Model/UserModel');
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

    // Format account data for frontend
    const formattedAccounts = user.accounts.map(account => ({
      id: account._id,
      accountNumber: account.accountNumber,
      routingNumber: account.routingNumber,
      type: account.accountType,
      accountName: account.accountName,
      balance: account.balance,
      // Get only the 5 most recent transactions
      recentTransactions: account.transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5)
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
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching dashboard data'
    });
  }
};

// Get account details including all transactions
exports.getAccountDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.params.accountId;

    // Validate account ID
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account ID'
      });
    }

    // Find user and specific account
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find the specific account
    const account = user.accounts.id(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Format transactions by date (newest first)
    const sortedTransactions = account.transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({
      success: true,
      data: {
        id: account._id,
        accountNumber: account.accountNumber,
        routingNumber: account.routingNumber,
        type: account.accountType,
        accountName: account.accountName,
        balance: account.balance,
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

    // Get user with accounts
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find the source and destination accounts
    const fromAccount = user.accounts.id(fromAccountId);
    const toAccount = user.accounts.id(toAccountId);
    
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
    toAccount.balance += amount;
    
    // Add transactions to both accounts
    const transactionDate = new Date();
    
    // Debit transaction for source account
    fromAccount.transactions.push({
      date: transactionDate,
      description: transferDescription,
      amount: amount,
      type: 'debit',
      category: 'transfer',
      balance: fromAccount.balance
    });
    
    // Credit transaction for destination account
    toAccount.transactions.push({
      date: transactionDate,
      description: `Transfer from account ending in ${fromAccount.accountNumber.slice(-4)}`,
      amount: amount,
      type: 'credit',
      category: 'transfer',
      balance: toAccount.balance
    });

    // Save changes
    await user.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        transactionRef,
        fromAccount: {
          id: fromAccount._id,
          type: fromAccount.accountType,
          newBalance: fromAccount.balance
        },
        toAccount: {
          id: toAccount._id,
          type: toAccount.accountType,
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
    const routingNumber = '051000017'; // Example Wells Fargo routing number
    
    // Create new account
    const newAccount = {
      accountNumber,
      routingNumber,
      accountType,
      accountName: `${accountType} - ${accountNumber.slice(-4)}`,
      balance: initialDeposit,
      transactions: []
    };

    // If there's an initial deposit, add a transaction
    if (initialDeposit > 0) {
      newAccount.transactions.push({
        date: new Date(),
        description: 'Initial deposit',
        amount: initialDeposit,
        type: 'credit',
        category: 'deposit',
        balance: initialDeposit
      });
    }

    // Add account to user
    user.accounts.push(newAccount);
    await user.save();

    // Return the new account details
    return res.status(201).json({
      success: true,
      data: {
        account: user.accounts[user.accounts.length - 1]
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
    // For demo purposes, we'll accept any code or create a dummy validation
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

    // Get user with accounts
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find the account
    const account = user.accounts.id(accountId);
    
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
    
    // Add withdrawal transaction
    account.transactions.push({
      date: new Date(),
      description: 'ATM Withdrawal',
      amount: amount,
      type: 'debit',
      category: 'withdrawal',
      balance: account.balance
    });

    // Save changes
    await user.save();

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

    // Get user with accounts
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Find the account
    const account = user.accounts.id(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    // Update balance
    account.balance += amount;
    
    // Add deposit transaction
    account.transactions.push({
      date: new Date(),
      description: `${depositMethod} Deposit`,
      amount: amount,
      type: 'credit',
      category: 'deposit',
      balance: account.balance
    });

    // Save changes
    await user.save();

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

// Utility function to generate a random account number
function generateAccountNumber() {
  const prefix = '12345'; // A fixed prefix for Wells Fargo-like accounts
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return prefix + randomDigits;
}