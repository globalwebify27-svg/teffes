const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { products: allProducts } = require('./seedData.js');

async function seedDatabase() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const Product = require('../models/Product.js');

  const beforeCount = await Product.countDocuments();
  console.log(`Current products in DB before replace: ${beforeCount}`);

  console.log('Deleting all existing products...');
  await Product.deleteMany({});

  console.log(`Inserting ${allProducts.length} real Teffe's products...`);
  await Product.insertMany(allProducts);

  const afterCount = await Product.countDocuments();
  console.log(`Success! Total products in DB after replace: ${afterCount}`);

  const chickenCount = await Product.countDocuments({ category: 'chicken' });
  const muttonCount = await Product.countDocuments({ category: 'mutton' });
  const fishCount = await Product.countDocuments({ category: 'fish' });
  const eggsCount = await Product.countDocuments({ category: 'eggs' });

  console.log({
    chicken: chickenCount,
    mutton: muttonCount,
    fish: fishCount,
    eggs: eggsCount
  });

  await mongoose.disconnect();
  console.log('Done!');
}

seedDatabase().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
