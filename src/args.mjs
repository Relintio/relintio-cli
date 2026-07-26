const FLAGS = new Set([
  'yes',
  'y',
  'help',
  'h',
  'version',
  'v',
  'dry-run',
  'no-install',
  'no-wire',
  'no-verify',
  'offline',
  'json',
]);

const ALIASES = {
  y: 'yes',
  h: 'help',
  v: 'version',
  k: 'license-key',
  d: 'domain',
  r: 'runtime',
};

/**
 * Parse argv without a dependency.
 *
 * Supports `--flag`, `--key value`, `--key=value`, `-k value` and `--`.
 * Unknown options are collected rather than thrown, so the command can
 * report all of them at once instead of one per run.
 */
export function parseArgs(argv) {
  const out = { _: [], unknown: [] };
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      const key = eq === -1 ? body : body.slice(0, eq);
      const inline = eq === -1 ? null : body.slice(eq + 1);
      const name = ALIASES[key] ?? key;

      if (FLAGS.has(name)) {
        out[name] = inline === null ? true : inline !== 'false';
        i += 1;
        continue;
      }
      if (inline !== null) {
        out[name] = inline;
        i += 1;
        continue;
      }
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        out.unknown.push(arg);
        i += 1;
        continue;
      }
      out[name] = value;
      i += 2;
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      const key = arg.slice(1);
      const name = ALIASES[key] ?? key;
      if (FLAGS.has(name)) {
        out[name] = true;
        i += 1;
        continue;
      }
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        out.unknown.push(arg);
        i += 1;
        continue;
      }
      out[name] = value;
      i += 2;
      continue;
    }

    out._.push(arg);
    i += 1;
  }

  return out;
}
