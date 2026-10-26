const express = require('express');
const meterRoutes = require('./routes/meter.routes');

const app = express();

// Parse JSON request payloads
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Meter management routes
app.use('/api/v1/meters', meterRoutes);

module.exports = app;
