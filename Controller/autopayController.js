const Autopay = require('../Model/AutopayModel');
const Account = require('../Model/Account');
const User = require('../Model/UserModel');
const mongoose = require('mongoose');

// Helper function to validate amount
const validateAmount = async (sourceAccountId, amount) => {
  try {
    console.log("Validating source account ID:", sourceAccountId);
   
    // Try multiple ways to find the account
    let account = null;
   
    // First, try looking up in the User model (since accounts are embedded)
    const userWithAccount = await User.findOne({
      "accounts._id": mongoose.Types.ObjectId.isValid(sourceAccountId) ?
        new mongoose.Types.ObjectId(sourceAccountId) : sourceAccountId
    });
   
    if (userWithAccount) {
      account = userWithAccount.accounts.find(acc =>
        acc._id.toString() === sourceAccountId.toString() ||
        (acc.id && acc.id.toString() === sourceAccountId.toString())
      );
     
      if (account) {
        console.log("Account found in user document:", account.accountNumber);
      }
    }
   
    // If still not found, try standalone Account model if you have one
    if (!account && Account) {
      // First try by ObjectId if valid
      if (mongoose.Types.ObjectId.isValid(sourceAccountId)) {
        account = await Account.findById(new mongoose.Types.ObjectId(sourceAccountId));
      }
     
      // If not found, try by string id field
      if (!account) {
        account = await Account.findOne({ id: sourceAccountId });
      }
     
      // If still not found, try by accountNumber
      if (!account) {
        account = await Account.findOne({ accountNumber: sourceAccountId });
      }
    }
   
    if (!account) {
      console.log("Account not found for ID:", sourceAccountId);
      return { valid: false, message: `Source account not found (${sourceAccountId})` };
    }
   
    console.log("Account found:", account.accountType || account.type, account.balance);
   
    // Check if the account has sufficient balance for a fixed amount payment
    if ((account.accountType || account.type).toLowerCase().includes('credit')) {
      // For credit accounts, check available credit
      const creditLimit = account.creditLimit || 0;
      if (account.balance + amount > creditLimit) {
        return { valid: false, message: 'Payment amount exceeds available credit' };
      }
    } else {
      // For deposit accounts, check available balance
      if (amount > account.balance) {
        return { valid: false, message: 'Payment amount exceeds available balance' };
      }
    }
   
    return { valid: true };
  } catch (error) {
    console.error("Error in validateAmount:", error);
    return { valid: false, message: 'Error validating amount: ' + error.message };
  }
};

