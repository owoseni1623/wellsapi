const mongoose = require('mongoose');

const alertSettingSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  threshold: {
    type: Number,
    default: 0
  },
  notificationMethod: {
    type: [String],
    enum: ['email', 'text', 'push'],
    default: ['email']
  },
  daysBeforeDue: {
    type: Number,
    default: 3
  }
});

const AccountAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balanceAlerts: {
    enabled: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 500
    },
    notificationMethod: {
      type: [String],
      enum: ['email', 'text', 'push'],
      default: ['email', 'push']
    }
  },
  transactionAlerts: {
    largeDebits: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 200
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email', 'push', 'text']
      }
    },
    largeCredits: {
      enabled: {
        type: Boolean,
        default: false
      },
      threshold: {
        type: Number,
        default: 1000
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email']
      }
    },
    atmWithdrawals: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 0
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['push', 'text']
      }
    },
    internationalTransactions: {
      enabled: {
        type: Boolean,
        default: true
      },
      threshold: {
        type: Number,
        default: 0
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email', 'push', 'text']
      }
    }
  },
  securityAlerts: {
    loginAttempts: {
      enabled: {
        type: Boolean,
        default: true
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email', 'push', 'text']
      }
    },
    passwordChanges: {
      enabled: {
        type: Boolean,
        default: true
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email', 'text']
      }
    },
    profileUpdates: {
      enabled: {
        type: Boolean,
        default: true
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email']
      }
    }
  },
  statementAlerts: {
    statementAvailable: {
      enabled: {
        type: Boolean,
        default: true
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email']
      }
    },
    paymentReminders: {
      enabled: {
        type: Boolean,
        default: true
      },
      daysBeforeDue: {
        type: Number,
        default: 3
      },
      notificationMethod: {
        type: [String],
        enum: ['email', 'text', 'push'],
        default: ['email', 'push']
      }
    }
  },
  contactInfo: {
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    pushEnabled: {
      type: Boolean,
      default: true
    }
  }
}, { timestamps: true });

// Static method to create default alerts for a new user
AccountAlertSchema.statics.createDefaultForUser = async function(userId, email, phone) {
  const defaultAlerts = new this({
    userId,
    contactInfo: {
      email,
      phone,
      pushEnabled: true
    }
  });
  
  return await defaultAlerts.save();
};

const AccountAlert = mongoose.model('AccountAlert', AccountAlertSchema);

module.exports = AccountAlert;