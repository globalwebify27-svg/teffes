/**
 * Teffe's MongoDB Atlas Seeding Script
 * Seeds categories, products, stores, orders, inventory, slots, coupons, and 4 user roles.
 * Run: node server/src/scripts/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Store = require('../models/Store');
const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const DeliverySlot = require('../models/DeliverySlot');
const ReturnRequest = require('../models/ReturnRequest');
const Coupon = require('../models/Coupon');

const seedData = require('./seedData');

const seed = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log(' Connected to MongoDB Atlas\n');

    // 1. Seed Categories
    console.log(' Seeding Categories...');
    for (const cat of seedData.categories) {
      await Category.findOneAndUpdate({ slug: cat.slug }, cat, { upsert: true, new: true });
    }
    console.log(` Category seed complete (${seedData.categories.length} categories)`);

    // 2. Seed Products
    console.log(' Seeding Products...');
    for (const prod of seedData.products) {
      await Product.findOneAndUpdate({ id: prod.id }, prod, { upsert: true, new: true });
    }
    console.log(` Product seed complete (${seedData.products.length} products)`);

    // 3. Seed Users (4 roles: superadmin, storeadmin, rider, customer)
    console.log(' Seeding Users (4 Roles)...');
    for (const u of seedData.users) {
      const existing = await User.findOne({
        $or: [
          ...(u.email ? [{ email: u.email }] : []),
          ...(u.phone ? [{ phone: u.phone }] : []),
        ],
      });
      if (!existing) {
        await User.create(u);
        console.log(`  + Created user ${u.role}: ${u.email} (Password: ${u.password})`);
      } else {
        // Update user fields
        existing.email = u.email;
        existing.role = u.role;
        existing.phone = u.phone;
        existing.name = u.name;
        if (u.storeId) existing.storeId = u.storeId;
        if (u.storeName) existing.storeName = u.storeName;
        if (u.vehicleNumber) existing.vehicleNumber = u.vehicleNumber;
        if (u.addresses) existing.addresses = u.addresses;
        existing.password = u.password; // pre-save hook will hash it
        await existing.save();
        console.log(`  ~ Updated user ${u.role}: ${u.email}`);
      }
    }

    // 4. Seed Stores
    console.log(' Seeding Stores...');
    for (const s of seedData.stores) {
      await Store.findOneAndUpdate({ storeId: s.storeId }, s, { upsert: true, new: true });
    }
    console.log(` Store seed complete (${seedData.stores.length} stores)`);

    // 5. Seed Orders
    console.log(' Seeding Orders...');
    for (const o of seedData.orders) {
      await Order.findOneAndUpdate({ orderId: o.orderId }, o, { upsert: true, new: true });
    }
    console.log(` Order seed complete (${seedData.orders.length} orders)`);

    // 6. Seed Inventory
    console.log(' Seeding Inventory...');
    for (const inv of seedData.inventory) {
      await Inventory.findOneAndUpdate({ itemId: inv.itemId }, inv, { upsert: true, new: true });
    }
    console.log(` Inventory seed complete (${seedData.inventory.length} items)`);

    // 7. Seed Delivery Slots
    console.log(' Seeding Delivery Slots...');
    for (const slot of seedData.deliverySlots) {
      await DeliverySlot.findOneAndUpdate({ slot: slot.slot }, slot, { upsert: true, new: true });
    }
    console.log(` Delivery slots seed complete (${seedData.deliverySlots.length} slots)`);

    // 8. Seed Return Requests
    console.log(' Seeding Return Requests...');
    for (const ret of seedData.returnRequests) {
      await ReturnRequest.findOneAndUpdate({ requestId: ret.requestId }, ret, { upsert: true, new: true });
    }
    console.log(` Return requests seed complete (${seedData.returnRequests.length} requests)`);

    // 9. Seed Coupons
    console.log(' Seeding Coupons...');
    for (const c of seedData.coupons) {
      await Coupon.findOneAndUpdate({ code: c.code }, c, { upsert: true, new: true });
    }
    console.log(` Coupon seed complete (${seedData.coupons.length} coupons)`);

    console.log('\n MongoDB Atlas Seeding Finished Successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔑 TEST ACCOUNTS:');
    console.log('1. Super Admin: superadmin@teffes.com  /  Super@12345');
    console.log('2. Store Admin: storeadmin@teffes.com  /  Store@12345');
    console.log('3. Rider:       rider@teffes.com       /  Rider@12345');
    console.log('4. Customer:    customer@teffes.com    /  Customer@12345');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas');
  }
};

seed();
