const mongoose = require('mongoose');

const AutopaySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourceAccount: {
    type: String,
    required: true
  },
  sourceAccountNumber: {
    type: String,
    required: true
  },
  payeeType: {
    type: String,
    enum: ['bill', 'transfer'],  // Changed 'bills' to 'bill' to match the frontend
    required: true
  },
  payeeId: {
    type: String,
    required: true
  },
  payeeName: {
    type: String,
    required: true
  },
  payeeAccountNumber: {
    type: String,
    required: true
  },
  paymentType: {
    type: String,
    enum: ['fixed', 'full', 'minimum', 'statement'],
    required: true
  },
  amount: {
    type: Number,
    required: function() {
      return this.paymentType === 'fixed';
    }
  },
  frequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'annually', 'custom'],
    required: true
  },
  customFrequency: {
    days: Number,
    period: {
      type: String,
      enum: ['days', 'weeks', 'months']
    }
  },
  startDate: {
    type: Date,
    required: true
  },
  endCondition: {
    type: String,
    enum: ['never', 'date', 'occurrences'],
    required: true
  },
  endDate: {
    type: Date,
    required: function() {
      return this.endCondition === 'date';
    }
  },
  occurrences: {
    type: Number,
    required: function() {
      return this.endCondition === 'occurrences';
    },
    min: 1
  },
  remainingOccurrences: {
    type: Number,
    default: function() {
      return this.endCondition === 'occurrences' ? this.occurrences : null;
    }
  },
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    reminder: {
      type: Boolean,
      default: true
    },
    textForFailure: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'active'
  },
  nextPaymentDate: {
    type: Date,
    required: true
  },
  lastPaymentDate: Date,
  lastPaymentAmount: Number,
  lastPaymentStatus: {
    type: String,
    enum: ['success', 'pending', 'failed', null],
    default: null
  },
  paymentHistory: [{
    date: Date,
    amount: Number,
    status: {
      type: String,
      enum: ['success', 'pending', 'failed']
    },
    reference: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate next payment date based on frequency and current date
AutopaySchema.methods.calculateNextPaymentDate = function(fromDate) {
  const date = fromDate || new Date();
  let nextDate = new Date(date);
  
  switch (this.frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'semiannually':
      nextDate.setMonth(nextDate.getMonth() + 6);
      break;
    case 'annually':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    case 'custom':
      if (this.customFrequency) {
        if (this.customFrequency.period === 'days') {
          nextDate.setDate(nextDate.getDate() + this.customFrequency.days);
        } else if (this.customFrequency.period === 'weeks') {
          nextDate.setDate(nextDate.getDate() + (this.customFrequency.days * 7));
        } else if (this.customFrequency.period === 'months') {
          nextDate.setMonth(nextDate.getMonth() + this.customFrequency.days);
        }
      }
      break;
  }
  
  return nextDate;
};

// Pre-save middleware to update the nextPaymentDate
AutopaySchema.pre('save', function(next) {
  // Update the updatedAt field
  this.updatedAt = new Date();
  
  // If this is a new document (first save), set the nextPaymentDate to startDate
  if (this.isNew) {
    this.nextPaymentDate = new Date(this.startDate);
  }
  
  next();
});

const Autopay = mongoose.model('Autopay', AutopaySchema);

module.exports = Autopay;