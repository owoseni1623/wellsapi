// models/ProfileModel.js
const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
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
      type: String
    }
  },
  dateOfBirth: {
    type: Date
  },
  profilePicture: {
    type: String
  },
  creditScore: {
    type: Number,
    default: 740
  },
  customerId: {
    type: String,
    default: function() {
      // Generate a random 10-digit customer ID if not provided
      return Math.floor(1000000000 + Math.random() * 9000000000).toString();
    }
  },
  memberSince: {
    type: String,
    default: function() {
      const date = new Date();
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    }
  },
  verificationStatus: {
    emailVerified: {
      type: Boolean,
      default: true
    },
    phoneVerified: {
      type: Boolean,
      default: true
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  },
  securitySettings: {
    lastPasswordChange: {
      type: Date,
      default: Date.now
    },
    trustedDevices: {
      type: Number,
      default: 1
    }
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    defaultAccount: {
      type: String,
      default: 'checking'
    },
    statementDelivery: {
      type: String,
      default: 'electronic'
    }
  },
  notificationSettings: {
    balanceAlerts: {
      type: Boolean,
      default: true
    },
    transactionAlerts: {
      type: Boolean,
      default: true
    },
    securityAlerts: {
      type: Boolean,
      default: true
    },
    channels: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: false
      }
    }
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Profile', ProfileSchema);