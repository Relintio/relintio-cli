import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.mjs';
import * as ui from './ui.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function readVersion() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'),
    ).version;
  } catch {
    return '0.0.0';
  }
}

const HELP = `
  ${ui.c.bold('relintio')} — application protection, in your runtime

  ${ui.c.gray('Usage')}
    npx relintio@latest <command> [options]

  ${ui.c.gray('Commands')}
    init        Detect the runtime, install the agent, configure it, and verify
    verify      Check the license against the control plane
    doctor      Report what is missing without changing anything

  ${ui.c.gray('Options')}
    -k, --license-key <key>   License key (default: UP_LICENSE_KEY or .env)
    -d, --domain <host>       Domain to bind the license to
    -r, --runtime <id>        Skip detection: node, react, python, php, go,
                              ruby, rust, java, dotnet, zig, wordpress, shopify
        --api-url <url>       Control plane (default: https://api.relintio.com/v1)
        --cwd <dir>           Project root (default: the current directory)
    -y, --yes                 Accept every prompt
        --dry-run             Show what would happen, change nothing
        --no-install          Do not install the SDK
        --no-wire             Do not touch application source
        --no-verify           Skip the network check
        --offline             doctor only: skip the control-plane call
        --json                Machine-readable output (verify, doctor)
    -h, --help                Show this
    -v, --version             Print the version

  ${ui.c.gray('Examples')}
    npx relintio@latest init
    npx relintio@latest init --license-key UP_LIVE_… --domain example.com --yes
    npx relintio@latest doctor --json
`;

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const version = readVersion();

  if (args.version) {
    ui.line(version);
    return 0;
  }

  if (args.unknown.length) {
    ui.fail(`Unrecognised option${args.unknown.length > 1 ? 's' : ''}: ${args.unknown.join(', ')}`);
    ui.detail('Run `npx relintio --help` for the full list.');
    return 1;
  }

  const command = args._[0];

  if (!command || args.help) {
    ui.line(HELP);
    return command || args.help ? 0 : 1;
  }

  switch (command) {
    case 'init': {
      const { init } = await import('./commands/init.mjs');
      return init(args, { version });
    }
    case 'verify': {
      const { verify } = await import('./commands/verify.mjs');
      return verify(args, { version });
    }
    case 'doctor': {
      const { doctor } = await import('./commands/doctor.mjs');
      return doctor(args, { version });
    }
    default:
      ui.fail(`Unknown command "${command}".`);
      ui.detail('Try: init, verify, doctor');
      return 1;
  }
}
