import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLicense, interpret, PROTOCOL_VERSION } from '../src/verify.mjs';

function stubFetch(status, body = {}) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options, payload: JSON.parse(options.body) });
    return { status, json: async () => body };
  };
  fn.calls = calls;
  return fn;
}

test('posts the agent contract payload to /verify', async () => {
  const fetchImpl = stubFetch(200, { status: 'ok' });
  await verifyLicense({
    licenseKey: 'UP_LIVE_abcdefgh',
    domain: 'example.com',
    apiUrl: 'https://api.relintio.com/v1',
    fetchImpl,
  });

  const [call] = fetchImpl.calls;
  assert.equal(call.url, 'https://api.relintio.com/v1/verify');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.payload.license_key, 'UP_LIVE_abcdefgh');
  assert.equal(call.payload.domain, 'example.com');
  assert.equal(call.payload.protocol_version, PROTOCOL_VERSION);
  assert.equal(call.payload.agent_kind, 'cli');
});

test('does not double the slash when the api url has a trailing one', async () => {
  const fetchImpl = stubFetch(200, {});
  await verifyLicense({
    licenseKey: 'k',
    apiUrl: 'https://api.relintio.com/v1/',
    fetchImpl,
  });
  assert.equal(fetchImpl.calls[0].url, 'https://api.relintio.com/v1/verify');
});

test('omits the domain rather than sending an empty one', async () => {
  const fetchImpl = stubFetch(200, {});
  await verifyLicense({ licenseKey: 'k', domain: '', fetchImpl });
  assert.equal('domain' in fetchImpl.calls[0].payload, false);
});

test('refuses to call the API without a key', async () => {
  const fetchImpl = stubFetch(200, {});
  const result = await verifyLicense({ licenseKey: '', fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'no-key');
  assert.equal(fetchImpl.calls.length, 0);
});

test('maps every documented API outcome', () => {
  assert.equal(interpret(200, { status: 'ok' }).ok, true);
  assert.equal(interpret(401, { message: 'Invalid License' }).code, 'invalid-key');
  assert.equal(interpret(403, { message: 'License Suspended' }).code, 'suspended');
  assert.equal(interpret(422, { message: 'Domain required' }).code, 'domain-required');
  assert.equal(interpret(429).code, 'rate-limited');
  assert.equal(interpret(503).code, 'server-error');
});

test('an expired subscription is a failure even though the API returns 200', () => {
  const result = interpret(200, {
    status: 'expired',
    message: 'Subscription expired. Protection disabled.',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'expired');
  assert.match(result.hint, /renew/i);
});

test('a suspended body on a 200 is also a failure', () => {
  assert.equal(interpret(200, { status: 'suspended' }).ok, false);
});

test('surfaces a network failure as a network failure', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const result = await verifyLicense({ licenseKey: 'k', fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'network');
  assert.match(result.message, /ECONNREFUSED/);
});

test('surfaces a timeout as a timeout', async () => {
  const fetchImpl = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  const result = await verifyLicense({ licenseKey: 'k', fetchImpl, timeoutMs: 1000 });
  assert.equal(result.code, 'timeout');
});

test('a body that is not JSON does not crash the check', async () => {
  const fetchImpl = async () => ({
    status: 200,
    json: async () => {
      throw new Error('not json');
    },
  });
  const result = await verifyLicense({ licenseKey: 'k', fetchImpl });
  assert.equal(result.ok, true);
});
