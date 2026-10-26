const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      default: 'Ranchi',
    },
    address: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    admin: {
      type: String,
      default: '—',
    },
    adminEmail: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Planned', 'Inactive'],
      default: 'Active',
    },
    orders: {
      type: Number,
      default: 0,
    },
    pickupEnabled: {
      type: Boolean,
      default: true,
    },
    deliveryEnabled: {
      type: Boolean,
      default: true,
    },
    timings: {
      type: String,
      default: '08:00 AM - 08:00 PM',
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
    emergencyNotice: {
      type: String,
      default: '',
    },
    riderPayoutSettings: {
      baseDeliveryPay: {
        type: Number,
        default: 65,
        min: 0,
      },
      distanceIncentive: {
        type: Number,
        default: 15,
        min: 0,
      },
      peakHourSurge: {
        type: Number,
        default: 20,
        min: 0,
      },
    },
    // Store Admin Managed Customer Fees & Operational Controls
    freeDeliveryThreshold: {
      type: Number,
      default: 399,
      min: 0,
    },
    standardDeliveryFee: {
      type: Number,
      default: 40,
      min: 0,
    },
    expressDeliveryFee: {
      type: Number,
      default: 50,
      min: 0,
    },
    expressDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
    rainSurgeEnabled: {
      type: Boolean,
      default: false,
    },
    rainSurgeFee: {
      type: Number,
      default: 15,
      min: 0,
    },
    freeGiftThreshold: {
      type: Number,
      default: 499,
      min: 0,
    },
    freeGiftName: {
      type: String,
      default: 'Free Biryani Rice (500g)',
    },
    deliveryRadiusKm: {
      type: Number,
      default: 5,
      min: 1,
    },
    defaultRiderDailyTarget: {
      type: Number,
      default: 16,
      min: 1,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [85.3096, 23.3441], // default Ranchi coords
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.storeId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

storeSchema.index({ location: '2dsphere' });

const Store = mongoose.model('Store', storeSchema);
module.exports = Store;
