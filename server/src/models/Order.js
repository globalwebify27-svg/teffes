const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    netWeight: { type: String, default: '500g' },
    image: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, default: '' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      address: { type: String, required: true },
      lat: { type: Number, default: 23.3512 },
      lng: { type: Number, default: 85.3154 },
    },
    items: [orderItemSchema],
    itemSummary: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Cutting', 'Ready', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    storeId: {
      type: String,
      default: 'S001',
      index: true,
    },
    storeName: {
      type: String,
      default: 'Kishore Ganj',
    },
    rider: {
      riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      vehicleNumber: { type: String, default: '' },
      lat: { type: Number, default: 23.3441 },
      lng: { type: Number, default: 85.3096 },
    },
    deliveryOtp: {
      type: String,
      default: null,
    },
    riderEarning: {
      type: Number,
      default: 65,
    },
    cashCollected: {
      type: Number,
      default: 0,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliverySlot: {
      type: String,
      default: '90 Mins Express Delivery',
    },
    fulfillmentType: {
      type: String,
      enum: ['delivery', 'pickup'],
      default: 'delivery',
      index: true,
    },
    pickupMode: {
      type: Boolean,
      default: false,
      index: true,
    },
    prepTimeMinutes: {
      type: Number,
      default: 25,
    },
    targetDeliveryTime: {
      type: Date,
      default: null,
    },
    remainingTransitMinutes: {
      type: Number,
      default: null,
    },
    etaStage: {
      type: String,
      enum: ['PREPARING', 'IN_TRANSIT', 'NEAR_DOORSTEP', 'DELIVERED'],
      default: 'PREPARING',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'Cash on Delivery',
    },
    couponCode: {
      type: String,
      default: null,
      index: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    coupon: {
      code: { type: String, default: null },
      discountType: { type: String, default: null },
      discountValue: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },
    returnStatus: {
      type: String,
      enum: ['Not Requested', 'Requested', 'Approved', 'Rejected', 'Completed'],
      default: 'Not Requested',
    },
    returnReason: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    razorpayOrderId: {
      type: String,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret.orderId;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

orderSchema.pre('save', function (next) {
  if (this.items && this.items.length > 0 && !this.itemSummary) {
    this.itemSummary = this.items.map((i) => `${i.name} ×${i.quantity}`).join(', ');
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
