const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    console.log('ℹ️  MongoDB disabled. TeFFe runs 100% purely on Google Cloud Firestore.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
    });

    isConnected = true;
    console.log(`✅ MongoDB optional replica connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️  MongoDB connection skipped (${error.message}). TeFFe operates 100% on Cloud Firestore.`);
  }
};

mongoose.connection.on('disconnected', () => {
  isConnected = false;
});

module.exports = { connectDB };
