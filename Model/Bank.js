// models/Bank.js
const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  routingNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{9}$/.test(v);
      },
      message: props => `${props.value} is not a valid routing number!`
    }
  },
  swiftCode: {
    type: String,
    sparse: true
  },
  location: {
    type: String,
    enum: ['USA', 'International'],
    default: 'USA'
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Bank = mongoose.model('Bank', bankSchema);

module.exports = Bank;