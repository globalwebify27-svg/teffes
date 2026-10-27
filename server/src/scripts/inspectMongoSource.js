/**
 * Strictly Read-Only MongoDB Source Inspection Utility for Phase 8
 * Does NOT modify, create, update, or delete any data in MongoDB Atlas.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const models = [
  { name: 'Banner', model: require('../models/Banner') },
  { name: 'Category', model: require('../models/Category') },
  { name: 'Coupon', model: require('../models/Coupon') },
  { name: 'CrossSellItem', model: require('../models/CrossSellItem') },
  { name: 'DeliverySlot', model: require('../models/DeliverySlot') },
  { name: 'Inventory', model: require('../models/Inventory') },
  { name: 'InventoryHistory', model: require('../models/InventoryHistory') },
  { name: 'NotificationToken', model: require('../models/NotificationToken') },
  { name: 'Order', model: require('../models/Order') },
  { name: 'OTP', model: require('../models/OTP') },
  { name: 'Product', model: require('../models/Product') },
  { name: 'Remittance', model: require('../models/Remittance') },
  { name: 'ReturnRequest', model: require('../models/ReturnRequest') },
  { name: 'Review', model: require('../models/Review') },
  { name: 'RiderNotification', model: require('../models/RiderNotification') },
  { name: 'SiteSettings', model: require('../models/SiteSettings') },
  { name: 'SosAlert', model: require('../models/SosAlert') },
  { name: 'Store', model: require('../models/Store') },
  { name: 'StoreTransfer', model: require('../models/StoreTransfer') },
  { name: 'User', model: require('../models/User') },
  { name: 'WalletTransaction', model: require('../models/WalletTransaction') }
];

async function inspect() {
  console.log('--- READ-ONLY INSPECTION OF MONGODB ATLAS ---');
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is not defined in environment.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      readPreference: 'secondaryPreferred' // strictly read preference
    });
    console.log(`Connected to MongoDB host: ${conn.connection.host}`);
    console.log(`Database name: ${conn.connection.name}`);

    const counts = {};
    for (const item of models) {
      try {
        const count = await item.model.countDocuments().exec();
        counts[item.name] = count;
        console.log(`  [${item.name.padEnd(20)}]: ${count} documents`);
      } catch (err) {
        console.warn(`  [${item.name.padEnd(20)}]: Query error - ${err.message}`);
        counts[item.name] = `ERR: ${err.message}`;
      }
    }

    console.log('\n--- COLLECTION SUMMARY ---');
    console.log(JSON.stringify(counts, null, 2));

  } catch (err) {
    console.error(`MongoDB Connection Failed: ${err.message}`);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection cleanly closed.');
  }
}

inspect();
