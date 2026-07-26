import path from 'node:path';
import { readEnvFile, guessDomain } from '../detect.mjs';
import { DEFAULT_API_URL } from '../env.mjs';
import { verifyLicense } from '../verify.mjs';
import * as ui from '../ui.mjs';

export async function verify(args, { version }) {
  const dir = path.resolve(args.cwd || process.cwd());
  const env = readEnvFile(dir);

  const licenseKey =
    args['license-key'] || process.env.UP_LICENSE_KEY || env.UP_LICENSE_KEY || '';
  const apiUrl =
    args['api-url'] || process.env.UP_API_URL || env.UP_API_URL || DEFAULT_API_URL;
  const domain = args.domain || guessDomain(dir) || '';

  const result = await verifyLicense({
    licenseKey,
    domain,
    apiUrl,
    agentVersion: version,
  });

  if (args.json) {
    ui.line(JSON.stringify({ domain, apiUrl, ...result }, null, 2));
    return result.ok ? 0 : 1;
  }

  ui.banner();
  if (result.ok) {
    ui.ok(`License is active${domain ? ` for ${ui.c.bold(domain)}` : ''}.`);
    ui.detail(apiUrl);
    return 0;
  }

  ui.fail(result.message);
  if (result.hint) ui.detail(result.hint);
  return 1;
}
