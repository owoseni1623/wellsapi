const mongoose = require('mongoose');

const WithdrawFundSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountId: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    required: true
  },
  withdrawalType: {
    type: String,
    enum: ['atm', 'branch', 'cashAdvance'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  transactionFee: {
    type: Number,
    default: 0
  },
  note: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'scheduled', 'canceled'],
    default: 'pending'
  },
  atmCode: {
    type: String
  },
  receiptEmail: {
    type: String
  },
  scheduledDate: {
    type: Date
  },
  scheduledTime: {
    type: String
  },
  location: {
    type: String,
    default: 'Online'
  },
  transactionId: {
    type: String,
    unique: true
  }
}, { timestamps: true });

// Generate unique transaction ID before saving
WithdrawFundSchema.pre('save', function(next) {
  if (!this.transactionId) {
    const prefix = this.withdrawalType === 'atm' ? 'WF-' : 
                  this.withdrawalType === 'branch' ? 'BR-' : 'CA-';
    this.transactionId = prefix + Math.floor(Math.random() * 1000000000);
  }
  next();
});

const WithdrawFund = mongoose.model('WithdrawFund', WithdrawFundSchema);

module.exports = WithdrawFund;