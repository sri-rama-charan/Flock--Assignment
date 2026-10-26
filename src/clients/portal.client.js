const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const env = require('../config/env');

const SESSION_COOKIE_NAME = 'auth.session_token';

/**
 * Client for communicating with the Urja Meter Ops portal.
 * Maintains persistent session cookies and handles transparent authentication and single-retry on expiry.
 */
class UrjaPortalClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || env.portalBaseUrl;
    this.username = options.username !== undefined ? options.username : env.portalUsername;
    this.password = options.password !== undefined ? options.password : env.portalPassword;
    this.timeout = options.timeout || 10000;

    // Cookie jar retains session cookies (auth.session_token) across requests
    this.jar = new CookieJar();
    this.client = wrapper(
      axios.create({
        jar: this.jar,
        baseURL: this.baseUrl,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'FlockEnergy-API-Client/1.0',
          'Accept': 'application/json, text/plain, */*'
        }
      })
    );

    // Lock promise to prevent concurrent duplicate login requests
    this._loginPromise = null;
  }

  /**
   * Check whether a valid, non-expired session cookie exists in the jar.
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      const cookies = await this.jar.getCookies(this.baseUrl);
      const sessionCookie = cookies.find((c) => c.key === SESSION_COOKIE_NAME);
      return Boolean(sessionCookie && sessionCookie.value);
    } catch {
      return false;
    }
  }

  /**
   * Clear all cookies from the jar, effectively resetting the session.
   */
  async clearSession() {
    await this.jar.removeAllCookies();
  }

  /**
   * Authenticate against the Urja portal and establish a session.
   * Inspects response and cookie jar to confirm a valid session was established.
   * Supports both form-encoded and JSON payload encodings without blindly assuming either.
   */
  async login() {
    if (!this.username || !this.password) {
      throw new Error(
        'Portal login failed: PORTAL_USERNAME and PORTAL_PASSWORD must be configured.'
      );
    }

    // Attempt 1: Standard URL-encoded form data (observed in SvelteKit form action HTML)
    let loginSuccess = false;
    let lastError = null;

    try {
      const formParams = new URLSearchParams();
      // Include both 'email' (from observed HTML input name) and 'username'
      formParams.append('email', this.username);
      formParams.append('username', this.username);
      formParams.append('password', this.password);

      const response = await this.client.post('/login', formParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-sveltekit-action': 'true',
          'Accept': 'application/json'
        }
      });

      loginSuccess = await this._verifyLoginOutcome(response);
    } catch (err) {
      lastError = err;
    }

    // Attempt 2: If form-encoded attempt did not establish session, try JSON payload
    if (!loginSuccess) {
      try {
        const jsonPayload = {
          email: this.username,
          username: this.username,
          password: this.password
        };

        const response = await this.client.post('/login', jsonPayload, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        loginSuccess = await this._verifyLoginOutcome(response);
      } catch (err) {
        lastError = err;
      }
    }

    if (!loginSuccess) {
      // Clear any partial cookies
      await this.clearSession();
      if (lastError && !lastError.response) {
        // Network or timeout failure
        throw this._formatError(lastError);
      }
      throw new Error(
        'Portal authentication failed: server did not issue a valid session cookie (auth.session_token). Please check credentials.'
      );
    }

    return true;
  }

  /**
   * Verify that the login response and cookie jar indicate successful authentication.
   * Does not rely on HTTP 200 alone, as SvelteKit returns 200 for action failures.
   * @private
   */
  async _verifyLoginOutcome(response) {
    // 1. Verify that auth.session_token exists in the cookie jar
    const cookies = await this.jar.getCookies(this.baseUrl);
    const sessionCookie = cookies.find((c) => c.key === SESSION_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) {
      return false;
    }

    // 2. If response body contains SvelteKit action failure indicator, reject
    if (response && response.data && typeof response.data === 'object') {
      if (response.data.type === 'failure') {
        return false;
      }
    }

    return true;
  }

  /**
   * Ensures the client is authenticated before making requests.
   * Uses a shared promise to prevent concurrent login storms.
   */
  async ensureAuthenticated() {
    if (await this.isAuthenticated()) {
      return;
    }

    if (!this._loginPromise) {
      this._loginPromise = this.login().finally(() => {
        this._loginPromise = null;
      });
    }

    return this._loginPromise;
  }

  /**
   * Execute an authenticated GET request against the Urja portal.
   * Automatically re-authenticates and retries at most once if the session is expired.
   *
   * @param {string} endpoint - Portal endpoint path (e.g. '/portal/meters/search?q=&page=1')
   * @param {object} [options={}] - Axios request options
   * @returns {Promise<any>} - Response payload data
   */
  async get(endpoint, options = {}) {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get(endpoint, options);

      // Check if portal returned a redirect to login or session expiry in body
      if (this._isAuthFailureResponse(response)) {
        if (!options._retry) {
          return this._retryGet(endpoint, options);
        }
        throw new Error('Urja Ops portal session expired or invalid.');
      }

      return response.data;
    } catch (error) {
      if (!options._retry && this._isAuthError(error)) {
        return this._retryGet(endpoint, options);
      }
      throw this._formatError(error);
    }
  }

  /**
   * Re-authenticates and retries an authenticated request once.
   * @private
   */
  async _retryGet(endpoint, options) {
    const retryOptions = { ...options, _retry: true };
    await this.clearSession();
    await this.login();
    const retryResponse = await this.client.get(endpoint, retryOptions);
    return retryResponse.data;
  }

  /**
   * Determine whether an HTTP error is due to authentication failure (401/403).
   * @private
   */
  _isAuthError(error) {
    if (error && error.response) {
      const status = error.response.status;
      return status === 401 || status === 403;
    }
    return false;
  }

  /**
   * Determine whether a successful HTTP response actually signals an auth redirect or failure.
   * @private
   */
  _isAuthFailureResponse(response) {
    if (response && response.data && typeof response.data === 'object') {
      const { type, location, status } = response.data;
      if (type === 'redirect' && typeof location === 'string' && location.includes('/login')) {
        return true;
      }
      if (type === 'failure' && (status === 401 || status === 403)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Format network and HTTP errors safely without exposing credentials or cookies.
   * @private
   */
  _formatError(error) {
    if (!error) {
      return new Error('Unknown portal communication error.');
    }

    if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
      return new Error(`Urja Ops portal request timed out after ${this.timeout}ms.`);
    }

    if (error.code === 'ECONNREFUSED') {
      return new Error('Unable to connect to Urja Ops portal (connection refused).');
    }

    if (error.code === 'ENOTFOUND') {
      return new Error('Urja Ops portal host not found. Please verify PORTAL_BASE_URL.');
    }

    if (error.response) {
      const status = error.response.status;
      let detail = error.response.statusText || 'Error';
      if (error.response.data && typeof error.response.data === 'object') {
        detail = error.response.data.message || error.response.data.error || detail;
      }
      return new Error(`Urja Ops portal error (HTTP ${status}): ${detail}`);
    }

    return new Error(`Urja Ops portal error: ${error.message}`);
  }
}

// Export default singleton instance for application use, plus class definition
const defaultClient = new UrjaPortalClient();
module.exports = defaultClient;
module.exports.UrjaPortalClient = UrjaPortalClient;
