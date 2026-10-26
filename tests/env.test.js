const { test, describe } = require('node:test');
const assert = require('node:assert');
const env = require('../src/config/env');

describe('Configuration env.js', () => {
  test('should load and validate PORT and PORTAL_BASE_URL', () => {
    assert.strictEqual(typeof env.port, 'number');
    assert.ok(env.port > 0 && env.port <= 65535);
    assert.strictEqual(typeof env.portalBaseUrl, 'string');
    assert.ok(env.portalBaseUrl.length > 0);
  });
});
