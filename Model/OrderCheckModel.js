const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AddressSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Address name is required']
  },
  street: {
    type: String,
    required: [true, 'Street address is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  zip: {
    type: String,
    required: [true, 'ZIP code is required']
  },
  primary: {
    type: Boolean,
    default: false
  }
});

const CustomizationSchema = new Schema({
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
});

const OrderCheckSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  accountId: {
    type: String,
    required: [true, 'Account ID is required']
  },
  accountName: {
    type: String,
    required: [true, 'Account name is required']
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required']
  },
  checkStyle: {
    type: String,
    required: [true, 'Check style is required'],
    enum: ['standard', 'premium', 'scenic', 'custom']
  },
  quantity: {
    type: String,
    required: [true, 'Quantity is required'],
    enum: ['1', '2', '4']
  },
  deliveryMethod: {
    type: String,
    required: [true, 'Delivery method is required'],
    enum: ['standard', 'expedited', 'overnight']
  },
  shippingAddress: {
    type: AddressSchema,
    required: [true, 'Shipping address is required']
  },
  customization: {
    type: CustomizationSchema,
    default: {}
  },
  specialInstructions: {
    type: String,
    default: ''
  },
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required']
  },
  tax: {
    type: Number,
    required: [true, 'Tax is required']
  },
  shippingCost: {
    type: Number,
    required: [true, 'Shipping cost is required']
  },
  total: {
    type: Number,
    required: [true, 'Total cost is required']
  },
  status: {
    type: String,
    enum: ['processing', 'shipped', 'delivered', 'cancelled'],
    default: 'processing'
  },
  estimatedDeliveryDate: {
    type: Date,
    required: [true, 'Estimated delivery date is required']
  },
  trackingNumber: {
    type: String
  },
  customPhoto: {
    type: String // URL or path to the uploaded image for custom checks
  }
}, { timestamps: true });

// Generate a unique order number
OrderCheckSchema.pre('save', async function(next) {
  if (!this.isNew) {
    return next();
  }
  
  try {
    const timestamp = new Date().getTime().toString().slice(-8);
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `WF${timestamp}${randomDigits}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('OrderCheck', OrderCheckSchema);