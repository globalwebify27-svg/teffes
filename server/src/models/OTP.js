const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      max: [5, 'Too many OTP attempts'],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete documents after they expire (TTL index)
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// One active OTP per phone at a time
otpSchema.index({ phone: 1 });

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
