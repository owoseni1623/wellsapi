// const mongoose = require('mongoose');

// const transactionSchema = new mongoose.Schema({
//   date: {
//     type: Date,
//     default: Date.now,
//     required: true
//   },
//   description: {
//     type: String,
//     required: true
//   },
//   amount: {
//     type: Number,
//     required: true
//   },
//   type: {
//     type: String,
//     enum: ['credit', 'debit', 'withdrawal', 'deposit'],
//     required: true
//   },
//   category: {
//     type: String,
//     required: false
//   },
//   balance: {
//     type: Number,
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
//     default: 'Completed'
//   },
//   processed: {
//     type: Boolean,
//     default: true
//   },
//   cardLast4: {
//     type: String,
//     default: '0000'
//   },
//   hasBeenDisputed: {
//     type: Boolean,
//     default: false
//   },
//   accountId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Account', // Or whatever your account model is called
//     required: true
//   },
// }, { timestamps: true });

// const Transaction = mongoose.model('Transaction', transactionSchema);
// module.exports = Transaction;




const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NewAccount', // This should reference your account model
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer', 'payment', 'fee', 'interest', 'other'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;