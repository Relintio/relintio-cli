import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/args.mjs';

test('reads a command and its options', () => {
  const args = parseArgs(['init', '--license-key', 'UP_LIVE_x', '--domain', 'a.com']);
  assert.deepEqual(args._, ['init']);
  assert.equal(args['license-key'], 'UP_LIVE_x');
  assert.equal(args.domain, 'a.com');
});

test('supports --key=value', () => {
  const args = parseArgs(['init', '--domain=a.com']);
  assert.equal(args.domain, 'a.com');
});

test('supports short aliases', () => {
  const args = parseArgs(['init', '-k', 'UP_LIVE_x', '-d', 'a.com', '-y']);
  assert.equal(args['license-key'], 'UP_LIVE_x');
  assert.equal(args.domain, 'a.com');
  assert.equal(args.yes, true);
});

test('boolean flags do not swallow the next argument', () => {
  const args = parseArgs(['init', '--dry-run', 'extra']);
  assert.equal(args['dry-run'], true);
  assert.deepEqual(args._, ['init', 'extra']);
});

test('collects options that are missing a value instead of throwing', () => {
  const args = parseArgs(['init', '--domain']);
  assert.deepEqual(args.unknown, ['--domain']);
});

test('everything after -- is positional', () => {
  const args = parseArgs(['init', '--', '--not-a-flag']);
  assert.deepEqual(args._, ['init', '--not-a-flag']);
});

test('--no-install and friends parse as booleans', () => {
  const args = parseArgs(['init', '--no-install', '--no-wire', '--no-verify', '--json']);
  assert.equal(args['no-install'], true);
  assert.equal(args['no-wire'], true);
  assert.equal(args['no-verify'], true);
  assert.equal(args.json, true);
});
