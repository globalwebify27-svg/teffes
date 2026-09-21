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
    // Display description (e.g. "20% instant discount on orders above ₹399")
    description: {
      type: String,
      default: '',
    },
    // Legacy display text for backward compatibility
    discount: {
      type: String,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free_delivery'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Legacy field alias for minOrderAmount
    minOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validTill: {
      type: Date,
      required: true,
      default: () => new Date('2026-12-31T23:59:59.999Z'),
    },
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      default: null,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Legacy alias for usageCount
    used: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Paused'],
      default: 'Active',
      index: true,
    },
    isSuperOffer: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        // Keep both field names in JSON response for full client compatibility
        ret.minOrder = ret.minOrderAmount || ret.minOrder || 0;
        ret.minOrderAmount = ret.minOrderAmount || ret.minOrder || 0;
        ret.used = ret.usageCount || ret.used || 0;
        ret.usageCount = ret.usageCount || ret.used || 0;
        ret.discount = ret.description || ret.discount || '';
        ret.description = ret.description || ret.discount || '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to synchronize legacy fields and ensure consistent status
couponSchema.pre('save', function (next) {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (this.minOrderAmount !== undefined && (this.minOrder === undefined || this.minOrder === 0)) {
    this.minOrder = this.minOrderAmount;
  } else if (this.minOrder !== undefined && (this.minOrderAmount === undefined || this.minOrderAmount === 0)) {
    this.minOrderAmount = this.minOrder;
  }
  if (this.usageCount !== undefined) {
    this.used = this.usageCount;
  } else if (this.used !== undefined) {
    this.usageCount = this.used;
  }
  if (this.description && !this.discount) {
    this.discount = this.description;
  } else if (this.discount && !this.description) {
    this.description = this.discount;
  }
  if (this.isActive === false && this.status === 'Active') {
    this.status = 'Paused';
  } else if (this.isActive === true && this.status === 'Paused') {
    this.status = 'Active';
  }
  next();
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
