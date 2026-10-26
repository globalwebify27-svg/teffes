const mongoose = require('mongoose');

const remittanceSchema = new mongoose.Schema(
  {
    remittanceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    riderName: {
      type: String,
      required: true,
    },
    riderPhone: {
      type: String,
      required: true,
    },
    storeId: {
      type: String,
      default: 'S001',
      index: true,
    },
    storeName: {
      type: String,
      default: "TeFFe's Dark Store Hub",
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Remittance amount must be greater than zero'],
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    notes: {
      type: String,
      default: 'End of shift cash deposit at hub closing counter',
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmedByName: {
      type: String,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Remittance = mongoose.model('Remittance', remittanceSchema);

module.exports = Remittance;
