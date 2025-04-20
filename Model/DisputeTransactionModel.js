const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AttachmentSchema = new Schema({
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const StatusUpdateSchema = new Schema({
  status: {
    type: String,
    required: true,
    enum: ['Created', 'Under Review', 'Pending Additional Information', 'Temporary Credit Issued', 'Resolved in User Favor', 'Resolved in Merchant Favor', 'Closed', 'Card Blocked']
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    required: true
  }
});

const FraudDetailsSchema = new Schema({
  cardInPossession: {
    type: Boolean,
    default: true
  },
  lastValidTransaction: {
    type: Date
  },
  suspectMerchant: {
    type: String
  },
  additionalSuspiciousActivity: {
    type: String
  },
  recognizeAnyTransactions: {
    type: Boolean,
    default: false
  }
});

const DisputeTransactionSchema = new Schema({
  disputeNumber: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  transactionDate: {
    type: Date,
    required: true
  },
  transactionDescription: {
    type: String,
    required: true
  },
  transactionAmount: {
    type: Number,
    required: true
  },
  cardLast4: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['unauthorized', 'duplicate', 'wrong-amount', 'product-not-received', 'defective', 'cancelled', 'refund-not-received', 'other']
  },
  subReason: {
    type: String
  },
  description: {
    type: String
  },
  contactMethod: {
    type: String,
    required: true,
    enum: ['email', 'phone', 'mail']
  },
  contactDetails: {
    email: String,
    phone: String,
    address: String
  },
  temporaryCreditRequested: {
    type: Boolean,
    default: false
  },
  temporaryCreditIssued: {
    type: Boolean,
    default: false
  },
  temporaryCreditAmount: {
    type: Number
  },
  temporaryCreditDate: {
    type: Date
  },
  isFraud: {
    type: Boolean,
    default: false
  },
  fraudDetails: FraudDetailsSchema,
  cardStatus: {
    type: String,
    enum: ['keep', 'block'],
    default: 'keep'
  },
  cardBlocked: {
    type: Boolean,
    default: false
  },
  cardBlockedDate: {
    type: Date
  },
  attachments: [AttachmentSchema],
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Under Review', 'Awaiting Information', 'Resolved', 'Denied', 'Cancelled'],
    default: 'Pending'
  },
  statusHistory: [StatusUpdateSchema],
  expectedResolutionDate: {
    type: Date,
    required: true
  },
  resolutionDate: {
    type: Date
  },
  resolutionOutcome: {
    type: String,
    enum: ['In User Favor', 'In Merchant Favor', 'Split Decision', 'Cancelled', null]
  },
  resolutionNotes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate a unique dispute number before saving
DisputeTransactionSchema.pre('save', async function(next) {
  if (!this.isNew) {
    return next();
  }
  
  // Format: DIS-YYYYMMDD-XXXX (Year, Month, Day, Random 4 digits)
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
                  (date.getMonth() + 1).toString().padStart(2, '0') +
                  date.getDate().toString().padStart(2, '0');
  
  const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  this.disputeNumber = `DIS-${dateStr}-${randomNum}`;
  
  // Set expected resolution date to 10 business days from now
  const expectedResolution = new Date();
  expectedResolution.setDate(expectedResolution.getDate() + 10);
  this.expectedResolutionDate = expectedResolution;
  
  // Add initial status update
  this.statusHistory.push({
    status: 'Created',
    description: 'Dispute has been successfully submitted.',
    date: new Date(),
    updatedBy: 'System'
  });
  
  next();
});

// Update the updatedAt field on save
DisputeTransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('DisputeTransaction', DisputeTransactionSchema);