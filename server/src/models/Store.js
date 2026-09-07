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
