const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  ownerName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { type: String, required: true },
  address: {
    street: String,
    city: String,
    state: String,
    landmark: String,
    lat: Number,
    lng: Number
  },
  preferredDistributors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor'
  }],
  orderHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  creditBalance: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Shop', shopSchema);