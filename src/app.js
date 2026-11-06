const express = require('express');
const path = require('path');
const cors = require('cors');

const lessonRoutes          = require('./routes/lessonRoutes');
const researchRoutes        = require('./routes/researchRoutes');
const agentRoutes           = require('./routes/agentRoutes');
const lessonGeneratorRoutes = require('./routes/lessonGeneratorRoutes');
const qcRoutes              = require('./routes/qcRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI Lesson Creation Tool API'
  });
});

// API Routes
app.use('/api/lessons',   lessonRoutes);
app.use('/api/research',  researchRoutes);
app.use('/api/agent',     agentRoutes);
app.use('/api/generate',  lessonGeneratorRoutes);
app.use('/api/qc',        qcRoutes);

// Fallback to index.html for root if needed (though express.static serves index.html by default)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Not Found Middleware
app.use(notFoundHandler);

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
