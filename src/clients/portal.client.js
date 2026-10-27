const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const env = require('../config/env');

const jar = new CookieJar();
const client = wrapper(
  axios.create({
    jar,
    baseURL: env.portalBaseUrl,
    timeout: 10000,
    headers: {
      'User-Agent': 'FlockEnergy-API-Client/1.0',
      'Accept': 'application/json, text/plain, */*',
      'Origin': env.portalBaseUrl,
      'Referer': `${env.portalBaseUrl}/login`
    }
  })
);

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

async function login() {
  if (!env.portalUsername || !env.portalPassword) {
    throw new Error(
      'Portal credentials missing: PORTAL_USERNAME and PORTAL_PASSWORD must be configured in .env.'
    );
  }

  await jar.removeAllCookies();

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
    await jar.removeAllCookies();
    throw formatError(error);
  }
}

async function ensureAuthenticated() {
  const sessionActive = await hasValidSession();
  if (!sessionActive) {
    await login();
  }
}

async function get(endpoint, options = {}) {
  await ensureAuthenticated();

  try {
    const response = await client.get(endpoint, options);
    return response.data;
  } catch (error) {
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

function isAuthError(error) {
  const status = error && error.response ? error.response.status : null;
  return status === 401 || status === 403;
}

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
