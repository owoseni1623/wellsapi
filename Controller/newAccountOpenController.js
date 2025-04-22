const User = require('../Model/UserModel');
const NewAccount = require('../Model/newAccountOpenModel');
const Transaction = require('../Model/transactionModel');
const mongoose = require('mongoose');
// Import account type-specific models
const CheckingAccount = require('../Model/CheckingAccountModel');
const SavingsAccount = require('../Model/SavingsAccountModel');
const CreditAccount = require('../Model/CreditAccountModel');
const CreditAccountModel = require('../Model/CreditAccountModel');

/**
 * Helper function to get the correct account model based on account type
 */
const getAccountModelByType = (accountType) => {
  switch(accountType) {
    case 'Checking Account':
      return CheckingAccount;
    case 'Savings Account':
      return SavingsAccount;
    case 'Credit Account':
      return CreditAccount;
    default:
      return null; // Will fallback to NewAccount model
  }
};

/**
 * Controller to handle creation of new bank accounts
 * Now routes to specific account type collection
 */
exports.createNewAccount = async (req, res) => {
  try {
    // Extract user ID from the token verification
    const userId = req.user.id;
    
    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Extract account details from request body
    const {
      accountType,
      initialDeposit,
      accountNumber,
      routingNumber,
      personalInfo
    } = req.body;
    
    // Validation
    if (!accountType || !initialDeposit) {
      return res.status(400).json({
        success: false,
        message: 'Account type and initial deposit are required'
      });
    }
    
    // Generate account number if not provided
    const generatedAccountNumber = accountNumber || 
      Math.floor(1000000000 + Math.random() * 9000000000).toString();
    
    // Fixed routing number
    const fixedRoutingNumber = routingNumber || '121000248';
    
    // Common account data for all account types
    const accountData = {
      userId: userId,
      accountType: accountType,
      balance: initialDeposit, // Add balance field for consistency across models
      initialDeposit: initialDeposit,
      accountNumber: generatedAccountNumber,
      routingNumber: fixedRoutingNumber,
      openedDate: new Date(),
      status: 'Active', // Change status to Active for immediate visibility
      ownerName: `${personalInfo?.firstName || user.firstName} ${personalInfo?.lastName || user.lastName}`,
      transactions: [] // Empty array initially, will add transaction after creating account
    };
    
    // Get the appropriate model based on account type
    const AccountModel = getAccountModelByType(accountType);
    
    let savedAccount;
    
    if (AccountModel) {
      // Use the specific account model
      const typedAccount = new AccountModel(accountData);
      savedAccount = await typedAccount.save();
      
      // For compatibility, also save to NewAccount for any legacy code
      const newAccount = new NewAccount(accountData);
      await newAccount.save();
    } else {
      // Fallback to generic NewAccount model if type is not recognized
      const newAccount = new NewAccount(accountData);
      savedAccount = await newAccount.save();
    }
    
    // Create initial transaction with the saved account ID
    const initialTransaction = new Transaction({
      accountId: savedAccount._id, // Set the account ID from the saved account
      date: new Date(),
      description: 'Initial deposit',
      amount: initialDeposit,
      type: 'deposit',
      category: 'Deposit',
      balance: initialDeposit
    });
    
    // Save the transaction
    const savedTransaction = await initialTransaction.save();
    
    // Update the account with the transaction ID
    savedAccount.transactions = [savedTransaction._id];
    await savedAccount.save();
    
    // Return success response with account data
    return res.status(201).json({
      success: true,
      message: 'New account created successfully',
      data: {
        account: savedAccount
      }
    });
    
  } catch (error) {
    console.error('Error creating new account:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating new account',
      error: error.message
    });
  }
};

/**
 * Get details for a specific new account - modified to check only implemented account models
 */
exports.getNewAccountDetails = async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.id;
    
    // Try to find the account in any of the available account collections
    let account = null;
    const accountModels = [
      CheckingAccount, SavingsAccount, NewAccount
    ];
    
    for (const model of accountModels) {
      try {
        const foundAccount = await model.findById(accountId).populate('transactions');
        if (foundAccount) {
          account = foundAccount;
          break;
        }
      } catch (err) {
        // Continue to next model if not found
      }
    }
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }
    
    // Security check - make sure the account belongs to the user
    if (account.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to account'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        account
      }
    });
    
  } catch (error) {
    console.error('Error fetching account details:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching account details',
      error: error.message
    });
  }
};

/**
 * Get all accounts for a user - modified to retrieve from available account collections
 */
exports.getAllNewAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get accounts from available account collections
    const accountModels = [
      CheckingAccount, SavingsAccount, NewAccount
    ];
    
    let allAccounts = [];
    
    for (const model of accountModels) {
      try {
        const accounts = await model.find({ userId }).populate('transactions');
        allAccounts = [...allAccounts, ...accounts];
      } catch (err) {
        console.error(`Error fetching from model:`, err);
        // Continue to next model
      }
    }
    
    // Remove duplicate accounts (that might exist in both specific and NewAccount collections)
    const uniqueAccounts = allAccounts.filter((account, index, self) => 
      index === self.findIndex(a => a.accountNumber === account.accountNumber)
    );
    
    return res.status(200).json({
      success: true,
      data: {
        accounts: uniqueAccounts
      }
    });
    
  } catch (error) {
    console.error('Error fetching user accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user accounts',
      error: error.message
    });
  }
};