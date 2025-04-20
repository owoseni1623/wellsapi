const DisputeTransaction = require('../Model/DisputeTransactionModel');
const User = require('../Model/UserModel');
const asyncHandler = require('express-async-handler');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/disputes');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Filter allowed file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
}).array('attachments', 5); // Max 5 files

// @desc    Create a new dispute
// @route   POST /api/disputes
// @access  Private
exports.createDispute = asyncHandler(async (req, res, next) => {
  // Handle file uploads first
  upload(req, res, async function(err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        success: false,
        error: `Error: ${err.message}`
      });
    }
    
    try {
      // Process the uploaded files
      const attachments = req.files ? req.files.map(file => ({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.path
      })) : [];
      
      // Get user from auth middleware
      const user = req.user.id;
      
      // Validate required fields
      const {
        transactionId,
        transactionDate,
        transactionDescription,
        transactionAmount,
        cardLast4,
        reason,
        contactMethod,
        contactDetails
      } = req.body;
      
      if (!transactionId || !transactionDate || !reason || !contactMethod) {
        return res.status(400).json({
          success: false,
          error: 'Please provide all required fields'
        });
      }
      
      // Create dispute with status history
      const dispute = await DisputeTransaction.create({
        user,
        transactionId,
        transactionDate,
        transactionDescription,
        transactionAmount,
        cardLast4,
        reason,
        subReason: req.body.subReason || null,
        description: req.body.description || null,
        contactMethod,
        contactDetails: JSON.parse(contactDetails),
        temporaryCreditRequested: req.body.temporaryCreditRequested === 'true',
        isFraud: req.body.isFraud === 'true',
        fraudDetails: req.body.fraudDetails ? JSON.parse(req.body.fraudDetails) : null,
        cardStatus: req.body.cardStatus || 'keep',
        attachments
      });
      
      // If card is to be blocked, add status update
      if (req.body.cardStatus === 'block') {
        dispute.statusHistory.push({
          status: 'Card Blocked',
          description: 'Card has been blocked for security reasons.',
          date: new Date(),
          updatedBy: 'System'
        });
        dispute.cardBlocked = true;
        dispute.cardBlockedDate = new Date();
      }
      
      // If temporary credit is requested, add status update
      if (req.body.temporaryCreditRequested === 'true') {
        dispute.statusHistory.push({
          status: 'Temporary Credit Issued',
          description: `A temporary credit of $${Math.abs(parseFloat(transactionAmount)).toFixed(2)} has been applied to your account.`,
          date: new Date(),
          updatedBy: 'System'
        });
        dispute.temporaryCreditIssued = true;
        dispute.temporaryCreditAmount = Math.abs(parseFloat(transactionAmount));
        dispute.temporaryCreditDate = new Date();
      }
      
      await dispute.save();
      
      res.status(201).json({
        success: true,
        data: dispute
      });
    } catch (error) {
      console.error('Dispute creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error while creating dispute'
      });
    }
  });
});

// @desc    Get all disputes for a user
// @route   GET /api/disputes
// @access  Private
exports.getDisputes = asyncHandler(async (req, res) => {
  const disputes = await DisputeTransaction.find({ user: req.user.id })
    .sort({ createdAt: -1 });
    
  res.status(200).json({
    success: true,
    count: disputes.length,
    data: disputes
  });
});

// @desc    Get single dispute
// @route   GET /api/disputes/:id
// @access  Private
exports.getDispute = asyncHandler(async (req, res) => {
  const dispute = await DisputeTransaction.findById(req.params.id);
  
  // Check if dispute exists
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }
  
  // Make sure user owns the dispute
  if (dispute.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this dispute'
    });
  }
  
  res.status(200).json({
    success: true,
    data: dispute
  });
});

// @desc    Get dispute by dispute number
// @route   GET /api/disputes/number/:disputeNumber
// @access  Private
exports.getDisputeByNumber = asyncHandler(async (req, res) => {
  const dispute = await DisputeTransaction.findOne({ 
    disputeNumber: req.params.disputeNumber 
  });
  
  // Check if dispute exists
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }
  
  // Make sure user owns the dispute
  if (dispute.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this dispute'
    });
  }
  
  res.status(200).json({
    success: true,
    data: dispute
  });
});

