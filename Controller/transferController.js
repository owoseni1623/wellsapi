// controllers/transferController.js
const Transfer = require('../Model/Transfer');
const Bank = require('../Model/Bank');
const SavedRecipient = require('../Model/SavedRecipient');
const User = require('../Model/UserModel');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Generate a random confirmation number
const generateConfirmationNumber = () => {
  const timestamp = new Date().getTime().toString().slice(-8);
  const random = crypto.randomBytes(2).toString('hex');
  return `TRN-${timestamp}-${random}`;
};

// Generate a random 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Configure nodemailer (replace with your email service details)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.getAllBanks = async (req, res) => {
  try {
    const banks = await Bank.find({ location: 'USA', active: true })
      .select('name routingNumber')
      .sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: banks.length,
      data: banks
    });
  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

exports.getUserAccounts = async (req, res) => {
  try {
    // In a real application, you would get the user ID from the authenticated user
    const userId = req.user.id;
    
    // Fetch the user's accounts
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
      error: 'Server error'
    });
  }
};

exports.getSavedRecipients = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const recipients = await SavedRecipient.find({ userId })
      .select('-__v -userId -updatedAt')
      .sort({ nickname: 1 });
    
    res.status(200).json({
      success: true,
      count: recipients.length,
      data: recipients
    });
  } catch (error) {
    console.error('Error fetching saved recipients:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Extract transfer details from request body
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
    
    // Calculate fee if it's a wire transfer
    const fee = transferType === 'wire' ? 30.00 : 0;
    
    // Generate confirmation number
    const confirmationNumber = generateConfirmationNumber();
    
    // Generate verification code
    const verificationCode = generateVerificationCode();
    
    // Create expiration date for verification code (e.g., 30 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    // Prepare external account details if applicable
    let externalAccountDetails;
    if (transferType === 'external' && externalAccount) {
      externalAccountDetails = {
        bankName: externalAccount.bankName,
        routingNumber: externalAccount.routingNumber,
        accountNumber: externalAccount.accountNumber,
        accountType: externalAccount.accountType,
        accountHolderName: externalAccount.accountHolderName,
        recipientNickname: externalAccount.recipientNickname || `${externalAccount.accountHolderName} (${externalAccount.bankName})`
      };
    }
    
    // Prepare wire transfer details if applicable
    let wireTransferDetails;
    if (transferType === 'wire' && wireTransfer) {
      wireTransferDetails = {
        bankName: wireTransfer.bankName,
        routingNumber: wireTransfer.routingNumber,
        swiftCode: wireTransfer.swiftCode,
        accountNumber: wireTransfer.accountNumber,
        accountHolderName: wireTransfer.accountHolderName,
        accountHolderAddress: wireTransfer.accountHolderAddress,
        recipientNickname: wireTransfer.recipientNickname || `${wireTransfer.accountHolderName} (${wireTransfer.bankName})`
      };
    }
    
    // Create transfer record
    const transfer = await Transfer.create({
      userId,
      transferType,
      fromAccount,
      toAccount,
      amount: parseFloat(amount),
      fee,
      memo,
      emailReceipt,
      emailAddress: emailReceipt ? emailAddress : undefined,
      transferDate: new Date(transferDate),
      transferFrequency,
      recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : undefined,
      externalAccountDetails,
      wireTransferDetails,
      status: 'awaiting_verification',
      verificationCode: {
        code: verificationCode,
        expiresAt,
        verified: false
      },
      confirmationNumber
    });
    
    // If the user chose to save a recipient, create a saved recipient record
    if ((transferType === 'external' && externalAccount?.saveRecipient) || 
        (transferType === 'wire' && wireTransfer?.saveRecipient)) {
      
      const recipientData = transferType === 'external' ? {
        userId,
        nickname: externalAccount.recipientNickname || `${externalAccount.accountHolderName} (${externalAccount.bankName})`,
        accountNumber: externalAccount.accountNumber,
        accountType: externalAccount.accountType === 'checking' ? 'Checking' : 'Savings',
        bankName: externalAccount.bankName,
        routingNumber: externalAccount.routingNumber,
        accountHolderName: externalAccount.accountHolderName
      } : {
        userId,
        nickname: wireTransfer.recipientNickname || `${wireTransfer.accountHolderName} (${wireTransfer.bankName})`,
        accountNumber: wireTransfer.accountNumber,
        accountType: 'Wire',
        bankName: wireTransfer.bankName,
        routingNumber: wireTransfer.routingNumber,
        swiftCode: wireTransfer.swiftCode,
        accountHolderName: wireTransfer.accountHolderName,
        accountHolderAddress: wireTransfer.accountHolderAddress
      };
      
      await SavedRecipient.create(recipientData);
    }
    
    // Return success response with verification message
    res.status(201).json({
      success: true,
      message: 'Transfer initiated. Please contact admin for verification code.',
      data: {
        transferId: transfer._id,
        confirmationNumber,
        status: transfer.status,
        amount: transfer.amount,
        fee: transfer.fee,
        total: transfer.amount + transfer.fee,
        transferType: transfer.transferType,
        transactionRef: confirmationNumber
      }
    });
    
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

exports.verifyTransfer = async (req, res) => {
  try {
    const { transferId, verificationCode } = req.body;
    
    // Find the transfer by ID
    const transfer = await Transfer.findById(transferId);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }
    
    // Check if the transfer is already verified
    if (transfer.verificationCode.verified) {
      return res.status(400).json({
        success: false,
        error: 'Transfer already verified'
      });
    }
    
    // Check if verification code has expired
    if (new Date() > transfer.verificationCode.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired'
      });
    }
    
    // Check if verification code is correct
    if (transfer.verificationCode.code !== verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }
    
    // Update transfer status and verification status
    transfer.status = 'verified';
    transfer.verificationCode.verified = true;
    await transfer.save();
    
    // Process the transfer (in a real app, this would involve more logic)
    // For now, just update the status to completed
    transfer.status = 'completed';
    await transfer.save();
    
    // Send email receipt if requested
    if (transfer.emailReceipt && transfer.emailAddress) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: transfer.emailAddress,
        subject: 'Transfer Receipt',
        html: `
          <h1>Transfer Receipt</h1>
          <p>Confirmation Number: ${transfer.confirmationNumber}</p>
          <p>Amount: $${transfer.amount.toFixed(2)}</p>
          <p>Date: ${transfer.transferDate.toLocaleDateString()}</p>
          <p>Status: Completed</p>
          <p>Thank you for using our service!</p>
        `
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email receipt:', error);
        }
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Transfer verified and processed successfully',
      data: {
        transferId: transfer._id,
        confirmationNumber: transfer.confirmationNumber,
        status: transfer.status
      }
    });
    
  } catch (error) {
    console.error('Error verifying transfer:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

exports.getTransferStatus = async (req, res) => {
  try {
    const { transferId } = req.params;
    
    const transfer = await Transfer.findById(transferId)
      .select('status confirmationNumber amount fee transferDate');
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: transfer
    });
    
  } catch (error) {
    console.error('Error getting transfer status:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Admin endpoint to get all transfers (would be protected by admin role)
exports.getAllTransfers = async (req, res) => {
  try {
    // In a real app, you would check if the user has admin role
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }
    
    const transfers = await Transfer.find()
      .select('-verificationCode.code')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: transfers.length,
      data: transfers
    });
    
  } catch (error) {
    console.error('Error getting all transfers:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

// Admin endpoint to manually approve a transfer
exports.approveTransfer = async (req, res) => {
  try {
    // In a real app, you would check if the user has admin role
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
      });
    }
    
    const { transferId } = req.params;
    
    const transfer = await Transfer.findById(transferId);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'Transfer not found'
      });
    }
    
    // Update transfer status
    transfer.status = 'completed';
    transfer.verificationCode.verified = true;
    await transfer.save();
    
    res.status(200).json({
      success: true,
      message: 'Transfer approved and processed successfully',
      data: {
        transferId: transfer._id,
        confirmationNumber: transfer.confirmationNumber,
        status: transfer.status
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