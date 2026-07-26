<div align="center">
  <img src="./assets/relintio-logo.svg" alt="Relintio" width="260">

  <h1>relintio</h1>

  <p>
    <a href="https://www.npmjs.com/package/relintio"><img alt="npm" src="https://img.shields.io/npm/v/relintio?color=efd420"></a>
    <a href="https://nodejs.org"><img alt="node" src="https://img.shields.io/node/v/relintio?color=efd420"></a>
    <a href="./LICENSE"><img alt="license" src="https://img.shields.io/badge/license-proprietary-efd420"></a>
  </p>

  <p><strong>The Relintio command-line interface.</strong></p>
</div>

---

One command detects your runtime, installs the right agent SDK, wires it in ahead of your own routes, writes the configuration, and proves the license is live before it tells you it worked.

```bash
npx relintio@latest init
```

```
  Relintio · application protection, in your runtime

✓ Detected Node.js in /srv/shop

› Running npm install @relintio/agent
✓ Installed @relintio/agent

✓ Created .env (UP_LICENSE_KEY, UP_API_URL)
✓ Added .env to .gitignore

✓ Registered the middleware in server.js

› Verifying the license against the control plane…
✓ License is active for shop.example.com.

  Protected. https://relintio.com/docs/quickstart/node
```

## Installation

No install needed — `npx` runs the latest version:

```bash
npx relintio@latest init
```

Or install it globally:

```bash
npm install -g relintio
```

Node 18 or newer, on the machine running the command. Your *project* can be in any of the twelve supported runtimes; Node is only needed to run the installer itself. Zero runtime dependencies.

## Usage

```
Usage
  npx relintio@latest <command> [options]

Commands
  init        Detect the runtime, install the agent, configure it, and verify
  verify      Check the license against the control plane
  doctor      Report what is missing without changing anything

Options
  -k, --license-key <key>   License key (default: UP_LICENSE_KEY or .env)
  -d, --domain <host>       Domain to bind the license to
  -r, --runtime <id>        Skip detection: node, react, python, php, go,
                            ruby, rust, java, dotnet, zig, wordpress, shopify
      --api-url <url>       Control plane (default: https://api.relintio.com/v1)
      --cwd <dir>           Project root (default: the current directory)
  -y, --yes                 Accept every prompt
      --dry-run             Show what would happen, change nothing
      --no-install          Do not install the SDK
      --no-wire             Do not touch application source
      --no-verify           Skip the network check
      --offline             doctor only: skip the control-plane call
      --json                Machine-readable output (verify, doctor)
  -h, --help                Show this
  -v, --version             Print the version

Examples
  npx relintio@latest init
  npx relintio@latest init --license-key UP_LIVE_… --domain example.com --yes
  npx relintio@latest doctor --json
```

## Commands

### `init`

The full install. Safe to run more than once: an agent already in the manifest is not reinstalled, an entry file already wired is left alone, and existing `.env` values are updated in place rather than appended.

```bash
npx relintio@latest init
npx relintio@latest init --license-key UP_LIVE_… --domain shop.example.com --yes
npx relintio@latest init --dry-run
```

Use `--dry-run` first on any repository you did not write. It prints the plan and changes nothing.

### `verify`

Ask the control plane whether this license is currently active. Reads the key from `--license-key`, then `UP_LICENSE_KEY`, then `.env`.

```bash
npx relintio@latest verify
npx relintio@latest verify --json
```

Exits `0` when active and `1` when not, so it drops straight into a deploy pipeline as a gate.

### `doctor`

Report everything that would stop this project being protected, without changing a single file.

```bash
npx relintio@latest doctor
npx relintio@latest doctor --offline --json
```

## What it installs

| Runtime | Detected by | Package |
| --- | --- | --- |
| WordPress | `wp-config.php` | plugin zip, activated with `wp` |
| Shopify | `shopify.app.toml` | installed from the dashboard |
| React | `package.json` with `react` or `next` | `@relintio/react-agent` |
| Node.js | `package.json` | `@relintio/agent` |
| Python | `pyproject.toml`, `requirements.txt`, `manage.py` | `relintio-agent` |
| PHP | `composer.json`, `artisan` | `relintio-agent/agent` |
| Go | `go.mod` | `github.com/Relintio/relintio-golang-agent` |
| Ruby | `Gemfile`, `config.ru` | `relintio-agent` |
| Rust | `Cargo.toml` | `relintio-agent` |
| Java | `pom.xml`, `build.gradle` | `com.relintio:relintio-agent` |
| .NET | `*.csproj`, `*.sln` | `Relintio.Agent` |
| Zig | `build.zig` | `relintio` |

Detection is ordered, not first-match-by-luck: WordPress beats the `composer.json` sitting beside it, Shopify beats its `package.json`, and React beats Node. The package manager comes from your lockfile, so a pnpm project gets `pnpm add` and a Poetry project gets `poetry add`.

When more than one runtime matches — a monorepo, a polyglot service — the CLI says so and asks you to pick with `--runtime` rather than guessing.

## What it changes

**`.env`** — adds `UP_LICENSE_KEY` and `UP_API_URL`. Existing keys are rewritten where they already sit, so your ordering and comments survive.

**`.gitignore`** — adds `.env` if the project is a git repo and does not already ignore it. A license key in a public repo is the most expensive mistake this tool could allow, so it is checked on every run.

**Your entry file** — for Express only, and only when the app is a plain `const app = express()`. It uses the variable name your project actually uses, puts the import with the other imports rather than above a shebang, and registers before every other `app.use`. Anything less obvious is left alone and the snippet is printed instead.

Everything else prints a copy-paste snippet. The CLI does not rewrite source it cannot read confidently.

## Zero-code alternative for Node

If you would rather not have an installer touch your source at all:

```bash
export UP_LICENSE_KEY='UP_LIVE_…'
export UP_API_URL='https://api.relintio.com/v1'
export NODE_OPTIONS='--require @relintio/agent/preload'
```

The agent wraps Node's HTTP request listener on boot and fails open on any error.

## In CI

```yaml
- run: npx relintio@latest doctor --json
- run: npx relintio@latest verify --domain ${{ vars.APP_DOMAIN }}
  env:
    UP_LICENSE_KEY: ${{ secrets.UP_LICENSE_KEY }}
```

`--yes` is implied when stdin is not a TTY, so nothing hangs waiting for input.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Done. |
| `1` | Could not proceed — bad arguments, no runtime, failed install, or a check failed. |
| `2` | `init` only: everything is in place but verification failed. |

`2` matters in a pipeline. Treating it as a hard failure will roll back a perfectly good install because a subscription lapsed.

## After install

Start in observe mode. Watch the dashboard for a day, confirm the traffic you expect is scored the way you expect, and only then turn on enforcement. Exclude health checks and inbound webhooks — machine callers score as bots by default.

## For AI agents

```bash
npx skills add relintio/skills
```

Eighteen skills covering installation, every runtime, policy tuning, diagnosis, and the HTTP API. See [Relintio/skills](https://github.com/Relintio/skills).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). This directory is mirrored from the Relintio monorepo — open pull requests there.

## Links

- [Documentation](https://relintio.com/docs)
- [Quickstarts](https://relintio.com/docs/quickstart)
- [API reference](https://relintio.com/docs/api-reference)
- [Licenses](https://relintio.com/licenses)

## License

Proprietary. See [LICENSE](./LICENSE).
