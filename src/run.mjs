import { spawn } from 'node:child_process';

/** Run a command, streaming its output, and resolve with the exit code. */
export function run(argv, { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', (error) => resolve({ code: -1, error }));
    child.on('close', (code) => resolve({ code: code ?? -1 }));
  });
}

/** Is this executable on PATH? */
export function which(bin) {
  const lookup = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    const child = spawn(lookup, [bin], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}
