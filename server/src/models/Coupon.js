const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    discount: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free_delivery'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      default: 50,
    },
    minOrder: {
      type: Number,
      default: 299,
    },
    used: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Paused'],
      default: 'Active',
    },
    validTill: {
      type: String,
      default: '31 Dec 2026',
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

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
