const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['shop', 'distributor', 'rider'],
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL — MongoDB auto-deletes after this time
  },
  used: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Lookup index
passwordResetSchema.index({ phone: 1, role: 1, used: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);