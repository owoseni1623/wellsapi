const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Transaction sub-schema (nested within credit account)
const TransactionSchema = new Schema({
  date: {
    type: Date,
    default: Date.now
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['purchase', 'payment', 'fee', 'refund', 'interest', 'other'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Disputed'],
    default: 'Completed'
  },
  balance: {
    type: Number,
    required: true
  },
  merchant: {
    type: String
  },
  category: {
    type: String
  }
});

// Main Credit Account Schema
const CreditAccountSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true
  },
  routingNumber: {
    type: String,
    default: '121000248' // Default routing number
  },
  type: {
    type: String,
    default: 'Credit Account'
  },
  balance: {
    type: Number,
    default: 0 // For credit accounts, negative balance means user owes money
  },
  creditLimit: {
    type: Number,
    default: 5000
  },
  availableCredit: {
    type: Number,
    default: function() {
      return this.creditLimit - Math.abs(this.balance);
    },
    // No setter needed, this will be calculated
  },
  minimumPayment: {
    type: Number,
    default: 25
  },
  dueDate: {
    type: Date,
    default: function() {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // Default due date 30 days from now
      return dueDate;
    }
  },
  annualFee: {
    type: Number,
    default: 0
  },
  interestRate: {
    type: Number,
    default: 16.99 // APR in percentage
  },
  rewardPoints: {
    type: Number,
    default: 0
  },
  statementBalance: {
    type: Number,
    default: 0
  },
  openedDate: {
    type: Date,
    default: Date.now
  },
  lastPaymentDate: {
    type: Date
  },
  lastPaymentAmount: {
    type: Number
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended', 'Closed'],
    default: 'Active'
  },
  transactions: [TransactionSchema]
}, {
  timestamps: true
});

// Generate a unique credit card number
CreditAccountSchema.statics.generateAccountNumber = async function() {
  // Generate random 16-digit number (starting with 5424 for a Mastercard format)
  const prefix = '5424';
  const randomDigits = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  const candidateNumber = prefix + randomDigits;
  
  // Check if the number already exists
  const existingAccount = await this.findOne({ accountNumber: candidateNumber });
  
  if (existingAccount) {
    // If exists, recursively try again
    return this.generateAccountNumber();
  }
  
  return candidateNumber;
};

// Method to update credit utilization
CreditAccountSchema.methods.updateCreditUtilization = function() {
  // Calculate credit utilization (percentage of credit used)
  if (this.creditLimit > 0) {
    this.creditUtilization = (Math.abs(this.balance) / this.creditLimit) * 100;
  } else {
    this.creditUtilization = 0;
  }
  
  // Update available credit
  this.availableCredit = this.creditLimit - Math.abs(this.balance);
  
  // Calculate minimum payment (typically 2% of balance or $25, whichever is higher)
  this.minimumPayment = Math.max(25, Math.abs(this.balance) * 0.02);
  
  return this;
};

// Calculate interest charges
CreditAccountSchema.methods.calculateInterestCharges = function() {
  if (this.balance < 0) { // Only calculate interest on debt (negative balance)
    const monthlyRate = this.interestRate / 100 / 12;
    return Math.abs(this.balance) * monthlyRate;
  }
  return 0;
};

// Pre-save middleware to ensure available credit is calculated correctly
CreditAccountSchema.pre('save', function(next) {
  // Update available credit before saving
  this.availableCredit = this.creditLimit - Math.abs(this.balance);
  next();
});

module.exports = mongoose.model('CreditAccount', CreditAccountSchema);