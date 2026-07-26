import { DEFAULT_API_URL } from './env.mjs';

export const PROTOCOL_VERSION = 1;

/**
 * Call the control plane's /verify endpoint the same way an agent does.
 *
 * This is the only step that proves the install actually works: it
 * confirms the key resolves, the subscription is live, and the domain
 * is bound. Every failure mode the API can return is mapped to a
 * human-readable outcome rather than a raw status code.
 */
export async function verifyLicense({
  licenseKey,
  domain,
  apiUrl = DEFAULT_API_URL,
  agentVersion = '1.0.0',
  timeoutMs = 10_000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!licenseKey) {
    return { ok: false, code: 'no-key', message: 'No license key was provided.' };
  }

  const url = `${apiUrl.replace(/\/+$/, '')}/verify`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let body = {};

  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': `relintio-cli/${agentVersion}`,
      },
      body: JSON.stringify({
        license_key: licenseKey,
        domain: domain || undefined,
        protocol_version: PROTOCOL_VERSION,
        agent_kind: 'cli',
        agent_type: 'cli',
        agent_version: agentVersion,
      }),
      signal: controller.signal,
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    return {
      ok: false,
      code: aborted ? 'timeout' : 'network',
      message: aborted
        ? `No response from ${url} within ${timeoutMs / 1000}s.`
        : `Could not reach ${url}: ${error?.message ?? error}`,
    };
  } finally {
    clearTimeout(timer);
  }

  return interpret(response.status, body, url);
}

export function interpret(status, body = {}, url = '') {
  const message = body?.message;

  if (status === 401) {
    return {
      ok: false,
      code: 'invalid-key',
      status,
      message: message || 'That license key was not recognised.',
      hint: 'Copy the key again from https://relintio.com/licenses.',
    };
  }

  if (status === 403) {
    return {
      ok: false,
      code: 'suspended',
      status,
      message: message || 'This license is suspended.',
      hint: 'Check the license status at https://relintio.com/licenses.',
    };
  }

  if (status === 422) {
    return {
      ok: false,
      code: 'domain-required',
      status,
      message: message || 'This license needs a domain before it can verify.',
      hint: 'Re-run with --domain example.com, or add the domain at https://relintio.com/licenses.',
    };
  }

  if (status === 429) {
    return {
      ok: false,
      code: 'rate-limited',
      status,
      message: 'The API is rate limiting this key right now.',
      hint: 'Wait a minute and run `npx relintio verify` again.',
    };
  }

  if (status >= 500) {
    return {
      ok: false,
      code: 'server-error',
      status,
      message: `${url} returned ${status}.`,
      hint: 'Check https://status.relintio.com, then try again.',
    };
  }

  if (body?.status === 'expired') {
    return {
      ok: false,
      code: 'expired',
      status,
      message: message || 'The subscription on this license has expired.',
      hint: 'Renew at https://relintio.com/subscribe — protection is disabled until you do.',
    };
  }

  if (body?.status === 'suspended') {
    return {
      ok: false,
      code: 'suspended',
      status,
      message: message || 'This license is suspended.',
    };
  }

  if (status >= 200 && status < 300) {
    return { ok: true, code: 'active', status, body };
  }

  return {
    ok: false,
    code: 'unexpected',
    status,
    message: message || `Unexpected response (${status}) from ${url}.`,
  };
}
