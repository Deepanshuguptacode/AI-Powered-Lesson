require('dotenv').config();

const app = require('./app');
const { connectDB, disconnectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

/**
 * Start the HTTP server after connecting to MongoDB
 */
const startServer = async () => {
  try {
    // Attempt database connection
    await connectDB();
  } catch (err) {
    console.error('[Server Warning] Continuing server startup without active MongoDB connection...');
  }

  const server = app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 AI Lesson Creation Tool Server`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
};

// Start server only when executed directly
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
