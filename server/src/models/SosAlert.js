const mongoose = require('mongoose');

const sosAlertSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    riderName: {
      type: String,
      required: true,
    },
    riderPhone: {
      type: String,
      required: true,
    },
    storeId: {
      type: String,
      default: 'S001',
      index: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    activeOrderId: {
      type: String,
      default: null,
    },
    reason: {
      type: String,
      default: 'Emergency Assistance Triggered by Rider',
    },
    status: {
      type: String,
      enum: ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'TRIGGERED',
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const SosAlert = mongoose.model('SosAlert', sosAlertSchema);

module.exports = SosAlert;
