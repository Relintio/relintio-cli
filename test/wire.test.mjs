import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findNodeEntry, wireExpress, commitWiring, SNIPPETS } from '../src/wire.mjs';
import { RUNTIMES } from '../src/runtimes.mjs';

function tmp(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relintio-wire-'));
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}

const ESM_APP = `import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.get('/', (req, res) => res.send('ok'));
app.listen(3000);
`;

const CJS_APP = `const express = require('express');

const app = express();

app.get('/', (req, res) => res.send('ok'));
app.listen(3000);
`;

test('finds the entry file from package.json main first', () => {
  const dir = tmp({
    'package.json': JSON.stringify({ main: 'src/boot.js' }),
    'src/boot.js': ESM_APP,
    'index.js': ESM_APP,
  });
  assert.equal(findNodeEntry(dir), 'src/boot.js');
});

test('falls back to conventional entry names', () => {
  const dir = tmp({ 'package.json': '{}', 'server.js': ESM_APP });
  assert.equal(findNodeEntry(dir), 'server.js');
});

test('returns null when there is no entry file', () => {
  assert.equal(findNodeEntry(tmp({ 'package.json': '{}' })), null);
});

test('wires an ESM express app after the app is created', () => {
  const dir = tmp({ 'package.json': '{}', 'server.js': ESM_APP });
  const result = wireExpress(dir, 'server.js');
  assert.equal(result.applied, true);
  assert.equal(result.isEsm, true);

  const out = result.contents;
  assert.match(out, /import \{ ultimateProtectorExpress \}/);
  assert.doesNotMatch(out, /require\('@relintio/);

  // the import lands with the other imports, above the app
  assert.ok(out.indexOf('@relintio/agent/express') < out.indexOf('const app ='));
  // the middleware registers before the app's own routes
  assert.ok(out.indexOf('ultimateProtectorExpress({') < out.indexOf("app.use(cors())"));
  assert.ok(out.indexOf('ultimateProtectorExpress({') < out.indexOf("app.get('/'"));
});

test('wires a CommonJS express app with require', () => {
  const dir = tmp({ 'package.json': '{}', 'server.js': CJS_APP });
  const result = wireExpress(dir, 'server.js');
  assert.equal(result.applied, true);
  assert.equal(result.isEsm, false);
  assert.match(result.contents, /const \{ ultimateProtectorExpress \} = require/);
});

test('honours the variable name the project actually uses', () => {
  const dir = tmp({
    'package.json': '{}',
    'server.js': "import express from 'express';\n\nconst server = express();\n\nserver.listen(3000);\n",
  });
  const result = wireExpress(dir, 'server.js');
  assert.equal(result.applied, true);
  assert.equal(result.appName, 'server');
  assert.match(result.contents, /server\.use\(ultimateProtectorExpress/);
  assert.doesNotMatch(result.contents, /\bapp\.use\(ultimateProtector/);
});

test('is idempotent — a second run changes nothing', () => {
  const dir = tmp({ 'package.json': '{}', 'server.js': ESM_APP });
  commitWiring(dir, wireExpress(dir, 'server.js'));
  const after = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');

  const second = wireExpress(dir, 'server.js');
  assert.equal(second.applied, false);
  assert.equal(second.already, true);
  assert.equal(fs.readFileSync(path.join(dir, 'server.js'), 'utf8'), after);
});

test('refuses to guess when the app is built in an unusual way', () => {
  const dir = tmp({
    'package.json': '{}',
    'server.js': "import express from 'express';\nexport default () => express();\n",
  });
  const result = wireExpress(dir, 'server.js');
  assert.equal(result.applied, false);
  assert.match(result.reason, /could not find/);
});

test('reports a missing file instead of throwing', () => {
  const result = wireExpress(tmp({}), 'nope.js');
  assert.equal(result.applied, false);
  assert.match(result.reason, /could not read/);
});

test('the wired file still parses as JavaScript', async () => {
  const dir = tmp({ 'package.json': JSON.stringify({ type: 'module' }), 'server.js': ESM_APP });
  commitWiring(dir, wireExpress(dir, 'server.js'));
  const source = fs.readFileSync(path.join(dir, 'server.js'), 'utf8');
  // new Function cannot hold import statements, so check via a real parse
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['--input-type=module', '--check'], {
    input: source,
  });
});

test('every runtime that can be wired ships a snippet', () => {
  for (const runtime of RUNTIMES) {
    const snippet = SNIPPETS[runtime.id];
    assert.ok(snippet, `${runtime.id} has no snippet entry`);
    if (runtime.id === 'wordpress' || runtime.id === 'shopify') continue;
    assert.ok(snippet.code, `${runtime.id} snippet has no code`);
    assert.ok(snippet.file, `${runtime.id} snippet has no target file`);
  }
});
