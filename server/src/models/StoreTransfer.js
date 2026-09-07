const mongoose = require('mongoose');

const storeTransferSchema = new mongoose.Schema(
  {
    fromStoreId: {
      type: String,
      required: true,
    },
    toStoreId: {
      type: String,
      required: true,
    },
    items: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      }
    ],
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
      default: 'Pending',
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const StoreTransfer = mongoose.model('StoreTransfer', storeTransferSchema);

module.exports = StoreTransfer;
