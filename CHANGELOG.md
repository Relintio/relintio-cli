# Changelog

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
