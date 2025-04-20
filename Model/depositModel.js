// models/depositModel.js
const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
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
    type: String, // Store image path/URL
    required: true
  },
  backImage: {
    type: String, // Store image path/URL
    required: true
  },
  referenceNumber: {
    type: String,
    required: true,
    unique: true
  },
  depositDate: {
    type: Date,
    default: Date.now
  },
  availabilityDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Rejected'],
    default: 'Pending'
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
    required: true
  },
  notes: String,
  rejectionReason: String
}, { timestamps: true });

// Create virtual property for formatted dates
depositSchema.virtual('formattedDepositDate').get(function() {
  return this.depositDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

depositSchema.virtual('formattedAvailabilityDate').get(function() {
  return this.availabilityDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

const Deposit = mongoose.model('Deposit', depositSchema);

module.exports = Deposit;