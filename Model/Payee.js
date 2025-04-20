const mongoose = require('mongoose');

const PayeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a payee name'],
    trim: true
  },
  accountNumber: {
    type: String,
    required: [true, 'Please add an account number'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Please add a payee address'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Please add a category']
  },
  nickname: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create index for faster querying by user
PayeeSchema.index({ user: 1 });

module.exports = mongoose.model('Payee', PayeeSchema);