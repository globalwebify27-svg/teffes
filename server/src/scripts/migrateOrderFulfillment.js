require('dotenv').config();
const { connectDB } = require('../config/db');
const Order = require('../models/Order');
const mongoose = require('mongoose');

async function runMigration() {
  try {
    console.log('🔄 Connecting to MongoDB for order fulfillment migration...');
    await connectDB();

    const orders = await Order.find({});
    console.log(`📊 Found ${orders.length} total orders in database.`);

    let pickupCount = 0;
    let deliveryCount = 0;

    for (const order of orders) {
      const isPickup =
        order.pickupMode === true ||
        order.fulfillmentType === 'pickup' ||
        (order.deliverySlot && order.deliverySlot.toLowerCase().includes('pickup')) ||
        (order.customer && order.customer.address && order.customer.address.toLowerCase().includes('store pickup')) ||
        (order.paymentMethod && order.paymentMethod.toLowerCase().includes('store counter'));

      const fulfillmentType = isPickup ? 'pickup' : 'delivery';
      const pickupMode = isPickup;

      const updateFields = {
        fulfillmentType,
        pickupMode,
      };

      if (isPickup) {
        if (!order.customer.address || order.customer.address === 'Store Pickup' || !order.customer.address.includes('Kishore Ganj')) {
          updateFields['customer.address'] = '🏪 Store Pickup: Kishore Ganj Hub, Harmu Road, Ranchi (Takeaway Counter)';
        }
        if (!order.deliverySlot || !order.deliverySlot.includes('Pickup')) {
          updateFields['deliverySlot'] = 'Store Pickup (Counter Takeaway)';
        }
        pickupCount++;
      } else {
        deliveryCount++;
      }

      await Order.updateOne({ _id: order._id }, { $set: updateFields });
      console.log(`  -> Order #${order.orderId}: marked as [${fulfillmentType.toUpperCase()}]`);
    }

    console.log('----------------------------------------------------');
    console.log(`✅ Migration complete!`);
    console.log(`   - 🏪 Store Pickup orders: ${pickupCount}`);
    console.log(`   - 🛵 Home Delivery orders: ${deliveryCount}`);
    console.log(`   - Total migrated: ${orders.length}`);
    console.log('----------------------------------------------------');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
