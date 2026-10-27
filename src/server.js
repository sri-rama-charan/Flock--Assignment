const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`Flock Energy API running on port ${env.port}`);
});

module.exports = server;
