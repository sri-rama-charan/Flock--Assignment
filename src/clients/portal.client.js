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
      const authErr = new Error('Urja Ops portal rejected credentials.');
      authErr.status = 502;
      authErr.code = 'UPSTREAM_AUTH_FAILED';
      throw authErr;
    }

    const sessionActive = await hasValidSession();
    if (!sessionActive) {
      const authErr = new Error('Urja Ops portal login succeeded but no session token was set.');
      authErr.status = 502;
      authErr.code = 'UPSTREAM_AUTH_FAILED';
      throw authErr;
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
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      const err = new Error('Received invalid non-JSON response from Urja Ops portal.');
      err.status = 502;
      err.code = 'UPSTREAM_INVALID_RESPONSE';
      throw err;
    }
    return response.data;
  } catch (error) {
    if (isAuthError(error) && !options._isRetry) {
      await login();

      try {
        const retryResponse = await client.get(endpoint, {
          ...options,
          _isRetry: true
        });
        if (typeof retryResponse.data === 'string' && retryResponse.data.trim().startsWith('<')) {
          const err = new Error('Received invalid non-JSON response from Urja Ops portal.');
          err.status = 502;
          err.code = 'UPSTREAM_INVALID_RESPONSE';
          throw err;
        }
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
    const err = new Error('Urja Ops portal communication error.');
    err.status = 502;
    err.code = 'UPSTREAM_ERROR';
    return err;
  }

  if (error.status && error.code) {
    return error;
  }

  if (error.code === 'ECONNABORTED' || (error.message && error.message.toLowerCase().includes('timeout'))) {
    const err = new Error('Urja Ops portal request timed out. Please try again later.');
    err.status = 504;
    err.code = 'UPSTREAM_TIMEOUT';
    return err;
  }

  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'EAI_AGAIN' ||
    error.code === 'ECONNRESET'
  ) {
    const err = new Error('Unable to connect to the Urja Ops portal. Please check network connection and portal availability.');
    err.status = 503;
    err.code = 'UPSTREAM_UNAVAILABLE';
    return err;
  }

  if (error.response) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      const err = new Error('Urja Ops portal authentication failed.');
      err.status = 502;
      err.code = 'UPSTREAM_AUTH_FAILED';
      return err;
    }
    if (status === 404) {
      const err = new Error('Resource not found on Urja Ops portal.');
      err.status = 404;
      err.code = 'UPSTREAM_NOT_FOUND';
      return err;
    }
    if (status === 429) {
      const err = new Error('Urja Ops portal rate limit exceeded. Please try again later.');
      err.status = 503;
      err.code = 'UPSTREAM_RATE_LIMITED';
      return err;
    }
    if (status >= 500) {
      const err = new Error(`Urja Ops portal encountered an internal error (HTTP ${status}).`);
      err.status = 502;
      err.code = 'UPSTREAM_SERVER_ERROR';
      return err;
    }
    const err = new Error(`Urja Ops portal request rejected with status ${status}.`);
    err.status = 502;
    err.code = 'UPSTREAM_ERROR';
    return err;
  }

  const err = new Error(error.message || 'Urja Ops portal request failed.');
  err.status = 502;
  err.code = 'UPSTREAM_ERROR';
  return err;
}

module.exports = {
  login,
  ensureAuthenticated,
  get
};
