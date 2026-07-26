import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ESC = '\u001b[';

const useColor =
  stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';

const wrap = (open, close) => (s) =>
  useColor ? `${ESC}${open}m${s}${ESC}${close}m` : String(s);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  gray: wrap(90, 39),
};

export const sym = {
  ok: c.green('✓'),
  fail: c.red('✗'),
  warn: c.yellow('!'),
  step: c.gray('›'),
};

export function line(msg = '') {
  stdout.write(`${msg}\n`);
}

export function step(msg) {
  line(`${sym.step} ${msg}`);
}

export function ok(msg) {
  line(`${sym.ok} ${msg}`);
}

export function warn(msg) {
  line(`${sym.warn} ${c.yellow(msg)}`);
}

export function fail(msg) {
  line(`${sym.fail} ${c.red(msg)}`);
}

export function detail(msg) {
  line(`  ${c.gray(msg)}`);
}

export function banner() {
  line();
  line(
    `  ${c.bold('Relintio')} ${c.gray('· application protection, in your runtime')}`,
  );
  line();
}

export function interactive() {
  return Boolean(stdin.isTTY && stdout.isTTY);
}

/** Prompt for a line of text. Returns `fallback` when not interactive. */
export async function ask(question, { fallback = '' } = {}) {
  if (!interactive()) return fallback;
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(`  ${question} `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function confirm(question, { fallback = true } = {}) {
  if (!interactive()) return fallback;
  const hint = fallback ? 'Y/n' : 'y/N';
  const answer = (await ask(`${question} ${c.gray(`(${hint})`)}`)).toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes';
}
