import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  detect,
  nodePackageManager,
  pythonPackageManager,
  alreadyInstalled,
  guessDomain,
  parseEnv,
} from '../src/detect.mjs';

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relintio-'));
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return dir;
}

test('detects a plain Express project as node', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { express: '^4.21.2' } }),
  });
  assert.equal(detect(dir)[0].id, 'node');
});

test('detects a React project as react, not node', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'react');
});

test('a Next.js project resolves to react', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { next: '^14.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'react');
});

test('WordPress wins over the composer.json sitting next to it', () => {
  const dir = fixture({
    'wp-config.php': '<?php',
    'composer.json': '{}',
  });
  assert.equal(detect(dir)[0].id, 'wordpress');
});

test('a Shopify app wins over its package.json', () => {
  const dir = fixture({
    'shopify.app.toml': 'name = "shop"',
    'package.json': '{}',
  });
  assert.equal(detect(dir)[0].id, 'shopify');
});

test('detects each single-signal runtime', () => {
  const cases = {
    python: { 'pyproject.toml': '[project]\nname="x"' },
    php: { 'composer.json': '{}' },
    go: { 'go.mod': 'module x' },
    ruby: { Gemfile: 'source "https://rubygems.org"' },
    rust: { 'Cargo.toml': '[package]' },
    java: { 'pom.xml': '<project/>' },
    zig: { 'build.zig': 'pub fn build() void {}' },
  };
  for (const [id, files] of Object.entries(cases)) {
    assert.equal(detect(fixture(files))[0].id, id, `expected ${id}`);
  }
});

test('detects .NET from a glob', () => {
  const dir = fixture({ 'Api.csproj': '<Project/>' });
  assert.equal(detect(dir)[0].id, 'dotnet');
});

test('an empty directory detects nothing', () => {
  assert.deepEqual(detect(fixture({})), []);
});

test('reads the package manager from the lockfile', () => {
  assert.equal(nodePackageManager(fixture({ 'package.json': '{}' })), 'npm');
  assert.equal(
    nodePackageManager(fixture({ 'package.json': '{}', 'yarn.lock': '' })),
    'yarn',
  );
  assert.equal(
    nodePackageManager(fixture({ 'package.json': '{}', 'pnpm-lock.yaml': '' })),
    'pnpm',
  );
  assert.equal(
    nodePackageManager(fixture({ 'package.json': '{}', 'bun.lockb': '' })),
    'bun',
  );
});

test('reads the python package manager from lockfiles and pyproject', () => {
  assert.equal(pythonPackageManager(fixture({ 'requirements.txt': '' })), 'pip');
  assert.equal(
    pythonPackageManager(fixture({ 'pyproject.toml': '[tool.poetry]' })),
    'poetry',
  );
  assert.equal(
    pythonPackageManager(fixture({ 'pyproject.toml': '', 'uv.lock': '' })),
    'uv',
  );
});

test('spots an agent that is already installed', () => {
  const wired = fixture({
    'package.json': JSON.stringify({
      dependencies: { express: '^4', '@relintio/agent': '^0.11.4' },
    }),
  });
  assert.equal(alreadyInstalled('node', wired), true);

  const bare = fixture({
    'package.json': JSON.stringify({ dependencies: { express: '^4' } }),
  });
  assert.equal(alreadyInstalled('node', bare), false);

  const py = fixture({ 'requirements.txt': 'relintio-agent==0.9.8\n' });
  assert.equal(alreadyInstalled('python', py), true);
});

test('infers the domain from APP_URL but never from localhost', () => {
  assert.equal(
    guessDomain(fixture({ '.env': 'APP_URL=https://shop.example.com\n' })),
    'shop.example.com',
  );
  assert.equal(
    guessDomain(fixture({ '.env': 'APP_URL=http://localhost:8000\n' })),
    null,
  );
  assert.equal(guessDomain(fixture({})), null);
});

test('parses env files with comments, quotes and export prefixes', () => {
  const parsed = parseEnv(
    ['# a comment', '', 'A=1', 'B="two words"', "C='three'", 'D=', 'nonsense'].join(
      '\n',
    ),
  );
  assert.equal(parsed.A, '1');
  assert.equal(parsed.B, 'two words');
  assert.equal(parsed.C, 'three');
  assert.equal(parsed.D, '');
  assert.equal(parsed.nonsense, undefined);
});
