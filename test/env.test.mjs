import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  upsertEnv,
  writeEnv,
  ensureGitignored,
  looksLikeLicenseKey,
} from '../src/env.mjs';

function tmp(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relintio-env-'));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

test('creates a .env when there is none', () => {
  const dir = tmp();
  const result = writeEnv(
    upsertEnv(dir, { UP_LICENSE_KEY: 'UP_LIVE_abcdefgh', UP_API_URL: 'https://x/v1' }),
  );
  assert.equal(result.existed, false);
  assert.deepEqual(result.added, ['UP_LICENSE_KEY', 'UP_API_URL']);
  const written = fs.readFileSync(path.join(dir, '.env'), 'utf8');
  assert.match(written, /UP_LICENSE_KEY=UP_LIVE_abcdefgh/);
  assert.match(written, /UP_API_URL=https:\/\/x\/v1/);
});

test('rewrites an existing key in place and leaves everything else alone', () => {
  const dir = tmp({
    '.env': '# app\nAPP_NAME=demo\nUP_LICENSE_KEY=UP_LIVE_old\nDB_HOST=localhost\n',
  });
  const result = writeEnv(upsertEnv(dir, { UP_LICENSE_KEY: 'UP_LIVE_new' }));
  const written = fs.readFileSync(path.join(dir, '.env'), 'utf8');

  assert.deepEqual(result.updated, ['UP_LICENSE_KEY']);
  assert.match(written, /^UP_LICENSE_KEY=UP_LIVE_new$/m);
  assert.doesNotMatch(written, /UP_LIVE_old/);
  assert.match(written, /^APP_NAME=demo$/m);
  assert.match(written, /^DB_HOST=localhost$/m);
  assert.match(written, /^# app$/m);
  // ordering is preserved: the key stays where the author put it
  assert.ok(written.indexOf('APP_NAME') < written.indexOf('UP_LICENSE_KEY'));
  assert.ok(written.indexOf('UP_LICENSE_KEY') < written.indexOf('DB_HOST'));
});

test('matches an exported key', () => {
  const dir = tmp({ '.env': 'export UP_API_URL=https://old/v1\n' });
  const result = upsertEnv(dir, { UP_API_URL: 'https://new/v1' });
  assert.deepEqual(result.updated, ['UP_API_URL']);
  assert.equal(result.added.length, 0);
});

test('is a no-op the second time', () => {
  const dir = tmp();
  writeEnv(upsertEnv(dir, { UP_API_URL: 'https://x/v1' }));
  const first = fs.readFileSync(path.join(dir, '.env'), 'utf8');
  const second = upsertEnv(dir, { UP_API_URL: 'https://x/v1' });
  assert.deepEqual(second.unchanged, ['UP_API_URL']);
  assert.equal(second.contents, first);
});

test('quotes values that would otherwise break parsing', () => {
  const dir = tmp();
  const result = upsertEnv(dir, { UP_ONLY_PATHS: '/a /b' });
  assert.match(result.contents, /UP_ONLY_PATHS="\/a \/b"/);
});

test('adds .env to .gitignore exactly once', () => {
  const dir = tmp({ '.gitignore': 'node_modules\n' });
  const first = ensureGitignored(dir);
  assert.equal(first.changed, true);
  const contents = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  assert.match(contents, /^\.env$/m);
  assert.match(contents, /^node_modules$/m);

  const second = ensureGitignored(dir);
  assert.equal(second.changed, false);
  assert.equal(second.alreadyIgnored, true);
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), contents);
});

test('does not create a .gitignore in a directory that is not a repo', () => {
  const dir = tmp();
  const result = ensureGitignored(dir);
  assert.equal(result.needed, false);
  assert.equal(fs.existsSync(path.join(dir, '.gitignore')), false);
});

test('recognises the license key shape', () => {
  assert.equal(looksLikeLicenseKey('UP_LIVE_a1b2c3d4e5'), true);
  assert.equal(looksLikeLicenseKey('UP_TEST_a1b2c3d4e5'), true);
  assert.equal(looksLikeLicenseKey('sk_live_a1b2c3d4e5'), false);
  assert.equal(looksLikeLicenseKey('UP_LIVE_short'), false);
  assert.equal(looksLikeLicenseKey(''), false);
  assert.equal(looksLikeLicenseKey(undefined), false);
});
