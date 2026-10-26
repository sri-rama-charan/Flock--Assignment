const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

/**
 * Validate and export application configuration.
 * Reads server port, portal base URL, and portal credentials.
 */
function loadConfig() {
  const rawPort = process.env.PORT || '3000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid PORT: "${rawPort}". PORT must be an integer between 1 and 65535.`
    );
  }

  const portalBaseUrl = process.env.PORTAL_BASE_URL || 'https://urja-ops.flockenergy.tech';
  if (!portalBaseUrl || portalBaseUrl.trim() === '') {
    throw new Error(
      'PORTAL_BASE_URL is required. Please set it in your .env file.'
    );
  }

  const portalUsername = process.env.PORTAL_USERNAME || '';
  const portalPassword = process.env.PORTAL_PASSWORD || '';

  return {
    port,
    portalBaseUrl: portalBaseUrl.trim().replace(/\/+$/, ''), // strip trailing slash
    portalUsername: portalUsername.trim(),
    portalPassword,
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}

module.exports = loadConfig();
