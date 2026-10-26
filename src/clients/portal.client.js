const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const env = require('../config/env');

const SESSION_COOKIE_NAME = 'auth.session_token';

// Persistent cookie jar retains session tokens across requests
const jar = new CookieJar();
const client = wrapper(
  axios.create({
    jar,
    baseURL: env.portalBaseUrl,
    timeout: 10000,
    headers: {
      'User-Agent': 'FlockEnergy-API-Client/1.0',
      'Accept': 'application/json, text/plain, */*',
      // SvelteKit CSRF protection requires matching Origin for form POST submissions
      'Origin': env.portalBaseUrl,
      'Referer': `${env.portalBaseUrl}/login`
    }
  })
);

/**
 * Check if the cookie jar contains an active session token.
 * Matches '__Secure-better-auth.session_token' (HTTPS) or 'auth.session_token'.
 */
async function hasValidSession() {
  try {
    const cookies = await jar.getCookies(env.portalBaseUrl);
    return cookies.some(
      (cookie) => cookie.key.includes('session_token') && Boolean(cookie.value)
    );
  } catch {
    return false;
  }
}

/**
 * Authenticate with the Urja portal using credentials from environment config.
 * Clears old cookies before authenticating so stale tokens are never reused.
 */
async function login() {
  if (!env.portalUsername || !env.portalPassword) {
    throw new Error(
      'Portal credentials missing: PORTAL_USERNAME and PORTAL_PASSWORD must be configured in .env.'
    );
  }

  // Remove existing cookies so a failed login cannot falsely reuse an old session
  await jar.removeAllCookies();

  // Payload matches the observed form on /login: email and password, url-encoded
  const payload = new URLSearchParams({
    email: env.portalUsername,
    password: env.portalPassword
  });

  try {
    const response = await client.post('/login', payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Check if the portal returned an application-level failure payload
    if (response.data && response.data.type === 'failure') {
      throw new Error('Urja Ops portal rejected credentials.');
    }

    const sessionActive = await hasValidSession();
    if (!sessionActive) {
      throw new Error(
        'Urja Ops portal login succeeded but no session token (auth.session_token) was set.'
      );
    }

    return true;
  } catch (error) {
    // Clean up partial cookies on failure
    await jar.removeAllCookies();
    throw formatError(error);
  }
}

/**
 * Ensure an active session exists before executing portal requests.
 */
async function ensureAuthenticated() {
  const sessionActive = await hasValidSession();
  if (!sessionActive) {
    await login();
  }
}

/**
 * Execute an authenticated GET request against the Urja portal.
 * If the session has expired (HTTP 401/403), reauthenticates and retries once.
 */
async function get(endpoint, options = {}) {
  await ensureAuthenticated();

  try {
    const response = await client.get(endpoint, options);
    return response.data;
  } catch (error) {
    // If unauthorized and this is not already a retry, re-login and retry once
    if (isAuthError(error) && !options._isRetry) {
      await login();

      try {
        const retryResponse = await client.get(endpoint, {
          ...options,
          _isRetry: true
        });
        return retryResponse.data;
      } catch (retryError) {
        throw formatError(retryError);
      }
    }

    throw formatError(error);
  }
}

/**
 * Identify authentication errors (HTTP 401 or 403).
 */
function isAuthError(error) {
  const status = error && error.response ? error.response.status : null;
  return status === 401 || status === 403;
}

/**
 * Format network and HTTP errors safely without exposing credentials or cookies.
 */
function formatError(error) {
  if (!error) {
    return new Error('Urja Ops portal communication error.');
  }

  if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
    return new Error('Urja Ops portal request timed out. Please try again.');
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return new Error(
      'Unable to connect to the Urja Ops portal. Please check network and PORTAL_BASE_URL.'
    );
  }

  if (error.response) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return new Error(`Urja Ops portal authentication failed (HTTP ${status}).`);
    }
    if (status >= 500) {
      return new Error(`Urja Ops portal server error (HTTP ${status}).`);
    }
    return new Error(`Urja Ops portal request failed with status ${status}.`);
  }

  return new Error(error.message || 'Urja Ops portal request failed.');
}

module.exports = {
  login,
  ensureAuthenticated,
  get
};
