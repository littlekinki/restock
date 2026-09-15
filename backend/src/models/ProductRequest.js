const mongoose = require('mongoose');

const productRequestSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    default: 'Other'
  },
  quantity: {
    type: Number,
    default: 1
  },
  unit: {
    type: String,
    enum: ['piece', 'kg', 'g', 'carton', 'pack', 'litre', 'ml'],
    default: 'carton'
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'sourcing', 'found', 'unavailable', 'fulfilled'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProductRequest', productRequestSchema);