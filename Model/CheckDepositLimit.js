const mongoose = require('mongoose');

const checkDepositLimitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  limits: {
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
    }
  },
  // Track deposit totals for limits
  depositTotals: {
    today: {
      type: Number,
      default: 0
    },
    currentMonth: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
}, { timestamps: true });

// Create index for efficient queries
checkDepositLimitSchema.index({ userId: 1 }, { unique: true });

const CheckDepositLimit = mongoose.model('CheckDepositLimit', checkDepositLimitSchema);
module.exports = CheckDepositLimit;