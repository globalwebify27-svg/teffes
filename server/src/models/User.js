const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ─── Identity ────────────────────────────────────────────────────────────
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{7,14}$/, 'Please provide a valid phone number'],
    },
    firebaseUid: {
      type: String,
      default: null,
      index: true,
    },

    // ─── Auth ─────────────────────────────────────────────────────────────────
    password: {
      type: String,
      select: false, // never returned in queries by default
      minlength: [8, 'Password must be at least 8 characters'],
    },

    // ─── Role ─────────────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['customer', 'rider', 'storeadmin', 'superadmin', 'admin'],
      default: 'customer',
    },

    // ─── Status ───────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // ─── Store / Staff / Rider Details ────────────────────────────────────────
    storeId: {
      type: String,
      default: null,
    },
    storeName: {
      type: String,
      default: null,
    },
    vehicleNumber: {
      type: String,
      default: null,
    },
    riderStatus: {
      type: String,
      enum: ['Available', 'On Delivery', 'Offline'],
      default: 'Available',
    },

    // ─── Addresses (Customer) ─────────────────────────────────────────────────
    addresses: [
      {
        tag: { type: String, default: 'Home' },
        line1: String,
        line2: String,
        city: { type: String, default: 'Ranchi' },
        pincode: String,
        landmark: String,
        isDefault: { type: Boolean, default: false },
      },
    ],

    // ─── Persistent Cart (Customer) ───────────────────────────────────────────
    cart: [
      {
        product: {
          id: String,
          name: String,
          price: Number,
          originalPrice: Number,
          image: String,
          netWeight: String,
          category: String,
          categoryLabel: String,
          cutType: String,
          inStock: { type: Boolean, default: true },
        },
        quantity: { type: Number, default: 1, min: 1 },
        selectedWeight: { type: String, default: '500g' },
      },
    ],

    // ─── Persistent Wishlist (Customer) ───────────────────────────────────────
    wishlist: [{ type: String }],

    // ─── Refresh Token (hashed) ───────────────────────────────────────────────
    refreshToken: {
      type: String,
      select: false,
    },

    // ─── Profile ──────────────────────────────────────────────────────────────
    avatar: {
      type: String,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    loyaltyTier: {
      type: String,
      enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      default: 'Bronze',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

// ─── Hooks ────────────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Methods ──────────────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.compareRefreshToken = async function (token) {
  if (!this.refreshToken) return false;
  return bcrypt.compare(token, this.refreshToken);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
