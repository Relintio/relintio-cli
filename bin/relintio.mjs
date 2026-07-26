#!/usr/bin/env node
import { main } from '../src/cli.mjs';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(
    `relintio needs Node 18 or newer (this is ${process.versions.node}).`,
  );
  process.exit(1);
}

main()
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((error) => {
    console.error(`\nrelintio failed: ${error?.stack || error}\n`);
    process.exitCode = 1;
  });
