// models/Transfer.js
const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transferType: {
    type: String,
    enum: ['internal', 'external', 'wire'],
    required: true
  },
  fromAccount: {
    type: String,
    required: true
  },
  toAccount: {
    type: String,
    required: function() {
      // Only require toAccount for internal transfers
      return this.transferType === 'internal';
    }
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  fee: {
    type: Number,
    default: 0
  },
  memo: String,
  emailReceipt: {
    type: Boolean,
    default: false
  },
  emailAddress: String,
  transferDate: {
    type: Date,
    required: true
  },
  transferFrequency: {
    type: String,
    enum: ['once', 'weekly', 'biweekly', 'monthly'],
    default: 'once'
  },
  recurringEndDate: Date,
  externalAccountDetails: {
    bankName: String,
    routingNumber: String,
    accountNumber: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings']
    },
    accountHolderName: String,
    recipientNickname: String
  },
  wireTransferDetails: {
    bankName: String,
    routingNumber: String,
    swiftCode: String,
    accountNumber: String,
    accountHolderName: String,
    accountHolderAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String
    },
    recipientNickname: String
  },
  status: {
    type: String,
    enum: ['pending', 'awaiting_verification', 'verified', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  verificationCode: {
    code: String,
    expiresAt: Date,
    verified: {
      type: Boolean,
      default: false
    }
  },
  confirmationNumber: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the 'updatedAt' field on save
transferSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Transfer = mongoose.model('Transfer', transferSchema);

module.exports = Transfer;