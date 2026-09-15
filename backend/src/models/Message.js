const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['shop', 'distributor', 'rider'],
    required: true
  },
  senderName: {
    type: String,
    default: ''
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  receiverRole: {
    type: String,
    enum: ['shop', 'distributor', 'rider'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);