import path from 'node:path';
import { BY_ID, installCommand } from '../runtimes.mjs';
import {
  detect,
  packageManagerFor,
  alreadyInstalled,
  guessDomain,
  readEnvFile,
} from '../detect.mjs';
import {
  upsertEnv,
  writeEnv,
  ensureGitignored,
  looksLikeLicenseKey,
  DEFAULT_API_URL,
} from '../env.mjs';
import { SNIPPETS, findNodeEntry, wireExpress, commitWiring, preloadInstructions } from '../wire.mjs';
import { verifyLicense } from '../verify.mjs';
import { run, which } from '../run.mjs';
import * as ui from '../ui.mjs';

export async function init(args, { version }) {
  const dir = path.resolve(args.cwd || process.cwd());
  const dry = Boolean(args['dry-run']);
  const assumeYes = Boolean(args.yes) || !ui.interactive();

  ui.banner();
  if (dry) ui.warn('Dry run — nothing will be written or installed.');

  // ---- 1. runtime -------------------------------------------------------
  let runtime;
  if (args.runtime) {
    runtime = BY_ID[args.runtime];
    if (!runtime) {
      ui.fail(`Unknown runtime "${args.runtime}".`);
      ui.detail(`Known runtimes: ${Object.keys(BY_ID).join(', ')}`);
      return 1;
    }
  } else {
    const found = detect(dir);
    if (found.length === 0) {
      ui.fail(`No supported runtime found in ${dir}.`);
      ui.detail('Run this from your project root, or pass --runtime <id>.');
      ui.detail(`Known runtimes: ${Object.keys(BY_ID).join(', ')}`);
      return 1;
    }
    runtime = found[0];
    if (found.length > 1) {
      ui.warn(
        `More than one runtime matched: ${found.map((r) => r.label).join(', ')}.`,
      );
      ui.detail(
        `Continuing with ${runtime.label}. Pass --runtime <id> to choose another.`,
      );
    }
  }

  ui.ok(`Detected ${ui.c.bold(runtime.label)} in ${ui.c.gray(dir)}`);

  if (runtime.companion) ui.warn(runtime.note);
  if (runtime.id === 'shopify') {
    ui.line();
    ui.step('Shopify installs from the dashboard, not the command line.');
    ui.detail(runtime.docs);
    return 0;
  }

  // ---- 2. license key ---------------------------------------------------
  const existingEnv = readEnvFile(dir);
  let licenseKey =
    args['license-key'] ||
    process.env.UP_LICENSE_KEY ||
    existingEnv.UP_LICENSE_KEY ||
    '';

  if (!licenseKey && !assumeYes) {
    ui.line();
    ui.detail('Find your key at https://relintio.com/licenses');
    licenseKey = await ui.ask('License key:');
  }

  if (!licenseKey) {
    ui.fail('No license key.');
    ui.detail(
      'Pass --license-key UP_LIVE_..., or set UP_LICENSE_KEY in the environment.',
    );
    return 1;
  }

  if (!looksLikeLicenseKey(licenseKey)) {
    ui.warn('That does not look like a Relintio key (expected UP_LIVE_… or UP_TEST_…).');
    ui.detail('Continuing anyway — verification will be the real test.');
  }

  const apiUrl = args['api-url'] || existingEnv.UP_API_URL || DEFAULT_API_URL;
  const domain = args.domain || guessDomain(dir) || '';

  // ---- 3. install -------------------------------------------------------
  ui.line();
  if (args['no-install']) {
    ui.step('Skipping install (--no-install).');
  } else if (alreadyInstalled(runtime.id, dir)) {
    ui.ok(`${runtime.pkg} is already a dependency.`);
  } else {
    const manager = packageManagerFor(runtime.id, dir);
    const command = installCommand(runtime, manager);

    if (!command) {
      ui.warn(`Install ${runtime.pkg} manually — see ${runtime.docs}`);
    } else if (dry) {
      ui.step(`Would run: ${ui.c.bold(command.join(' '))}`);
    } else {
      const available = await which(command[0]);
      if (!available) {
        ui.warn(`${command[0]} is not on PATH.`);
        ui.detail(`Run this yourself, then re-run init: ${command.join(' ')}`);
      } else {
        ui.step(`Running ${ui.c.bold(command.join(' '))}`);
        const { code, error } = await run(command, { cwd: dir });
        if (code !== 0) {
          ui.fail(`Install failed${error ? `: ${error.message}` : ` (exit ${code})`}.`);
          ui.detail(`Fix the error above, then run \`npx relintio init\` again.`);
          return 1;
        }
        ui.ok(`Installed ${runtime.pkg}`);
      }
    }
  }

  // ---- 4. configuration -------------------------------------------------
  ui.line();
  const envResult = upsertEnv(dir, {
    UP_LICENSE_KEY: licenseKey,
    UP_API_URL: apiUrl,
  });

  if (dry) {
    ui.step(`Would write ${path.basename(envResult.target)}:`);
    ui.detail(`UP_LICENSE_KEY=${mask(licenseKey)}`);
    ui.detail(`UP_API_URL=${apiUrl}`);
  } else {
    writeEnv(envResult);
    const changed = [...envResult.added, ...envResult.updated];
    if (changed.length) {
      ui.ok(
        `${envResult.existed ? 'Updated' : 'Created'} .env (${changed.join(', ')})`,
      );
    } else {
      ui.ok('.env already had the right values.');
    }

    const ignore = ensureGitignored(dir);
    if (ignore.changed) ui.ok('Added .env to .gitignore');
    else if (ignore.needed && !ignore.alreadyIgnored) {
      ui.warn('.env is not ignored by git — do not commit your license key.');
    }
  }

  // ---- 5. wiring --------------------------------------------------------
  ui.line();
  if (args['no-wire']) {
    ui.step('Skipping wiring (--no-wire).');
  } else {
    await wire(dir, runtime, { dry, assumeYes });
  }

  // ---- 6. verify --------------------------------------------------------
  ui.line();
  if (args['no-verify'] || dry) {
    ui.step('Skipping verification.');
    ui.detail('Run `npx relintio verify` once the app can reach the internet.');
  } else {
    ui.step('Verifying the license against the control plane…');
    const result = await verifyLicense({
      licenseKey,
      domain,
      apiUrl,
      agentVersion: version,
    });
    if (result.ok) {
      ui.ok(
        `License is active${domain ? ` for ${ui.c.bold(domain)}` : ''}.`,
      );
    } else {
      ui.fail(result.message);
      if (result.hint) ui.detail(result.hint);
      if (result.code === 'domain-required' && !domain) {
        ui.detail('The CLI could not infer your domain from this project.');
      }
      ui.line();
      ui.detail('The install itself is in place — only verification failed.');
      return 2;
    }
  }

  // ---- done -------------------------------------------------------------
  ui.line();
  if (dry) {
    ui.line(`  ${ui.c.bold('Nothing was changed.')} ${ui.c.gray('Re-run without --dry-run to apply.')}`);
    ui.line();
    return 0;
  }
  ui.line(`  ${ui.c.bold('Protected.')} ${ui.c.gray(runtime.docs)}`);
  ui.line();
  ui.detail('Start in observe mode, watch the dashboard for a day, then enforce.');
  ui.line();
  return 0;
}

