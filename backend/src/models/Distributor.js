const mongoose = require('mongoose');

const distributorSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  ownerName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    landmark: String,
    lat: { type: Number, default: 0 },     // ← For finding nearby riders
    lng: { type: Number, default: 0 }      // ← For finding nearby riders
  },
  products: [{
    name: { type: String, required: true },
    category: { type: String },
    price: { type: Number, required: true },
    unit: { type: String, enum: ['kg', 'g', 'carton', 'pack', 'piece', 'litre', 'ml'], default: 'piece' },
    size: { type: String },
    stock: { type: Number, default: 0 }
  }],
  deliveryRadius: { type: Number, default: 10 }, // km radius they deliver to
  deliveryFee: { type: Number, default: 0 },
  minOrder: { type: Number, default: 0 },
  orders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  rating: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Distributor', distributorSchema);