# Contributing

This directory lives in the Relintio monorepo at `packages/cli` and is mirrored read-only to [Relintio/relintio-cli](https://github.com/Relintio/relintio-cli). Open pull requests against the monorepo — a commit pushed to the mirror is overwritten on the next sync.

## Running it

```bash
node bin/relintio.mjs --help
node bin/relintio.mjs doctor --offline
```

No install step. The package has zero runtime dependencies, on purpose: it is executed with `npx` by people who have not chosen to trust it yet, and every dependency is something they would be trusting without being asked.

## Tests

```bash
npm test
```

`node --test`, no framework. 49 tests across four files, each mapping to one module:

| File | Covers |
| --- | --- |
| `test/args.test.mjs` | Argument parsing, aliases, `--`, missing values |
| `test/detect.test.mjs` | Runtime detection order, package managers, domain inference, env parsing |
| `test/env.test.mjs` | Surgical `.env` edits, `.gitignore`, key shape |
| `test/verify.test.mjs` | Control-plane payload and every response branch |

New behaviour needs a test in the matching file. Detection changes in particular need one — the ordering rules are load-bearing and a regression there is silent.

## The rules this CLI holds itself to

**Never break a working project.** Source is edited only when the shape is unambiguous. If `wireExpress` cannot find a plain `const app = express()`, it returns `applied: false` with a reason and the caller prints a snippet. Widening that match to catch more cases is how a tool starts corrupting files. Don't.

**Idempotent.** Running twice must be a no-op. Every write path checks first.

**No credential ever leaves a redaction.** License keys are masked in output (`mask()` in `init.mjs`), never logged, and `.env` is added to `.gitignore` on every run — not just the first.

**Fail loudly on config, quietly on network.** A missing license key is an error the user must fix. A control plane that will not answer is reported and the install still stands, because the agent itself fails open.

**Exit codes are an API.** `0` done, `1` could not proceed, `2` installed but unverified. Pipelines branch on these. Changing one is a breaking change.

## Adding a runtime

1. Add an entry to `RUNTIMES` in `src/runtimes.mjs`. Position matters — the list is walked top to bottom and the first match wins, which is why WordPress sits above PHP and React above Node.
2. Add its install command to `installCommand()`.
3. Add a wiring snippet to `SNIPPETS` in `src/wire.mjs`. Register-first, fail-open, reading the key from the environment.
4. Add a detection test to `test/detect.test.mjs`.
5. Add the row to the table in `README.md` and in the `-r, --runtime` help text in `src/cli.mjs`.
6. Write the matching skill in [Relintio/skills](https://github.com/Relintio/skills) under `skills/runtimes/`.

`test/wire.test.mjs` asserts that every runtime which can be wired ships a snippet, so step 3 is enforced.

## Releasing

Bump `version` in `package.json` and merge to `main`. The monorepo workflow at `.github/workflows/publish-cli.yml` runs the tests on Node 18, 20 and 22, refuses to republish an existing version, checks that no license key was committed, and publishes to npm.

Nothing publishes from this mirror. The workflow here runs tests only.
