const mongoose = require('mongoose');

const inventoryHistorySchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      index: true,
    },
    itemId: {
      type: String,
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: '',
    },
    classification: {
      type: String,
      enum: ['fresh', 'defreeze', 'waste', 'transfer'],
      required: true,
    },
    actionType: {
      type: String,
      enum: [
        'add_stock',
        'reduce_stock',
        'set_stock',
        'transfer_defreeze_to_fresh',
        'record_waste',
        'order_deduction',
        'order_restock',
      ],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      default: 'kg',
    },
    previousQuantity: {
      type: Number,
      default: null,
    },
    resultingQuantity: {
      type: Number,
      default: null,
    },
    sourceClassification: {
      type: String,
      enum: ['fresh', 'defreeze', null],
      default: null,
    },
    destinationClassification: {
      type: String,
      enum: ['fresh', 'defreeze', 'waste', null],
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, default: 'System' },
      role: { type: String, default: 'system' },
      email: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

inventoryHistorySchema.index({ storeId: 1, createdAt: -1 });
inventoryHistorySchema.index({ storeId: 1, itemId: 1, createdAt: -1 });

const InventoryHistory = mongoose.model('InventoryHistory', inventoryHistorySchema);
module.exports = InventoryHistory;
