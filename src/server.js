const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Flock Energy API running on port ${env.port}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason && reason.message ? reason.message : reason);
});

module.exports = server;
