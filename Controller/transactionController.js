const Transaction = require('../Model/transactionModel');
const SavingsAccount = require('../Model/CheckingAccountModel');



exports.getAccountTransactions = async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Find transactions for this account
    // This approach depends on how your data is structured
    // Option 1: If transactions are directly linked to accounts
    const transactions = await Transaction.find({ accountId: accountId })
      .sort({ date: -1 })
      .limit(100); // Limit to recent transactions
    
    // Format transactions for frontend
    const formattedTransactions = transactions.map(transaction => ({
      id: transaction._id,
      date: transaction.date,
      formattedDate: new Date(transaction.date).toLocaleDateString('en-US'),
      description: transaction.description,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      // Add these fields with defaults if they don't exist in your model
      merchantType: transaction.category || 'MERCHANT_RETAIL',
      cardLast4: transaction.cardLast4 || '0000',
      postedDate: transaction.createdAt,
      canBeDisputed: (new Date() - new Date(transaction.date)) / (1000 * 60 * 60 * 24) <= 60,
      hasBeenDisputed: transaction.hasBeenDisputed || false
    }));
    
    return res.status(200).json({
      success: true,
      count: formattedTransactions.length,
      data: formattedTransactions
    });
    
  } catch (error) {
    console.error('Error getting account transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { filter, dateRange } = req.query;
    
    const account = await SavingsAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Savings account not found'
      });
    }
    
    // Check if user is authorized to access this account
    if (account.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this account'
      });
    }
    
    // Filter transactions
    let transactions = account.transactions;
    
    // Filter by transaction type
    if (filter && filter !== 'all') {
      transactions = transactions.filter(txn => txn.type === filter);
    }
    
    // Filter by date range
    if (dateRange) {
      const today = new Date();
      let startDate;
      
      switch (dateRange) {
        case '30days':
          startDate = new Date();
          startDate.setDate(today.getDate() - 30);
          break;
        case '60days':
          startDate = new Date();
          startDate.setDate(today.getDate() - 60);
          break;
        case '90days':
          startDate = new Date();
          startDate.setDate(today.getDate() - 90);
          break;
        default:
          startDate = new Date(0); // Beginning of time
      }
      
      transactions = transactions.filter(txn => new Date(txn.date) >= startDate);
    }
    
    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
    
  } catch (error) {
    console.error('Error getting transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { type, amount, description } = req.body;
    
    if (!type || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide type, amount, and description'
      });
    }
    
    const account = await SavingsAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Savings account not found'
      });
    }
    
    // Check if user is authorized to modify this account
    if (account.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this account'
      });
    }
    
    // Check withdrawal limits
    if (type === 'withdrawal' && account.currentMonthWithdrawals >= account.withdrawalLimit) {
      return res.status(400).json({
        success: false,
        message: `You have reached the monthly withdrawal limit of ${account.withdrawalLimit}`
      });
    }
    
    // Add transaction
    try {
      await account.addTransaction({
        type,
        amount: parseFloat(amount),
        description,
        status: 'Completed'
      });
      
      return res.status(201).json({
        success: true,
        message: 'Transaction added successfully',
        data: {
          account: {
            id: account._id,
            balance: account.balance,
            availableBalance: account.availableBalance
          },
          transaction: account.transactions[0]
        }
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
  } catch (error) {
    console.error('Error adding transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.downloadStatement = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { month, year, format } = req.query;
    
    if (!month || !year || !format) {
      return res.status(400).json({
        success: false,
        message: 'Please provide month, year, and format'
      });
    }
    
    const account = await SavingsAccount.findById(accountId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Savings account not found'
      });
    }
    
    // Check if user is authorized to access this account
    if (account.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this account'
      });
    }
    
    // Filter transactions for the specified month and year
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    
    const transactions = account.transactions.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate >= startDate && txnDate <= endDate;
    });
    
    // In a real app, you would generate a PDF or CSV here
    // For now, we'll just return the filtered transactions
    if (format === 'json') {
      return res.status(200).json({
        success: true,
        data: {
          account: {
            accountNumber: account.accountNumber,
            ownerName: account.ownerName,
            balance: account.balance,
            month: startDate.toLocaleString('default', { month: 'long' }),
            year
          },
          transactions
        }
      });
    } else if (format === 'csv') {
      // Placeholder for CSV generation logic
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="statement-${accountId}-${month}-${year}.csv"`);
      
      // Send CSV data
      return res.status(200).send('Date,Description,Type,Amount,Balance\n');
    } else if (format === 'pdf') {
      // Placeholder for PDF generation logic
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="statement-${accountId}-${month}-${year}.pdf"`);
      
      // In a real app, you would generate and send a PDF here
      return res.status(200).send('PDF data would be here');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats: json, csv, pdf'
      });
    }
    
  } catch (error) {
    console.error('Error downloading statement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};