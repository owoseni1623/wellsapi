// models/accountModel.js
const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  // User reference - supporting both formats
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Account identifiers
  name: {
    type: String,
    required: [true, 'Please add an account name'],
    trim: true
  },
  accountId: {
    type: String
  },
  accountNumber: {
    type: String,
    required: [true, 'Please add an account number'],
    trim: true
  },
  number: {
    type: String
  },
  // Balance fields
  balance: {
    type: Number,
    required: [true, 'Please add an account balance'],
    default: 0
  },
  available: {
    type: Number,
    default: 0
  },
  // Account type
  type: {
    type: String,
    required: [true, 'Please specify the account type'],
    enum: ['checking', 'savings', 'credit', 'businessChecking'],
    default: 'checking'
  },
  // Status and additional fields
  isActive: {
    type: Boolean,
    default: true
  },
  recentDeposits: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create index for faster querying by user
AccountSchema.index({ user: 1 });
AccountSchema.index({ userId: 1 });

// Pre-save middleware to ensure consistency between duplicate fields
AccountSchema.pre('save', function(next) {
  // Ensure user and userId are synchronized
  if (this.user && !this.userId) {
    this.userId = this.user;
  } else if (this.userId && !this.user) {
    this.user = this.userId;
  }
  
  // Ensure accountNumber and number are synchronized
  if (this.accountNumber && !this.number) {
    this.number = this.accountNumber;
  } else if (this.number && !this.accountNumber) {
    this.accountNumber = this.number;
  }
  
  next();
});

module.exports = mongoose.model('Account', AccountSchema);