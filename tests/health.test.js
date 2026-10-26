const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

describe('GET /health', () => {
  let server;
  let baseUrl;

  before((_, done) => {
    // Listen on port 0 to bind to an available ephemeral port
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  test('should return status 200 with JSON { status: "ok" }', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.deepStrictEqual(data, { status: 'ok' });
  });
});
