const mongoose = require('mongoose');

const crossSellItemSchema = new mongoose.Schema(
  {
    id: {
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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    weight: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'Essentials',
      trim: true,
    },
    inStock: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    storeId: {
      type: String,
      default: 'all',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

const CrossSellItem = mongoose.model('CrossSellItem', crossSellItemSchema);
module.exports = CrossSellItem;
