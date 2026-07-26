import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_API_URL = 'https://api.relintio.com/v1';

/**
 * Add or update keys in a .env file without disturbing anything else in it.
 *
 * Existing keys are rewritten in place so ordering and surrounding
 * comments survive; new keys are appended under a labelled block.
 * Returns a summary of what changed so the caller can report honestly.
 */
export function upsertEnv(dir, values, { file = '.env' } = {}) {
  const target = path.join(dir, file);

  let raw = '';
  let existed = false;
  try {
    raw = fs.readFileSync(target, 'utf8');
    existed = true;
  } catch {
    /* creating it */
  }

  const lines = raw === '' ? [] : raw.split('\n');
  const added = [];
  const updated = [];
  const unchanged = [];

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;

    const index = lines.findIndex((line) =>
      new RegExp(`^\\s*(export\\s+)?${escapeKey(key)}\\s*=`).test(line),
    );

    const rendered = `${key}=${quoteIfNeeded(value)}`;

    if (index === -1) {
      added.push(key);
      continue;
    }
    if (lines[index] === rendered) {
      unchanged.push(key);
      continue;
    }
    lines[index] = rendered;
    updated.push(key);
  }

  if (added.length) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push('# Relintio — https://relintio.com/docs');
    for (const key of added) lines.push(`${key}=${quoteIfNeeded(values[key])}`);
  }

  let out = lines.join('\n');
  if (!out.endsWith('\n')) out += '\n';

  return { target, existed, added, updated, unchanged, contents: out };
}

export function writeEnv(result) {
  fs.writeFileSync(result.target, result.contents, 'utf8');
  return result;
}

/**
 * Make sure the env file is ignored by git. A license key committed to a
 * public repo is the single most expensive mistake this CLI can allow,
 * so it is checked on every run rather than only on first install.
 */
export function ensureGitignored(dir, file = '.env') {
  const gitignore = path.join(dir, '.gitignore');
  const hasGit = fs.existsSync(path.join(dir, '.git'));

  let raw = '';
  try {
    raw = fs.readFileSync(gitignore, 'utf8');
  } catch {
    if (!hasGit) return { needed: false, changed: false };
  }

  const ignored = raw
    .split('\n')
    .map((l) => l.trim())
    .some((l) => l === file || l === `/${file}` || l === `${file}*`);

  if (ignored) return { needed: true, changed: false, alreadyIgnored: true };

  const next =
    (raw && !raw.endsWith('\n') ? raw + '\n' : raw) +
    (raw ? '\n' : '') +
    `# Relintio: never commit your license key\n${file}\n`;

  fs.writeFileSync(gitignore, next, 'utf8');
  return { needed: true, changed: true, alreadyIgnored: false };
}

function escapeKey(key) {
  return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quoteIfNeeded(value) {
  const s = String(value);
  return /[\s#'"]/.test(s) ? JSON.stringify(s) : s;
}

/** Sanity-check a license key before spending a network round trip on it. */
export function looksLikeLicenseKey(value) {
  if (typeof value !== 'string') return false;
  const key = value.trim();
  if (key.length < 12) return false;
  return /^UP_(LIVE|TEST)_[A-Za-z0-9._-]{8,}$/.test(key);
}
