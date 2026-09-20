const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  distributorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor'
  },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider'
  },
  items: [{
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  deliveryAddress: {
    shopName: String,
    address: String,
    city: String,
    state: String,
    landmark: String,
    lat: Number,
    lng: Number
  },
  pickupAddress: {
    distributorName: String,
    address: String,
    city: String,
    state: String,
    landmark: String,
    lat: Number,
    lng: Number,
    phone: String
  },
  paymentMethod: {
    type: String,
    enum: ['cash_on_delivery', 'transfer', 'wallet'],
    default: 'cash_on_delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  // ✅ Rating fields
  distributorRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  distributorReview: {
    type: String,
    default: ''
  },
  riderRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  riderReview: {
    type: String,
    default: ''
  },
  isRated: {
    type: Boolean,
    default: false
  },  // ← ✅ THE COMMA IS ADDED HERE
  trackingUpdates: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  // ✅ Delivery PIN Fields
  deliveryPIN: {
    type: String,
    default: null
  },
  deliveryProof: {
    type: String,
    enum: ['pending', 'pin_verified', 'photo_uploaded', 'confirmed'],
    default: 'pending'
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  cancelReason: {
    type: String,
    default: ''
  },
  // ✅ Payout tracking (admin → distributor)
  paidToDistributorAt: {
    type: Date,
    default: null,
  },
  paidToDistributorAmount: {
    type: Number,
    default: 0,
  },
  paidToDistributorNote: {
    type: String,
    default: '',
  },
  cancelledBy: {
    type: String,
    enum: ['shop', 'distributor', 'admin', null],
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);