// Get all autopay settings for a user
exports.getAllAutopays = async (req, res) => {
  try {
    // Extract userId from multiple possible locations
    const userId = req.userId || (req.user && (req.user.id || req.user._id));
    
    console.log("Fetching autopays for userId:", userId);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in request'
      });
    }
    
    const autopays = await Autopay.find({ userId: userId }).sort({ nextPaymentDate: 1 });
    
    console.log(`Found ${autopays.length} autopay settings for user`);
    
    res.status(200).json({
      success: true,
      data: autopays
    });
  } catch (error) {
    console.error("Error in getAllAutopays:", error);
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Get a single autopay setting
exports.getAutopayById = async (req, res) => {
  try {
    const autopay = await Autopay.findOne({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!autopay) {
      return res.status(404).json({
        success: false,
        error: 'Automatic payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: autopay
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Create a new autopay setting
exports.createAutopay = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      payFromAccount,
      sourceAccountNumber,
      payeeType,
      selectedPayee,
      payeeName,
      payeeAccountNumber,
      paymentType,
      paymentAmount,
      frequency,
      customFrequency,
      startDate,
      endCondition,
      endDate,
      numOccurrences,
      notifications
    } = req.body;
    
    // Make sure userId exists - fix for "User ID: undefined" error
    if (!req.user || !req.user._id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: 'User not authenticated properly'
      });
    }
    
    // Use the correct user ID from auth middleware
    const userId = req.user._id;
    
    // Add detailed console logs for debugging
    console.log("Creating autopay with source account:", payFromAccount);
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User ID:", userId);
    
    // Basic validation
    if (!payFromAccount || !payeeType || !selectedPayee || !frequency || !startDate || !endCondition) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields'
      });
    }
    
    // Validate payment amount for fixed payments
    if (paymentType === 'fixed') {
        if (!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            error: 'Please provide a valid payment amount'
          });
        }
        
        // Validate amount against account balance
        console.log(`Validating payment amount ${paymentAmount} for account ${payFromAccount}`);
        const validationResult = await validateAmount(payFromAccount, parseFloat(paymentAmount));
        if (!validationResult.valid) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            error: validationResult.message
          });
        }
      }
    
    // Validate dates
    if (!startDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Please provide a start date'
      });
    }
    
    if (endCondition === 'date' && !endDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Please provide an end date'
      });
    }
    
    if (endCondition === 'date' && new Date(endDate) < new Date(startDate)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }
    
    if (endCondition === 'occurrences' && (!numOccurrences || numOccurrences < 1)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid number of payments'
      });
    }
    
    // Create autopay object
    const autopayData = {
      userId: userId,  // Use the correct userId here
      sourceAccount: payFromAccount,
      sourceAccountNumber: sourceAccountNumber || '',
      payeeType,
      payeeId: selectedPayee,
      payeeName: payeeName || 'Unnamed Payee',
      payeeAccountNumber: payeeAccountNumber || '',
      paymentType,
      amount: paymentType === 'fixed' ? parseFloat(paymentAmount) : null,
      frequency,
      customFrequency,
      startDate: new Date(startDate),
      endCondition,
      endDate: endCondition === 'date' ? new Date(endDate) : null,
      occurrences: endCondition === 'occurrences' ? numOccurrences : null,
      remainingOccurrences: endCondition === 'occurrences' ? numOccurrences : null,
      notifications: {
        email: notifications?.email ?? true,
        reminder: notifications?.reminder ?? true,
        textForFailure: notifications?.textForFailure ?? false
      },
      status: 'active',
      nextPaymentDate: new Date(startDate)
    };
    
    console.log("Creating autopay with data:", JSON.stringify(autopayData, null, 2));
    
    const autopay = new Autopay(autopayData);
    
    // Calculate next payment date
    if (new Date(startDate) <= new Date()) {
      autopay.nextPaymentDate = autopay.calculateNextPaymentDate(new Date(startDate));
    }
    
    await autopay.save({ session });
    await session.commitTransaction();
    session.endSession();
    
    console.log("Autopay created successfully:", autopay._id);
    
    res.status(201).json({
      success: true,
      data: autopay,
      message: 'Automatic payment set up successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error("Error in createAutopay:", error);
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Update an autopay setting
// Update an autopay setting
exports.updateAutopay = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      paymentType,
      paymentAmount,
      frequency,
      customFrequency,
      startDate,
      endCondition,
      endDate,
      numOccurrences,
      notifications,
      status
    } = req.body;
    
    // Extract userId from multiple possible locations
    const userId = req.userId || (req.user && (req.user.id || req.user._id));
    
    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({
        success: false,
        error: 'User ID not found in request'
      });
    }
    
    // Find the autopay
    const autopay = await Autopay.findOne({
      _id: req.params.id,
      userId: userId
    });
    
    if (!autopay) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Automatic payment not found'
      });
    }
    
    // Update fields if provided
    if (paymentType) autopay.paymentType = paymentType;
    
    if (paymentType === 'fixed' && paymentAmount) {
      // Validate payment amount
      if (isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: 'Please provide a valid payment amount'
        });
      }
      
      // Validate amount against account balance
      const validationResult = await validateAmount(autopay.sourceAccount, parseFloat(paymentAmount));
      if (!validationResult.valid) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: validationResult.message
        });
      }
      
      autopay.amount = parseFloat(paymentAmount);
    }
    
    if (frequency) autopay.frequency = frequency;
    if (customFrequency) {
      autopay.customFrequency = {
        days: parseInt(customFrequency),
        period: 'days'
      };
    }
    
    if (startDate) {
      autopay.startDate = new Date(startDate);
      // Recalculate next payment date if start date is changed
      autopay.nextPaymentDate = new Date(startDate) > new Date() 
        ? new Date(startDate) 
        : autopay.calculateNextPaymentDate(new Date());
    }
    
    if (endCondition) {
      autopay.endCondition = endCondition;
      
      if (endCondition === 'date' && endDate) {
        // Validate end date
        if (new Date(endDate) < autopay.nextPaymentDate) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            error: 'End date must be after next payment date'
          });
        }
        autopay.endDate = new Date(endDate);
        autopay.occurrences = null;
        autopay.remainingOccurrences = null;
      } else if (endCondition === 'occurrences' && numOccurrences) {
        // Validate occurrences
        if (numOccurrences < 1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            error: 'Please provide a valid number of payments'
          });
        }
        autopay.occurrences = numOccurrences;
        autopay.remainingOccurrences = numOccurrences;
        autopay.endDate = null;
      } else if (endCondition === 'never') {
        autopay.endDate = null;
        autopay.occurrences = null;
        autopay.remainingOccurrences = null;
      }
    }
    
    if (notifications) {
      autopay.notifications = {
        ...autopay.notifications,
        ...notifications
      };
    }
    
    if (status) {
      // Validate status changes
      const validStatusChanges = {
        'active': ['paused', 'cancelled'],
        'paused': ['active', 'cancelled'],
        'completed': [],
        'failed': ['active', 'cancelled'],
        'cancelled': []
      };
      
      if (!validStatusChanges[autopay.status].includes(status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: `Cannot change status from ${autopay.status} to ${status}`
        });
      }
      
      autopay.status = status;
      
      // If reactivating a paused automatic payment, recalculate next payment date
      if (status === 'active' && autopay.status === 'paused') {
        autopay.nextPaymentDate = autopay.calculateNextPaymentDate(new Date());
      }
    }
    
    console.log("Saving updated autopay:", autopay);
    await autopay.save({ session });
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      data: autopay,
      message: 'Automatic payment updated successfully'
    });
  } catch (error) {
    console.error("Error in updateAutopay:", error);
    await session.abortTransaction();
    session.endSession();
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Delete an autopay setting
exports.deleteAutopay = async (req, res) => {
  try {
    const autopay = await Autopay.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!autopay) {
      return res.status(404).json({
        success: false,
        error: 'Automatic payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Automatic payment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};

// Get payees for autopay (bills and transfer accounts)
exports.getPayees = async (req, res) => {
    try {
      // Make sure we're getting the user ID from the correct place
      // Your auth middleware might be storing it as userId, user.id, or user._id
      const userId = req.userId || (req.user && (req.user.id || req.user._id));
      
      console.log("getPayees called with userId:", userId); // Better debugging
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User ID not found in request'
        });
      }
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
  
      // Get user's own accounts for transfers
      const accounts = await Account.find({ userId: userId });
      console.log("Found accounts:", accounts.length); // Add this for debugging
      
      // Format accounts as transfer payees
      const transferPayees = accounts.map(account => ({
        id: account._id,
        name: account.type,
        accountNum: account.accountNumber,
        routingNum: account.routingNumber || '121042882',
        balance: account.balance,
        type: account.type.toLowerCase().includes('credit') ? 'credit' : 'internal',
        balanceDue: account.type.toLowerCase().includes('credit') ? Math.abs(account.balance) : null,
        minPayment: account.minPayment || null,
        dueDate: account.dueDate || null
      }));
  
      // Sample bill payees
      const billPayees = [
        { 
          id: 'electric-001', 
          name: 'Pacific Gas & Electric', 
          accountNum: '7890123', 
          lastAmount: 124.56,
          dueDate: '2025-04-15',
          address: '77 Beale St, San Francisco, CA 94105',
          category: 'utilities'
        },
        // Include other payees as in your original code
      ];
      
      res.status(200).json({
        success: true,
        data: {
          billPayees,
          transferPayees
        }
      });
    } catch (error) {
      console.error("Error in getPayees:", error); // Add this for debugging
      res.status(500).json({
        success: false,
        error: 'Server error: ' + error.message
      });
    }
  };

// Process scheduled payments (would be called by a job scheduler)
exports.processScheduledPayments = async (req, res) => {
  // This would normally be triggered by a cron job, not an API endpoint
  // But included here for completeness
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Get all active autopays with next payment date before or equal to now
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const autopaymentsToProcess = await Autopay.find({
      status: 'active',
      nextPaymentDate: { $lte: today }
    });
    
    const results = {
      success: [],
      failed: []
    };
    
    for (const autopay of autopaymentsToProcess) {
      try {
        // Get source account
        const sourceAccount = await Account.findById(autopay.sourceAccount);
        if (!sourceAccount) {
          throw new Error('Source account not found');
        }
        
        // Determine payment amount
        let paymentAmount = 0;
        
        if (autopay.paymentType === 'fixed') {
          paymentAmount = autopay.amount;
        } else if (autopay.paymentType === 'minimum' && autopay.payeeType === 'transfer') {
          // For credit card minimum payments
          const destinationAccount = await Account.findById(autopay.payeeId);
          if (!destinationAccount) {
            throw new Error('Destination account not found');
          }
          paymentAmount = destinationAccount.minPayment || 0;
        } else if (autopay.paymentType === 'full' || autopay.paymentType === 'statement') {
          // For full or statement balance payments
          if (autopay.payeeType === 'transfer') {
            const destinationAccount = await Account.findById(autopay.payeeId);
            if (!destinationAccount) {
              throw new Error('Destination account not found');
            }
            paymentAmount = Math.abs(destinationAccount.balance);
          } else {
            // For bill payments, we'd need to fetch the latest bill amount
            // This is just a placeholder - in a real system, you'd get this from a bill API
            paymentAmount = 100.00; // Default placeholder value
          }
        }
        
        // Validate source account has sufficient funds
        if (!sourceAccount.type.toLowerCase().includes('credit') && sourceAccount.balance < paymentAmount) {
          throw new Error('Insufficient funds');
        }
        
        // For credit source accounts, check credit limit
        if (sourceAccount.type.toLowerCase().includes('credit') && 
            Math.abs(sourceAccount.balance) + paymentAmount > sourceAccount.creditLimit) {
          throw new Error('Payment would exceed credit limit');
        }
        
        // Process the payment
        // In a real system, this would call a payment processor or bank API
        
        // Update source account balance
        if (sourceAccount.type.toLowerCase().includes('credit')) {
          sourceAccount.balance -= paymentAmount; // Increase debt for credit accounts
        } else {
          sourceAccount.balance -= paymentAmount; // Decrease balance for deposit accounts
        }
        await sourceAccount.save({ session });
        
        // If transfer to internal account, update destination account balance
        if (autopay.payeeType === 'transfer') {
          const destinationAccount = await Account.findById(autopay.payeeId);
          if (destinationAccount) {
            if (destinationAccount.type.toLowerCase().includes('credit')) {
              destinationAccount.balance += paymentAmount; // Reduce debt for credit accounts
            } else {
              destinationAccount.balance += paymentAmount; // Increase balance for deposit accounts
            }
            await destinationAccount.save({ session });
          }
        }
        
        // Update autopay record
        const paymentReference = `AP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        autopay.lastPaymentDate = new Date();
        autopay.lastPaymentAmount = paymentAmount;
        autopay.lastPaymentStatus = 'success';
        
        // Add to payment history
        autopay.paymentHistory.push({
          date: new Date(),
          amount: paymentAmount,
          status: 'success',
          reference: paymentReference
        });
        
        // Update remaining occurrences if applicable
        if (autopay.endCondition === 'occurrences' && autopay.remainingOccurrences) {
          autopay.remainingOccurrences--;
          
          // If all occurrences completed, mark as completed
          if (autopay.remainingOccurrences <= 0) {
            autopay.status = 'completed';
          }
        }
        
        // Check if end date has been reached
        if (autopay.endCondition === 'date' && autopay.endDate && new Date() >= autopay.endDate) {
          autopay.status = 'completed';
        }
        
        // Calculate next payment date if not completed
        if (autopay.status === 'active') {
          autopay.nextPaymentDate = autopay.calculateNextPaymentDate(new Date());
          
          // Check if next payment date exceeds end date
          if (autopay.endCondition === 'date' && autopay.endDate && 
              autopay.nextPaymentDate > autopay.endDate) {
            autopay.status = 'completed';
          }
        }
        
        await autopay.save({ session });
        
        results.success.push({
          id: autopay._id,
          amount: paymentAmount,
          reference: paymentReference
        });
      } catch (error) {
        // If this specific payment fails, log the error and continue with others
        console.error(`Error processing autopay ${autopay._id}:`, error);
        
        // Update autopay record with failure
        autopay.lastPaymentStatus = 'failed';
        
        // Add to payment history
        autopay.paymentHistory.push({
          date: new Date(),
          amount: 0,
          status: 'failed',
          reference: null
        });
        
        // Calculate next payment date
        autopay.nextPaymentDate = autopay.calculateNextPaymentDate(new Date());
        
        await autopay.save({ session });
        
        results.failed.push({
          id: autopay._id,
          error: error.message
        });
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      data: results,
      message: `Processed ${results.success.length} payments successfully, ${results.failed.length} failed`
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    res.status(500).json({
      success: false,
      error: 'Server error: ' + error.message
    });
  }
};