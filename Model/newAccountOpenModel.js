const mongoose = require('mongoose');

const newAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountType: {
    type: String,
    required: true
  },
  initialDeposit: {
    type: Number,
    required: true
  },
  balance: {
    type: Number,
    required: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  routingNumber: {
    type: String,
    required: true
  },
  openedDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Active', 'Closed', 'Suspended'],
    default: 'Pending'
  },
  ownerName: {
    type: String,
    required: true
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }]
}, { timestamps: true });

const NewAccount = mongoose.model('NewAccount', newAccountSchema);
module.exports = NewAccount;