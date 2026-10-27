/**
 * Deep inspection of MongoDB document structures (sanitizing sensitive PII)
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
  { name: 'Product', model: require('../models/Product') },
  { name: 'ReturnRequest', model: require('../models/ReturnRequest') },
  { name: 'Review', model: require('../models/Review') },
  { name: 'SiteSettings', model: require('../models/SiteSettings') },
  { name: 'Store', model: require('../models/Store') },
  { name: 'User', model: require('../models/User') },
  { name: 'WalletTransaction', model: require('../models/WalletTransaction') }
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (['password', 'token', 'phone', 'email', 'name', 'address', 'fcmToken'].includes(k)) {
      clone[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clone[k] = sanitize(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

async function inspectSample() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });

  for (const item of models) {
    const sample = await item.model.findOne().lean().exec();
    console.log(`\n=== Model: ${item.name} ===`);
    if (sample) {
      console.log('Keys:', Object.keys(sample));
      console.log('Sample (sanitized):', JSON.stringify(sanitize(sample), null, 2));
    } else {
      console.log('No documents found.');
    }
  }

  await mongoose.disconnect();
}

inspectSample();
