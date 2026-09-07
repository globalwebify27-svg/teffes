const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    item: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    min: {
      type: Number,
      required: true,
      default: 10,
    },
    unit: {
      type: String,
      default: 'kg',
    },
    status: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'In Stock',
    },
    lastRestocked: {
      type: String,
      default: 'Today 6:00 AM',
    },
    storeId: {
      type: String,
      default: 'S001',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.itemId || ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

inventorySchema.pre('save', function (next) {
  if (this.stock <= 0) {
    this.status = 'Out of Stock';
  } else if (this.stock <= this.min) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
