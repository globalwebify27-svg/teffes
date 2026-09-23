const mongoose = require('mongoose');

const notificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android',
    },
    appType: {
      type: String,
      enum: ['customer', 'rider', 'website'],
      default: 'customer',
      index: true,
    },
    deviceInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active tokens for a specific user and app
notificationTokenSchema.index({ userId: 1, appType: 1, isActive: 1 });

const NotificationToken = mongoose.model('NotificationToken', notificationTokenSchema);

module.exports = NotificationToken;
