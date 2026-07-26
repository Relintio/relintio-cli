# relintio CLI

The command-line installer for Relintio application protection. Zero runtime dependencies, Node 18+, ESM.

## Layout

```
bin/relintio.mjs        Entry point — Node version guard, exit code plumbing
src/cli.mjs             Help text, command dispatch, version
src/args.mjs            Argument parser (no dependency)
src/runtimes.mjs        The twelve runtimes: signals, packages, install commands
src/detect.mjs          Runtime detection, package managers, domain, .env reading
src/env.mjs             Surgical .env writes, .gitignore, key shape
src/wire.mjs            Per-runtime snippets, automatic Express wiring
src/verify.mjs          Control-plane call and response interpretation
src/run.mjs             Subprocess helpers
src/ui.mjs              Output, colour, prompts
src/commands/*.mjs      init, verify, doctor
```

Commands are lazily imported in `cli.mjs`, so `--help` and `--version` do not load the world.

## Invariants

Break one of these and the tool becomes dangerous rather than merely broken.

**Detection order is load-bearing.** `RUNTIMES` is walked top to bottom, first match wins. WordPress sits above PHP because a WordPress install has a `composer.json`. Shopify sits above Node because a Shopify app has a `package.json`. React sits above Node and is distinguished only by its dependencies. Reordering this list silently changes what gets installed.

**`wireExpress` refuses rather than guesses.** It matches a plain `const app = express()` and nothing else. Anything ambiguous returns `applied: false` with a reason, and the caller prints a snippet. Widening the regex to catch more shapes is how a tool starts corrupting entry files.

**Every write is idempotent.** `upsertEnv` rewrites a key where it already sits. `wireExpress` returns `already: true` on a file containing `@relintio/agent`. `ensureGitignored` is a no-op when the entry exists.

**Network failure is not install failure.** `init` returns `2`, not `1`, when everything is in place but verification failed. The install stands; the license or the network is the problem.

**A `200` is not automatically success.** `interpret()` in `verify.mjs` checks the body — `status: "expired"` arrives with an HTTP 200 and means protection is off.

**Keys are masked in output and never logged.** `mask()` in `init.mjs` and `doctor.mjs`.

## Tests

`npm test` — `node --test`, no framework, 49 tests. One file per module. `test/wire.test.mjs` asserts every runtime ships a snippet, and re-parses the wired output with `node --check` so a wiring change cannot emit invalid JavaScript.

## Publishing

From the monorepo only, via `.github/workflows/publish-cli.yml`. The workflow in this directory is inert in the monorepo and runs tests only in the mirror. Do not add a publish step to it.
