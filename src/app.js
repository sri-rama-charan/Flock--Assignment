const express = require('express');
const meterRoutes = require('./routes/meter.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/meters', meterRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const message = status >= 500 ? 'An unexpected internal server error occurred.' : (err.message || 'Error processing request');

  return res.status(status).json({
    error: {
      code,
      message
    }
  });
});

module.exports = app;
