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
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'transfer', 'interest', 'fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Active', 'Closed', 'Suspended', 'Completed'],
    default: 'Pending'
  },
  balance: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const savingsAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
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
    default: '121000248'
  },
  type: {
    type: String,
    default: 'Savings Account'
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
    default: 5.00
  },
  minBalance: {
    type: Number,
    default: 300.00
  },
  interestRate: {
    type: Number,
    default: 0.85 // 0.85% APY
  },
  interestAccrued: {
    type: Number,
    default: 0
  },
  interestYTD: {
    type: Number,
    default: 0
  },
  savingsGoal: {
    type: Number,
    default: 0
  },
  withdrawalsThisMonth: {
    type: Number,
    default: 0
  },
  maxMonthlyWithdrawals: {
    type: Number,
    default: 6
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  transactions: [transactionSchema]
}, { timestamps: true });

// Helper method to calculate interest
savingsAccountSchema.methods.calculateInterest = function(months = 1) {
  return this.balance * (this.interestRate / 100) * (months / 12);
};

// Recalculate interestAccrued and interestYTD
savingsAccountSchema.methods.updateInterestCalculations = function() {
  // Calculate monthly interest
  this.interestAccrued = this.calculateInterest(1);
  
  // Calculate YTD interest (assuming current year)
  const currentMonth = new Date().getMonth() + 1; // 0-indexed, so add 1
  this.interestYTD = this.calculateInterest(currentMonth);
  
  return this;
};

// Generate account number helper
savingsAccountSchema.statics.generateAccountNumber = async function() {
  // Generate random 10-digit number
  const randomNum = Math.floor(Math.random() * 9000000000) + 1000000000;
  const accountNumber = randomNum.toString();
  
  // Check if account number already exists
  const existingAccount = await this.findOne({ accountNumber });
  if (existingAccount) {
    // Recursively try again
    return this.generateAccountNumber();
  }
  
  return accountNumber;
};

const SavingsAccount = mongoose.model('SavingsAccount', savingsAccountSchema);

module.exports = SavingsAccount;