const express = require('express');
const meterRoutes = require('./routes/meter.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/meters', meterRoutes);

module.exports = app;
