// models/depositLimitModel.js
const mongoose = require('mongoose');

const depositLimitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  minAmount: {
    type: Number,
    default: 0.01
  },
  maxAmount: {
    type: Number,
    default: 10000
  },
  dailyLimit: {
    type: Number,
    default: 5000
  },
  monthlyLimit: {
    type: Number,
    default: 20000
  },
  dailyDeposited: {
    type: Number,
    default: 0
  },
  dailyResetDate: {
    type: Date,
    default: () => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    }
  },
  monthlyDeposited: {
    type: Number,
    default: 0
  },
  monthlyResetDate: {
    type: Date,
    default: () => {
      const today = new Date();
      return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
  }
}, { timestamps: true });

const DepositLimit = mongoose.model('DepositLimit', depositLimitSchema);

module.exports = DepositLimit;