// @desc    Update dispute
// @route   PUT /api/disputes/:id
// @access  Private
exports.updateDispute = asyncHandler(async (req, res) => {
  let dispute = await DisputeTransaction.findById(req.params.id);
  
  // Check if dispute exists
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }
  
  // Make sure user owns the dispute
  if (dispute.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to update this dispute'
    });
  }
  
  // Check if dispute is still editable
  if (dispute.status !== 'Pending' && dispute.status !== 'Awaiting Information') {
    return res.status(400).json({
      success: false,
      error: 'This dispute can no longer be updated'
    });
  }
  
  // Handle file uploads if there are any
  if (req.files && req.files.length > 0) {
    upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({
          success: false,
          error: `File upload error: ${err.message}`
        });
      }
      
      // Add new files to the existing attachments
      const newAttachments = req.files.map(file => ({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.path
      }));
      
      // Add status update for new attachments
      dispute.statusHistory.push({
        status: 'Updated',
        description: 'Additional documentation provided.',
        date: new Date(),
        updatedBy: req.user.name || 'User'
      });
      
      dispute.attachments = [...dispute.attachments, ...newAttachments];
      dispute = await dispute.save();
      
      res.status(200).json({
        success: true,
        data: dispute
      });
    });
  } else {
    // Update allowed fields
    const allowedUpdates = ['description', 'contactMethod', 'contactDetails'];
    
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        dispute[key] = req.body[key];
      }
    }
    
    // Add status update
    dispute.statusHistory.push({
      status: 'Updated',
      description: 'Dispute information updated.',
      date: new Date(),
      updatedBy: req.user.name || 'User'
    });
    
    dispute = await dispute.save();
    
    res.status(200).json({
      success: true,
      data: dispute
    });
  }
});

// @desc    Cancel dispute
// @route   PUT /api/disputes/:id/cancel
// @access  Private
exports.cancelDispute = asyncHandler(async (req, res) => {
  let dispute = await DisputeTransaction.findById(req.params.id);
  
  // Check if dispute exists
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }
  
  // Make sure user owns the dispute
  if (dispute.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to cancel this dispute'
    });
  }
  
  // Check if dispute can be cancelled
  if (dispute.status === 'Resolved' || dispute.status === 'Denied' || dispute.status === 'Cancelled') {
    return res.status(400).json({
      success: false,
      error: 'This dispute cannot be cancelled'
    });
  }
  
  // Update status
  dispute.status = 'Cancelled';
  dispute.resolutionOutcome = 'Cancelled';
  dispute.resolutionDate = new Date();
  dispute.resolutionNotes = req.body.notes || 'Cancelled by user';
  
  // Add status update
  dispute.statusHistory.push({
    status: 'Cancelled',
    description: 'Dispute has been cancelled by the user.',
    date: new Date(),
    updatedBy: req.user.name || 'User'
  });
  
  // If temporary credit was issued, add status update for reversal
  if (dispute.temporaryCreditIssued) {
    dispute.statusHistory.push({
      status: 'Temporary Credit Reversed',
      description: `Temporary credit of $${dispute.temporaryCreditAmount.toFixed(2)} has been reversed.`,
      date: new Date(),
      updatedBy: 'System'
    });
  }
  
  dispute = await dispute.save();
  
  res.status(200).json({
    success: true,
    data: dispute
  });
});

// @desc    Download attachment
// @route   GET /api/disputes/:id/attachments/:attachmentId
// @access  Private
exports.downloadAttachment = asyncHandler(async (req, res) => {
  const dispute = await DisputeTransaction.findById(req.params.id);
  
  // Check if dispute exists
  if (!dispute) {
    return res.status(404).json({
      success: false,
      error: 'Dispute not found'
    });
  }
  
  // Make sure user owns the dispute
  if (dispute.user.toString() !== req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this attachment'
    });
  }
  
  // Find attachment
  const attachment = dispute.attachments.id(req.params.attachmentId);
  
  if (!attachment) {
    return res.status(404).json({
      success: false,
      error: 'Attachment not found'
    });
  }
  
  // Send file
  res.download(attachment.filePath, attachment.fileName);
});