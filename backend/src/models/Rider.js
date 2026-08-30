const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
  vehicleType: {
    type: String,
    enum: ['bicycle', 'motorcycle', 'tricycle', 'car', 'van'],
    default: 'motorcycle'
  },
  vehiclePlate: { type: String },
  // NEW: Rider's current location (updated via dashboard)
  currentLocation: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    city: { type: String, default: '' },
    state: { type: String, default: '' }
  },
  // NEW: Service area (where they operate)
  serviceArea: {
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    radius: { type: Number, default: 10 } // km radius they serve
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'available'
  },
  deliveries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  totalDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rider', riderSchema);