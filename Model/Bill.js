const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: [true, 'Please add a bill amount']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add a due date']
  },
  autopay: {
    type: Boolean,
    default: false
  },
  paymentSource: {
    type: String,
    default: null
  },
  paymentAmount: {
    type: Number,
    default: null
  },
  lastPaymentDate: {
    type: Date,
    default: null
  },
  category: {
    type: String,
    required: true
  },
  reminderSet: {
    type: Boolean,
    default: false
  },
  reminderDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['upcoming', 'paid', 'overdue'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

// Create index for querying bills by user and status
BillSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Bill', BillSchema);