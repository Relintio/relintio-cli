import path from 'node:path';
import fs from 'node:fs';
import { detect, alreadyInstalled, readEnvFile, guessDomain, packageManagerFor } from '../detect.mjs';
import { DEFAULT_API_URL, looksLikeLicenseKey } from '../env.mjs';
import { verifyLicense } from '../verify.mjs';
import * as ui from '../ui.mjs';

/**
 * Report everything that would stop this project from being protected,
 * without changing a single file. Safe to run in CI.
 */
export async function doctor(args, { version }) {
  const dir = path.resolve(args.cwd || process.cwd());
  const checks = [];

  const found = detect(dir);
  const runtime = found[0];

  checks.push(
    runtime
      ? { ok: true, label: `Runtime: ${runtime.label}` }
      : {
          ok: false,
          label: 'No supported runtime detected',
          hint: 'Run from the project root, or pass --runtime <id>.',
        },
  );

  if (found.length > 1) {
    checks.push({
      ok: null,
      label: `Multiple runtimes matched: ${found.map((r) => r.label).join(', ')}`,
      hint: 'Pick one explicitly with --runtime.',
    });
  }

  if (runtime) {
    const installed = alreadyInstalled(runtime.id, dir);
    checks.push(
      installed
        ? { ok: true, label: `${runtime.pkg} is a declared dependency` }
        : {
            ok: false,
            label: `${runtime.pkg} is not in this project's manifest`,
            hint: `Run npx relintio init, or install it with ${packageManagerFor(runtime.id, dir)}.`,
          },
    );
  }

  const env = readEnvFile(dir);
  const licenseKey =
    args['license-key'] || process.env.UP_LICENSE_KEY || env.UP_LICENSE_KEY || '';

  checks.push(
    licenseKey
      ? {
          ok: looksLikeLicenseKey(licenseKey),
          label: licenseKey
            ? `License key present (${mask(licenseKey)})`
            : 'License key present',
          hint: looksLikeLicenseKey(licenseKey)
            ? undefined
            : 'The key does not match the expected UP_LIVE_… / UP_TEST_… shape.',
        }
      : {
          ok: false,
          label: 'UP_LICENSE_KEY is not set',
          hint: 'Add it to .env, or export it in the environment.',
        },
  );

  const apiUrl = env.UP_API_URL || process.env.UP_API_URL || DEFAULT_API_URL;
  const legacy = /relintio\.com\/api\b/.test(apiUrl);
  checks.push({
    ok: !legacy,
    label: `API URL: ${apiUrl}`,
    hint: legacy
      ? `That is the legacy host. Use ${DEFAULT_API_URL}.`
      : undefined,
  });

  const gitignored = isGitignored(dir, '.env');
  const hasEnvFile = fs.existsSync(path.join(dir, '.env'));
  const versioned =
    fs.existsSync(path.join(dir, '.git')) ||
    fs.existsSync(path.join(dir, '.gitignore'));
  if (hasEnvFile && versioned) {
    checks.push({
      ok: gitignored,
      label: gitignored ? '.env is ignored by git' : '.env is NOT ignored by git',
      hint: gitignored ? undefined : 'Add .env to .gitignore before committing.',
    });
  }

  const domain = args.domain || guessDomain(dir) || '';
  checks.push(
    domain
      ? { ok: true, label: `Domain: ${domain}` }
      : {
          ok: null,
          label: 'No domain inferred from this project',
          hint: 'Verification needs one — pass --domain example.com.',
        },
  );

  if (licenseKey && !args.offline) {
    const result = await verifyLicense({ licenseKey, domain, apiUrl, agentVersion: version });
    checks.push(
      result.ok
        ? { ok: true, label: 'Control plane says the license is active' }
        : { ok: false, label: result.message, hint: result.hint },
    );
  }

  if (args.json) {
    const failed = checks.filter((c) => c.ok === false).length;
    ui.line(JSON.stringify({ dir, checks, failed }, null, 2));
    return failed ? 1 : 0;
  }

  ui.banner();
  for (const check of checks) {
    if (check.ok === true) ui.ok(check.label);
    else if (check.ok === false) ui.fail(check.label);
    else ui.warn(check.label);
    if (check.hint) ui.detail(check.hint);
  }
  ui.line();

  const failed = checks.filter((c) => c.ok === false).length;
  if (failed) {
    ui.line(`  ${failed} problem${failed === 1 ? '' : 's'} to fix.`);
    ui.line();
    return 1;
  }
  ui.line(`  ${ui.c.bold('All clear.')}`);
  ui.line();
  return 0;
}

function isGitignored(dir, file) {
  try {
    return fs
      .readFileSync(path.join(dir, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .some((l) => l === file || l === `/${file}` || l === `${file}*`);
  } catch {
    return false;
  }
}

function mask(key) {
  if (key.length <= 12) return '***';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
