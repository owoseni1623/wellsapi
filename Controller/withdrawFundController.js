const WithdrawFund = require('../Model/WithdawFundModel');
const User = require('../Model/UserModel');
const Account = require('../Model/Account');
const { sendEmail } = require('../Utils/emailService');

// Helper function to generate ATM code
const generateAtmCode = () => {
  const code1 = Math.floor(1000 + Math.random() * 9000);
  const code2 = Math.floor(1000 + Math.random() * 9000);
  return `${code1} ${code2}`;
};

// Process a withdrawal request
exports.processWithdrawal = async (req, res) => {
  try {
    const { 
      accountId, 
      accountType,
      withdrawalType, 
      amount, 
      transactionFee,
      note, 
      receiptEmail, 
      scheduledDate, 
      scheduledTime, 
      allowFingerprint 
    } = req.body;

    // Get the user ID from the authenticated user
    const userId = req.user.id;

    // Validate the account exists and belongs to the user
    const account = await Account.findOne({
      $or: [{ id: accountId }, { _id: accountId }],
      userId
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or does not belong to this user'
      });
    }

    // Check if account has sufficient funds
    if (parseFloat(amount) > account.balance && !accountType.toLowerCase().includes('credit')) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient funds in the account'
      });
    }

    // Validate against withdrawal limits
    const limits = {
      atm: 500,
      branch: 10000,
      cashAdvance: 3000
    };

    if (withdrawalType === 'atm' && parseFloat(amount) > limits.atm) {
      return res.status(400).json({
        success: false,
        error: `ATM withdrawals are limited to $${limits.atm} per day`
      });
    } else if (withdrawalType === 'branch' && parseFloat(amount) > limits.branch) {
      return res.status(400).json({
        success: false,
        error: `Branch withdrawals are limited to $${limits.branch} without prior notice`
      });
    } else if (withdrawalType === 'cashAdvance' && parseFloat(amount) > limits.cashAdvance) {
      return res.status(400).json({
        success: false,
        error: `Cash advances are limited to $${limits.cashAdvance} per transaction`
      });
    }

    // Create a new withdrawal record
    const withdrawal = new WithdrawFund({
      userId,
      accountId,
      accountType,
      withdrawalType,
      amount: parseFloat(amount),
      transactionFee: parseFloat(transactionFee || 0),
      note,
      receiptEmail,
      status: scheduledDate && scheduledTime ? 'scheduled' : 'pending'
    });

    // Add scheduled date/time if provided
    if (scheduledDate && scheduledTime) {
      withdrawal.scheduledDate = new Date(scheduledDate);
      withdrawal.scheduledTime = scheduledTime;
    }

    // Generate ATM code if it's an ATM withdrawal
    if (withdrawalType === 'atm') {
      withdrawal.atmCode = generateAtmCode();
    }

    // Save the withdrawal record
    await withdrawal.save();

    // Update account balance (unless it's scheduled for later)
    if (!scheduledDate && !scheduledTime) {
      if (accountType.toLowerCase().includes('credit')) {
        // For credit accounts, add to the balance (since credit balances are negative)
        account.balance += parseFloat(amount);
      } else {
        // For regular accounts, subtract from the balance
        account.balance -= parseFloat(amount) + parseFloat(transactionFee || 0);
      }
      await account.save();
    }

    // Send email receipt if requested
    if (receiptEmail) {
      // This would call your email service
      try {
        await sendEmail({
          to: receiptEmail,
          subject: 'Your Wells Fargo Withdrawal Receipt',
          html: `
            <h1>Wells Fargo Withdrawal Receipt</h1>
            <p>Transaction ID: ${withdrawal.transactionId}</p>
            <p>Amount: $${parseFloat(amount).toFixed(2)}</p>
            <p>Type: ${withdrawalType === 'atm' ? 'ATM Withdrawal' : 
                    withdrawalType === 'branch' ? 'Branch Withdrawal' : 'Cash Advance'}</p>
            <p>Date: ${new Date().toLocaleString()}</p>
            ${withdrawalType === 'atm' ? `<p>ATM Code: ${withdrawal.atmCode} (valid for 30 minutes)</p>` : ''}
            ${transactionFee > 0 ? `<p>Fee: $${parseFloat(transactionFee).toFixed(2)}</p>` : ''}
            <p>Thank you for banking with Wells Fargo!</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send receipt email:', emailError);
        // We don't want the entire transaction to fail if email sending fails
      }
    }

    // Return successful response with appropriate data
    res.status(200).json({
      success: true,
      data: {
        withdrawal: {
          id: withdrawal._id,
          transactionId: withdrawal.transactionId,
          status: withdrawal.status,
          amount: withdrawal.amount,
          atmCode: withdrawal.atmCode,
          accountBalance: account.balance,
          scheduledDate: withdrawal.scheduledDate,
          scheduledTime: withdrawal.scheduledTime,
          withdrawalType
        }
      },
      message: scheduledDate && scheduledTime ? 
               'Withdrawal scheduled successfully' : 
               'Withdrawal processed successfully'
    });

  } catch (error) {
    console.error('Withdrawal Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal. Please try again.'
    });
  }
};

// Get a user's withdrawal history
exports.getWithdrawalHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { accountId } = req.query;

    const query = { userId };
    if (accountId) {
      query.accountId = accountId;
    }

    const withdrawals = await WithdrawFund.find(query)
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        withdrawals: withdrawals.map(w => ({
          id: w._id,
          transactionId: w.transactionId,
          amount: w.amount,
          withdrawalType: w.withdrawalType,
          status: w.status,
          date: w.createdAt,
          scheduledDate: w.scheduledDate,
          accountId: w.accountId,
          accountType: w.accountType,
          location: w.location || 'Online'
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawal history'
    });
  }
};

// Get a specific withdrawal by ID
exports.getWithdrawalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const withdrawal = await WithdrawFund.findOne({ 
      $or: [{ _id: id }, { transactionId: id }],
      userId 
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        withdrawal: {
          id: withdrawal._id,
          transactionId: withdrawal.transactionId,
          accountId: withdrawal.accountId,
          accountType: withdrawal.accountType,
          amount: withdrawal.amount,
          withdrawalType: withdrawal.withdrawalType,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
          note: withdrawal.note,
          transactionFee: withdrawal.transactionFee,
          atmCode: withdrawal.atmCode,
          scheduledDate: withdrawal.scheduledDate,
          scheduledTime: withdrawal.scheduledTime,
          location: withdrawal.location || 'Online'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching withdrawal details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch withdrawal details'
    });
  }
};

// Get nearby ATM locations (simplified version, real implementation would use a geolocation API)
exports.getNearbyATMs = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    // This is a simplified example, in a real app you would:
    // 1. Use latitude/longitude to query a database or third-party API
    // 2. Return ATMs sorted by distance
    
    // Simulated response
    const atmLocations = [
      { 
        id: 1, 
        name: 'Wells Fargo - Main Branch', 
        address: '123 Main St, Anytown, USA', 
        distance: '0.3 miles',
        coordinates: { lat: 40.7128, lng: -74.0060 }
      },
      { 
        id: 2, 
        name: 'Wells Fargo ATM - Shopping Center', 
        address: '456 Market Ave, Anytown, USA', 
        distance: '1.2 miles',
        coordinates: { lat: 40.7138, lng: -74.0070 }
      },
      { 
        id: 3, 
        name: 'Wells Fargo ATM - Gas Station', 
        address: '789 Oak Blvd, Anytown, USA', 
        distance: '2.5 miles',
        coordinates: { lat: 40.7148, lng: -74.0080 }
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        atmLocations
      }
    });

  } catch (error) {
    console.error('Error fetching ATM locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ATM locations'
    });
  }
};

// Cancel a scheduled withdrawal
exports.cancelWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const withdrawal = await WithdrawFund.findOne({ 
      $or: [{ _id: id }, { transactionId: id }],
      userId,
      status: 'scheduled' 
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled withdrawal not found or cannot be canceled'
      });
    }

    // Update the status to canceled
    withdrawal.status = 'canceled';
    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal canceled successfully'
    });

  } catch (error) {
    console.error('Error canceling withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel withdrawal'
    });
  }
};

// Send receipt for a completed withdrawal
exports.sendReceiptEmail = async (req, res) => {
  try {
    const { transactionId, email } = req.body;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    const withdrawal = await WithdrawFund.findOne({
      transactionId,
      userId
    });

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal record not found'
      });
    }

    // Send the email receipt
    try {
      await sendEmail({
        to: email,
        subject: 'Your Wells Fargo Withdrawal Receipt',
        html: `
          <h1>Wells Fargo Withdrawal Receipt</h1>
          <p>Transaction ID: ${withdrawal.transactionId}</p>
          <p>Amount: $${withdrawal.amount.toFixed(2)}</p>
          <p>Type: ${withdrawal.withdrawalType === 'atm' ? 'ATM Withdrawal' : 
                 withdrawal.withdrawalType === 'branch' ? 'Branch Withdrawal' : 'Cash Advance'}</p>
          <p>Date: ${withdrawal.createdAt.toLocaleString()}</p>
          ${withdrawal.withdrawalType === 'atm' ? `<p>ATM Code: ${withdrawal.atmCode} (valid for 30 minutes)</p>` : ''}
          ${withdrawal.transactionFee > 0 ? `<p>Fee: $${withdrawal.transactionFee.toFixed(2)}</p>` : ''}
          <p>Thank you for banking with Wells Fargo!</p>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Receipt sent successfully'
      });
    } catch (emailError) {
      console.error('Failed to send receipt email:', emailError);
      res.status(500).json({
        success: false,
        error: 'Failed to send receipt email'
      });
    }

  } catch (error) {
    console.error('Error sending receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send receipt'
    });
  }
};