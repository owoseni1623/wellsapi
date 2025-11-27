// controllers/transferController.js
const User = require('../Model/UserModel');
const crypto = require('crypto');

// Generate a random confirmation number
const generateConfirmationNumber = () => {
  const timestamp = new Date().getTime().toString().slice(-8);
  const random = crypto.randomBytes(2).toString('hex');
  return `TRN-${timestamp}-${random}`;
};

// Mock bank data (since you don't have a Bank model)
const mockBanks = [
  { _id: '1', name: 'Wells Fargo', routingNumber: '121000248' },
  { _id: '2', name: 'Bank of America', routingNumber: '026009593' },
  { _id: '3', name: 'Chase Bank', routingNumber: '021000021' },
  { _id: '4', name: 'Citibank', routingNumber: '021000089' },
  { _id: '5', name: 'US Bank', routingNumber: '091000022' },
  { _id: '6', name: 'PNC Bank', routingNumber: '043000096' },
  { _id: '7', name: 'Capital One', routingNumber: '065000090' },
  { _id: '8', name: 'TD Bank', routingNumber: '031201360' },
  { _id: '9', name: 'BB&T', routingNumber: '053000196' },
  { _id: '10', name: 'SunTrust Bank', routingNumber: '061000104' }
];

exports.getAllBanks = async (req, res) => {
  try {
    // Return mock bank data
    res.status(200).json({
      success: true,
      count: mockBanks.length,
      data: mockBanks
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching banks'
    });
  }
};

exports.getUserAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('accounts');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        accounts: user.accounts
      }
    });
  } catch (error) {
    console.error('Error fetching user accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching accounts'
    });
  }
};

exports.getSavedRecipients = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // For now, return empty array since you don't have SavedRecipient model
    // You can implement this later
    res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  } catch (error) {
    console.error('Error fetching saved recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching recipients'
    });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const {
      transferType,
      fromAccount,
      toAccount,
      amount,
      memo,
      emailReceipt,
      emailAddress,
      transferDate,
      transferFrequency,
      recurringEndDate,
      externalAccount,
      wireTransfer
    } = req.body;

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transfer amount'
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

    // Find source account
    const sourceAccount = user.accounts.find(acc => acc.accountNumber === fromAccount);
    if (!sourceAccount) {
      return res.status(404).json({
        success: false,
        error: 'Source account not found'
      });
    }

    // Calculate fee
    const fee = transferType === 'wire' ? 30.00 : 0;
    const totalAmount = transferAmount + fee;

    // Check sufficient balance
    if (sourceAccount.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient funds in source account'
      });
    }

    // Generate confirmation number
    const confirmationNumber = generateConfirmationNumber();
    const transferDateObj = new Date(transferDate || Date.now());

    // Handle different transfer types
    if (transferType === 'internal') {
      // Internal transfer between user's own accounts
      const destinationAccount = user.accounts.find(acc => acc.accountNumber === toAccount);
      
      if (!destinationAccount) {
        return res.status(404).json({
          success: false,
          error: 'Destination account not found'
        });
      }

      // Execute transfer
      sourceAccount.balance -= totalAmount;
      destinationAccount.balance += transferAmount;

      // Add transactions
      sourceAccount.transactions.push({
        date: transferDateObj,
        description: memo || `Transfer to ${destinationAccount.accountName}`,
        amount: totalAmount,
        type: 'debit',
        category: 'Transfer',
        balance: sourceAccount.balance
      });

      destinationAccount.transactions.push({
        date: transferDateObj,
        description: memo || `Transfer from ${sourceAccount.accountName}`,
        amount: transferAmount,
        type: 'credit',
        category: 'Transfer',
        balance: destinationAccount.balance
      });

      await user.save();

      return res.status(201).json({
        success: true,
        message: 'Internal transfer completed successfully',
        data: {
          confirmationNumber,
          status: 'completed',
          amount: transferAmount,
          fee: fee,
          total: totalAmount,
          transferType: 'internal',
          fromAccount: {
            accountNumber: sourceAccount.accountNumber,
            newBalance: sourceAccount.balance
          },
          toAccount: {
            accountNumber: destinationAccount.accountNumber,
            newBalance: destinationAccount.balance
          }
        }
      });

    } else {
      // External or wire transfer
      // For now, deduct from source account and mark as pending
      sourceAccount.balance -= totalAmount;

      sourceAccount.transactions.push({
        date: transferDateObj,
        description: memo || `${transferType === 'wire' ? 'Wire' : 'External'} transfer`,
        amount: totalAmount,
        type: 'debit',
        category: 'Transfer',
        balance: sourceAccount.balance
      });

      if (fee > 0) {
        sourceAccount.transactions.push({
          date: transferDateObj,
          description: 'Wire transfer fee',
          amount: fee,
          type: 'debit',
          category: 'Fee',
          balance: sourceAccount.balance
        });
      }

      await user.save();

      return res.status(201).json({
        success: true,
        message: 'Transfer initiated successfully. Processing may take 1-3 business days.',
        data: {
          confirmationNumber,
          status: 'pending',
          amount: transferAmount,
          fee: fee,
          total: totalAmount,
          transferType: transferType,
          transactionRef: confirmationNumber
        }
      });
    }
    
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while processing transfer'
    });
  }
};

exports.verifyTransfer = async (req, res) => {
  try {
    const { transferId, verificationCode } = req.body;
    
    // For now, return success
    // You can implement proper verification logic later
    res.status(200).json({
      success: true,
      message: 'Transfer verified successfully',
      data: {
        transferId,
        status: 'completed'
      }
    });
    
  } catch (error) {
    console.error('Error verifying transfer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while verifying transfer'
    });
  }
};

exports.getTransferStatus = async (req, res) => {
  try {
    const { transferId } = req.params;
    
    // Mock response for now
    res.status(200).json({
      success: true,
      data: {
        transferId,
        status: 'completed',
        confirmationNumber: transferId
      }
    });
    
  } catch (error) {
    console.error('Error getting transfer status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching transfer status'
    });
  }
};

exports.getAllTransfers = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }
    
    // Return empty array for now
    res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
    
  } catch (error) {
    console.error('Error getting all transfers:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

exports.approveTransfer = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }
    
    const { transferId } = req.params;
    
    res.status(200).json({
      success: true,
      message: 'Transfer approved successfully',
      data: {
        transferId,
        status: 'completed'
      }
    });
    
  } catch (error) {
    console.error('Error approving transfer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};