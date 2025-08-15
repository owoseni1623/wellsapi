const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Active', 'Closed', 'Suspended', 'Completed'],
    default: 'Pending'
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'payment', 'purchase', 'transfer', 'fee', 'credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['deposit', 'withdrawal', 'payment', 'purchase', 'transfer', 'fee', 'tax', 'Deposit', 'Tax', null],
    default: null
  }
});

const checkingAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    default: 'Everyday Checking'
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  routingNumber: {
    type: String,
    default: '121000248'
  },
  balance: {
    type: Number,
    default: 0
  },
  availableBalance: {
    type: Number,
    default: 0
  },
  openedDate: {
    type: Date,
    default: Date.now
  },
  monthlyFee: {
    type: Number,
    default: 10.00
  },
  minBalance: {
    type: Number,
    default: 1500.00
  },
  overdraftProtection: {
    type: Boolean,
    default: false
  },
  interestRate: {
    type: Number,
    default: 0.01
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  transactions: [transactionSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('CheckingAccount', checkingAccountSchema);