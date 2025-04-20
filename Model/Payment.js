const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payee',
    required: true
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  date: {
    type: Date,
    required: [true, 'Please add a payment date'],
    default: Date.now
  },
  amount: {
    type: Number,
    required: [true, 'Please add a payment amount']
  },
  status: {
    type: String,
    enum: ['Pending', 'Processed', 'Failed', 'Canceled'],
    default: 'Pending'
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  confirmationNumber: {
    type: String,
    unique: true
  },
  category: {
    type: String
  },
  memo: {
    type: String,
    default: ''
  },
  paymentFrequency: {
    type: String,
    enum: ['once', 'weekly', 'monthly'],
    default: 'once'
  },
  nextPaymentDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate a unique confirmation number before saving
PaymentSchema.pre('save', async function(next) {
  if (!this.confirmationNumber) {
    const date = new Date();
    const prefix = 'WF';
    const dateStr = date.toISOString().slice(0,10).replace(/-/g,'').substring(2); // YYMMDD
    const timeStr = date.toISOString().slice(11,19).replace(/:/g,''); // HHMMSS
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.confirmationNumber = `${prefix}${dateStr}${timeStr}${random}`;
  }
  next();
});

// Create indices for frequent queries
PaymentSchema.index({ user: 1, status: 1 });
PaymentSchema.index({ date: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);