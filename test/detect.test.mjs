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

test('detects a plain Express project as express', () => {
  // This used to answer `node`, which installed the generic middleware and
  // worked. `@relintio/express` is the same engine with the Express-shaped
  // boundary around it — one `app.use()`, and a fault releases the request
  // instead of becoming a 500.
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { express: '^4.21.2' } }),
  });
  assert.equal(detect(dir)[0].id, 'express');
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

// ── The orderings that decide whether a detection is useful ────────────────
//
// `detect()` returns the first runtime whose signals match, so every runtime
// that also matches something more general has to sit above it. Each test
// below is a project that matches two entries, and the answer that is the
// useful one. Without them, moving a runtime in the list silently changes
// what gets installed.

test('a Nuxt project resolves to nuxt, not vue or node', () => {
  // Answering "Vue" installs the browser half and leaves Nitro unprotected —
  // which is the half that actually enforces.
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { nuxt: '^3.14.0', vue: '^3.5.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'nuxt');
});

test('an Expo app resolves to expo, not react', () => {
  // React Native has no DOM. The web agent installed there reaches for a
  // canvas that is not present.
  const dir = fixture({
    'app.json': JSON.stringify({ expo: { name: 'shop' } }),
    'package.json': JSON.stringify({ dependencies: { expo: '~52.0.0', react: '18.3.1', 'react-native': '0.76.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'expo');
});

test('an Express project resolves to express, not node', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { express: '^4.21.2' } }),
  });
  assert.equal(detect(dir)[0].id, 'express');
});

test('a SvelteKit project resolves to svelte', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2.0.0', svelte: '^5.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'svelte');
});

test('an Angular workspace resolves to angular', () => {
  const dir = fixture({
    'angular.json': JSON.stringify({ version: 1 }),
    'package.json': JSON.stringify({ dependencies: { '@angular/core': '^17.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'angular');
});

test('a plain Vue project resolves to vue, not node', () => {
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { vue: '^3.5.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'vue');
});

test('a Vercel project wins over the framework inside it', () => {
  // The edge middleware runs before the application is invoked at all, so it
  // is the better answer even for a Next repository.
  const dir = fixture({
    'vercel.json': '{}',
    'package.json': JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'vercel');
});

test('a Supabase project wins over its package.json', () => {
  const dir = fixture({
    'supabase/config.toml': 'project_id = "abc"',
    'package.json': '{}',
  });
  assert.equal(detect(dir)[0].id, 'supabase');
});

test('a Firebase project wins over its functions package.json', () => {
  const dir = fixture({
    'firebase.json': JSON.stringify({ functions: {} }),
    'package.json': '{}',
  });
  assert.equal(detect(dir)[0].id, 'firebase');
});

test('a bare Node project still resolves to node', () => {
  // The fallback has to survive all of the above being added above it.
  const dir = fixture({
    'package.json': JSON.stringify({ dependencies: { fastify: '^4.0.0' } }),
  });
  assert.equal(detect(dir)[0].id, 'node');
});
