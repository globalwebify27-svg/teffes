const mongoose = require('mongoose');

const deliverySlotSchema = new mongoose.Schema(
  {
    slot: {
      type: String,
      required: true,
      trim: true,
    },
    capacity: {
      type: Number,
      required: true,
      default: 30,
    },
    booked: {
      type: Number,
      required: true,
      default: 0,
    },
    riders: {
      type: Number,
      default: 3,
    },
    status: {
      type: String,
      enum: ['Open', 'Filling Fast', 'Almost Full', 'Closed'],
      default: 'Open',
    },
    storeId: {
      type: String,
      default: 'S001',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const DeliverySlot = mongoose.model('DeliverySlot', deliverySlotSchema);
module.exports = DeliverySlot;
