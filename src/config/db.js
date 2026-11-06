const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose
 * Reads MONGODB_URI from environment variables or falls back to local default.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai_lesson_generator';
    
    // Configure Mongoose options
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000 // Keep timeout reasonable for quick failure feedback
    });

    console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    // If not in test environment, we log guidance for the user
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Database Notice] Please verify your MongoDB server is running or check MONGODB_URI in .env');
    }
    throw error;
  }
};

/**
 * Disconnect from MongoDB (useful for tests and graceful shutdown)
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed');
  } catch (error) {
    console.error(`[Database Error] Error during disconnect: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
