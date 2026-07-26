# Changelog

## 1.0.1

- Point `repository` at the public `Relintio/relintio-cli` mirror instead of the private monorepo. npm resolves relative README image paths against this field, so the previous value produced a dead Repository link and a broken logo on the package page.
- Use an absolute URL for the README logo so it renders wherever the README is syndicated.
- Run the test suite with bare `node --test`. Passing a glob is a semver-major feature added in Node 21 and never backported to 20, so CI failed on Node 18 and 20.
- Syntax-check wired output from a `.mjs` file rather than `--input-type=module` on stdin, which is not portable across supported Node versions.

## 1.0.0

First release.

- `init` — detect the runtime, install the agent SDK, write `UP_LICENSE_KEY` and `UP_API_URL`, wire Express automatically, print a snippet for every other runtime, then verify the license against the control plane.
- `verify` — check a license against `POST /v1/verify` and exit non-zero when it is not active. `--json` for pipelines.
- `doctor` — read-only report of everything that would stop the project being protected.
- Detection for all twelve runtimes, ordered so WordPress beats a stray `composer.json`, Shopify beats its `package.json`, and React beats Node.
- Package manager inferred from the lockfile: npm, pnpm, yarn, bun, pip, poetry, uv, composer, go, bundler, cargo, maven, dotnet, zig.
- `.env` edits are surgical — existing keys are rewritten where they already sit.
- `.env` is added to `.gitignore` on every run when the project is a git repo.
- Zero runtime dependencies.
