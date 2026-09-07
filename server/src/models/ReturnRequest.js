const mongoose = require('mongoose');

const returnRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    customer: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: '',
    },
    items: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      default: 'Reported within 60 mins guarantee',
    },
    status: {
      type: String,
      enum: ['Pending Review', 'Approved', 'Exchange Dispatched', 'Completed', 'Rejected'],
      default: 'Pending Review',
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
        ret.id = ret.requestId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
module.exports = ReturnRequest;