async function wire(dir, runtime, { dry, assumeYes }) {
  const snippet = SNIPPETS[runtime.id];

  if (runtime.id === 'node') {
    const entry = findNodeEntry(dir);
    if (!entry) {
      ui.warn('Could not find your server entry file.');
      printSnippet(snippet);
      return;
    }

    const result = wireExpress(dir, entry);

    if (result.already) {
      ui.ok(`${entry} is already wired.`);
      return;
    }

    if (!result.applied) {
      ui.warn(`Left ${entry} alone — ${result.reason}.`);
      printSnippet(snippet);
      ui.line();
      ui.detail('Or wire nothing at all and use the zero-code preload:');
      for (const l of preloadInstructions().split('\n')) ui.detail(l);
      return;
    }

    if (dry) {
      ui.step(`Would register the middleware in ${ui.c.bold(entry)}.`);
      return;
    }

    const yes =
      assumeYes ||
      (await ui.confirm(`Register the middleware in ${ui.c.bold(entry)}?`));

    if (!yes) {
      printSnippet(snippet);
      return;
    }

    commitWiring(dir, result);
    ui.ok(`Registered the middleware in ${entry}`);
    return;
  }

  if (runtime.id === 'wordpress') {
    ui.step('Install the plugin zip from your dashboard, then activate it.');
    ui.detail(runtime.docs);
    return;
  }

  printSnippet(snippet);
}

function printSnippet(snippet) {
  if (!snippet?.code) return;
  ui.step(`Add this to ${snippet.file}:`);
  ui.line();
  for (const l of snippet.code.trimEnd().split('\n')) ui.line(l ? `    ${l}` : '');
}

function mask(key) {
  if (key.length <= 12) return '***';
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
