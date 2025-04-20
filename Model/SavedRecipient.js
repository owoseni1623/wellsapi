// models/SavedRecipient.js
const mongoose = require('mongoose');

const savedRecipientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nickname: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    enum: ['Checking', 'Savings', 'Wire'],
    required: true
  },
  bankName: {
    type: String,
    required: true
  },
  routingNumber: {
    type: String,
    required: true
  },
  swiftCode: String,
  accountHolderName: String,
  accountHolderAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String
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
savedRecipientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const SavedRecipient = mongoose.model('SavedRecipient', savedRecipientSchema);

module.exports = SavedRecipient;