const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const TransactionSchema = new mongoose.Schema({
  date: {
    type: Date,
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
    required: true,
    enum: ['credit', 'debit']
  },
  category: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true
  }
});

const userSchema = new mongoose.Schema({
  // other fields
  checkingAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CheckingAccount'
  }]
  // other fields
});

const AccountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    required: true
  },
  routingNumber: {
    type: String,
    required: true
  },
  accountType: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: false
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  transactions: [TransactionSchema]
});

const UserSchema = new Schema({
  // Basic user information
  name: {
    type: String,
    required: [true, 'Please add a name'],
    default: function() {
      if (this.firstName && this.lastName) {
        return `${this.firstName} ${this.lastName}`;
      }
      return undefined; // Let the required validator handle it
    }
  },
  username: {
    type: String,
    unique: true,
    trim: true,
    maxlength: [50, 'Username cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    set: function(phone) {
      // Remove all non-digit characters
      return phone.replace(/\D/g, '');
    },
    validate: {
      validator: function(v) {
        // Check if it has exactly 10 digits after removing formatting
        return /^\d{10}$/.test(v);
      },
      message: 'Please enter a valid 10-digit phone number'
    }
  },
  // Personal information
  dateOfBirth: {
    type: Date
  },
  ssn: {
    type: String,
    maxlength: [4, 'SSN should be the last 4 digits only'],
    select: false
  },

  // Address information
  address: {
    line1: {
      type: String
    },
    line2: {
      type: String
    },
    city: {
      type: String
    },
    state: {
      type: String
    },
    zipCode: {
      type: String,
      match: [/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code']
    }
  },

  // Shipping addresses for check orders
  shippingAddresses: [
    {
      name: {
        type: String,
        required: true
      },
      street: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zip: {
        type: String,
        required: true
      },
      primary: {
        type: Boolean,
        default: false
      }
    }
  ],

  // Check order preferences
  checkOrderPreferences: {
    checkStyle: {
      type: String,
      enum: ['standard', 'premium', 'scenic', 'custom'],
      default: 'standard'
    },
    deliveryMethod: {
      type: String,
      enum: ['standard', 'expedited', 'overnight'],
      default: 'standard'
    },
    customization: {
      startingNumber: {
        type: String,
        default: ''
      },
      includeAddress: {
        type: Boolean,
        default: true
      },
      includePhoneNumber: {
        type: Boolean,
        default: false
      },
      includeDriversLicense: {
        type: Boolean,
        default: false
      },
      duplicateChecks: {
        type: Boolean,
        default: false
      },
      largePrint: {
        type: Boolean,
        default: false
      },
      fontStyle: {
        type: String,
        enum: ['standard', 'classic', 'script', 'modern'],
        default: 'standard'
      }
    }
  },

  // Security and authentication
  securityQuestion: {
    type: String
  },
  securityAnswer: {
    type: String,
    select: false,
    set: function(val) {
      // Store in lowercase for case-insensitive comparisons later
      return val ? val.toLowerCase() : val;
    }
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    paperlessBilling: {
      type: Boolean,
      default: true
    }
  },

  // Account information
  accounts: [AccountSchema],
  checkingAccounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CheckingAccount'
  }],

  // Password reset and security
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastLogin: Date,
  securityVerified: {
    type: Boolean,
    default: false
  },
  lastVerification: Date,

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  // Set name explicitly if not present but firstName and lastName are available
  if ((!this.name || this.name.trim() === '') && this.firstName && this.lastName) {
    this.name = `${this.firstName} ${this.lastName}`;
  }
  
  // Ensure name exists before continuing
  if (!this.name || this.name.trim() === '') {
    return next(new Error('Name is required'));
  }
  
  // Continue with password hashing only if password was modified
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Match security answer with stored answer (case insensitive)
UserSchema.methods.matchSecurityAnswer = function(enteredAnswer) {
  // Compare lowercase versions for case insensitivity
  return this.securityAnswer === enteredAnswer.toLowerCase();
};

// Generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);