const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
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
    hindiName: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    categoryLabel: {
      type: String,
      default: 'Fresh Meat',
    },
    description: {
      type: String,
      default: '',
    },
    pieces: {
      type: String,
      default: '',
    },
    serves: {
      type: String,
      default: '',
    },
    badge: {
      type: String,
      default: '',
    },
    isBestseller: {
      type: Boolean,
      default: false,
      index: true,
    },
    image: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },
    netWeight: {
      type: String,
      required: true,
      default: '500g',
    },
    grossWeight: {
      type: String,
      default: '',
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
    rating: {
      type: Number,
      default: 4.8,
    },
    ratingCount: {
      type: Number,
      default: 100,
    },
    inStock: {
      type: Boolean,
      default: true,
      index: true,
    },
    cutType: {
      type: String,
      default: '',
    },
    cookingTime: {
      type: String,
      default: '',
    },
    benefits: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.index({ name: 'text', description: 'text', hindiName: 'text' });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
