const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  recipientRole: {
    type: String,
    enum: ['shop', 'distributor', 'rider', 'admin'],
    required: true,
  },
  type: {
    type: String,
    required: true,
    // Examples: order_placed, order_confirmed, rider_assigned, chat_message, etc.
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    default: '',
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for fast inbox queries
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);