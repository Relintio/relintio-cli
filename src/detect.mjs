import fs from 'node:fs';
import path from 'node:path';
import { RUNTIMES, BY_ID } from './runtimes.mjs';

function exists(dir, name) {
  try {
    fs.accessSync(path.join(dir, name));
    return true;
  } catch {
    return false;
  }
}

function globExists(dir, pattern) {
  const ext = pattern.replace(/^\*/, '');
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith(ext));
  } catch {
    return false;
  }
}

/** Every dependency name declared in a package.json, across all dep fields. */
export function nodeDependencies(dir) {
  const file = path.join(dir, 'package.json');
  if (!exists(dir, 'package.json')) return null;
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  const names = new Set();
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const name of Object.keys(pkg[field] || {})) names.add(name);
  }
  return { pkg, names };
}

function matches(dir, runtime) {
  const { files = [], globs = [], deps, notDeps } = runtime.signals;

  const fileHit =
    files.some((f) =>
      f.startsWith('*') ? globExists(dir, f) : exists(dir, f),
    ) || globs.some((g) => globExists(dir, g));

  if (!fileHit) return false;

  if (deps || notDeps) {
    const node = nodeDependencies(dir);
    if (!node) return false;
    if (deps && !deps.some((d) => node.names.has(d))) return false;
    if (notDeps && notDeps.some((d) => node.names.has(d))) return false;
  }

  return true;
}

/**
 * Identify the runtime of the project rooted at `dir`.
 *
 * Returns every match in priority order, so the caller can tell the
 * difference between "one obvious answer" and "a monorepo or a
 * polyglot service that needs a human decision".
 */
export function detect(dir = process.cwd()) {
  return RUNTIMES.filter((r) => matches(dir, r));
}

/** Which JS package manager this project uses, from its lockfile. */
export function nodePackageManager(dir = process.cwd()) {
  if (exists(dir, 'bun.lockb') || exists(dir, 'bun.lock')) return 'bun';
  if (exists(dir, 'pnpm-lock.yaml')) return 'pnpm';
  if (exists(dir, 'yarn.lock')) return 'yarn';
  return 'npm';
}

/** Which Python package manager this project uses. */
export function pythonPackageManager(dir = process.cwd()) {
  if (exists(dir, 'uv.lock')) return 'uv';
  if (exists(dir, 'poetry.lock')) return 'poetry';
  try {
    const toml = fs.readFileSync(path.join(dir, 'pyproject.toml'), 'utf8');
    if (toml.includes('[tool.poetry]')) return 'poetry';
    if (toml.includes('[tool.uv]')) return 'uv';
  } catch {
    /* not a pyproject project */
  }
  return 'pip';
}

export function packageManagerFor(runtimeId, dir = process.cwd()) {
  if (runtimeId === 'node' || runtimeId === 'react') {
    return nodePackageManager(dir);
  }
  if (runtimeId === 'python') return pythonPackageManager(dir);
  return BY_ID[runtimeId]?.manager ?? null;
}

/**
 * Is the agent already installed? Cheap, best-effort, per-runtime.
 * A false negative only costs a redundant install; a false positive
 * would silently skip the step, so every check errs toward "no".
 */
export function alreadyInstalled(runtimeId, dir = process.cwd()) {
  const runtime = BY_ID[runtimeId];
  if (!runtime?.pkg) return false;

  if (runtimeId === 'node' || runtimeId === 'react') {
    const node = nodeDependencies(dir);
    return Boolean(node?.names.has(runtime.pkg));
  }

  const manifests = {
    python: ['pyproject.toml', 'requirements.txt', 'Pipfile'],
    php: ['composer.json'],
    go: ['go.mod'],
    ruby: ['Gemfile'],
    rust: ['Cargo.toml'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    zig: ['build.zig.zon'],
  }[runtimeId];

  if (!manifests) return false;

  return manifests.some((name) => {
    try {
      return fs
        .readFileSync(path.join(dir, name), 'utf8')
        .includes(runtime.pkg);
    } catch {
      return false;
    }
  });
}

/**
 * Guess the domain this project serves, so `verify` has something to
 * bind the license to. Never fabricates: returns null when unsure.
 */
export function guessDomain(dir = process.cwd()) {
  const fromEnv = readEnvFile(dir);
  for (const key of ['APP_URL', 'SITE_URL', 'NEXT_PUBLIC_SITE_URL', 'URL']) {
    const value = fromEnv[key];
    if (!value) continue;
    try {
      const host = new URL(value).hostname;
      if (host && host !== 'localhost' && !host.startsWith('127.')) return host;
    } catch {
      /* not a URL */
    }
  }

  const node = nodeDependencies(dir);
  const homepage = node?.pkg?.homepage;
  if (homepage) {
    try {
      const host = new URL(homepage).hostname;
      if (host) return host;
    } catch {
      /* not a URL */
    }
  }

  return null;
}

/** Parse a .env file into a plain object. Missing file yields {}. */
export function readEnvFile(dir = process.cwd(), file = '.env') {
  let raw;
  try {
    raw = fs.readFileSync(path.join(dir, file), 'utf8');
  } catch {
    return {};
  }
  return parseEnv(raw);
}

export function parseEnv(raw) {
  const out = {};
  for (const rawLine of raw.split('\n')) {
    const stripped = rawLine.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const eq = stripped.indexOf('=');
    if (eq < 1) continue;
    const key = stripped.slice(0, eq).trim();
    let value = stripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
