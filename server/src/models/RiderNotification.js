const mongoose = require('mongoose');

const riderNotificationSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['ORDER_ASSIGNMENT', 'DELIVERY_PAYOUT', 'HUB_ALERT', 'SAFETY_REMINDER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const RiderNotification = mongoose.model('RiderNotification', riderNotificationSchema);

module.exports = RiderNotification;
