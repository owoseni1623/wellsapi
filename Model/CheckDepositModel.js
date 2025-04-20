const mongoose = require('mongoose');

const checkDepositSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  frontImage: {
    type: String,  // Store path to image or base64
    required: true
  },
  backImage: {
    type: String,  // Store path to image or base64
    required: true
  },
  referenceNumber: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  depositDate: {
    type: Date,
    default: Date.now
  },
  availabilityDate: {
    type: Date,
    required: true
  },
  emailReceipt: {
    type: Boolean,
    default: true
  },
  mobileReceipt: {
    type: Boolean,
    default: true
  },
  endorsementConfirmed: {
    type: Boolean,
    required: true,
    default: false
  },
  rejectionReason: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Create index for efficient queries
checkDepositSchema.index({ userId: 1, depositDate: -1 });
checkDepositSchema.index({ referenceNumber: 1 }, { unique: true });

const CheckDeposit = mongoose.model('CheckDeposit', checkDepositSchema);
module.exports = CheckDeposit;