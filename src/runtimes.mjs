/**
 * The twelve Relintio agent runtimes.
 *
 * Order matters: `detect()` walks this list top to bottom and the first
 * runtime whose signals match wins. Platform integrations (WordPress,
 * Shopify) sit above the generic language runtimes because a WordPress
 * install also contains a composer.json, and a Shopify theme also
 * contains a package.json.
 */

export const RUNTIMES = [
  {
    id: 'wordpress',
    label: 'WordPress',
    // any one of these is conclusive
    signals: { files: ['wp-config.php', 'wp-settings.php', 'wp-load.php'] },
    manager: 'wp',
    pkg: 'relintio-agent',
    install: ['wp', 'plugin', 'install', './relintio-agent.zip', '--activate'],
    docs: 'https://relintio.com/docs/quickstart/wordpress',
    env: 'wp-config',
    note: 'Download the plugin zip from the dashboard, then activate it.',
  },
  {
    id: 'shopify',
    label: 'Shopify',
    signals: { files: ['shopify.app.toml', '.shopify/project.json'] },
    manager: 'shopify',
    pkg: null,
    install: null,
    docs: 'https://relintio.com/docs/shopify',
    env: 'dashboard',
    note: 'Shopify is installed from the Relintio dashboard as a ScriptTag; there is nothing to install locally.',
  },
  {
    id: 'node',
    label: 'Node.js',
    signals: { files: ['package.json'], notDeps: ['react', 'next'] },
    manager: 'npm',
    pkg: '@relintio/agent',
    docs: 'https://relintio.com/docs/quickstart/node',
    env: 'dotenv',
  },
  {
    id: 'react',
    label: 'React',
    signals: { files: ['package.json'], deps: ['react', 'next'] },
    manager: 'npm',
    pkg: '@relintio/react-agent',
    docs: 'https://relintio.com/docs/quickstart/react',
    env: 'dotenv',
    companion: true,
    note: 'The React agent is a client-side companion. It reports signals but it cannot enforce policy — pair it with a server-side agent on the same license.',
  },
  {
    id: 'python',
    label: 'Python',
    signals: { files: ['pyproject.toml', 'requirements.txt', 'Pipfile', 'setup.py', 'manage.py'] },
    manager: 'pip',
    pkg: 'relintio-agent',
    docs: 'https://relintio.com/docs/quickstart/python',
    env: 'dotenv',
  },
  {
    id: 'php',
    label: 'PHP',
    signals: { files: ['composer.json', 'artisan'] },
    manager: 'composer',
    pkg: 'relintio-agent/agent',
    docs: 'https://relintio.com/docs/quickstart/php',
    env: 'dotenv',
  },
  {
    id: 'go',
    label: 'Go',
    signals: { files: ['go.mod'] },
    manager: 'go',
    pkg: 'github.com/Relintio/relintio-golang-agent',
    docs: 'https://relintio.com/docs/quickstart/go',
    env: 'dotenv',
  },
  {
    id: 'ruby',
    label: 'Ruby',
    signals: { files: ['Gemfile', 'config.ru', '*.gemspec'] },
    manager: 'bundler',
    pkg: 'relintio-agent',
    docs: 'https://relintio.com/docs/quickstart/ruby',
    env: 'dotenv',
  },
  {
    id: 'rust',
    label: 'Rust',
    signals: { files: ['Cargo.toml'] },
    manager: 'cargo',
    pkg: 'relintio-agent',
    docs: 'https://relintio.com/docs/quickstart/rust',
    env: 'dotenv',
  },
  {
    id: 'java',
    label: 'Java',
    signals: { files: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
    manager: 'maven',
    pkg: 'com.relintio:relintio-agent',
    docs: 'https://relintio.com/docs/quickstart/java',
    env: 'dotenv',
  },
  {
    id: 'dotnet',
    label: '.NET',
    signals: { globs: ['*.csproj', '*.fsproj', '*.sln'] },
    manager: 'dotnet',
    pkg: 'Relintio.Agent',
    docs: 'https://relintio.com/docs/quickstart/dotnet',
    env: 'dotenv',
  },
  {
    id: 'zig',
    label: 'Zig',
    signals: { files: ['build.zig', 'build.zig.zon'] },
    manager: 'zig',
    pkg: 'relintio',
    docs: 'https://relintio.com/docs/quickstart/zig',
    env: 'dotenv',
  },
];

export const BY_ID = Object.fromEntries(RUNTIMES.map((r) => [r.id, r]));

/** Install argv for a runtime, given the package manager actually in use. */
export function installCommand(runtime, manager) {
  const pkg = runtime.pkg;
  switch (runtime.id) {
    case 'node':
    case 'react':
      if (manager === 'yarn') return ['yarn', 'add', pkg];
      if (manager === 'pnpm') return ['pnpm', 'add', pkg];
      if (manager === 'bun') return ['bun', 'add', pkg];
      return ['npm', 'install', pkg];
    case 'python':
      if (manager === 'poetry') return ['poetry', 'add', pkg];
      if (manager === 'uv') return ['uv', 'add', pkg];
      return ['pip', 'install', pkg];
    case 'php':
      return ['composer', 'require', pkg];
    case 'go':
      return ['go', 'get', pkg];
    case 'ruby':
      return ['bundle', 'add', pkg];
    case 'rust':
      return ['cargo', 'add', pkg];
    case 'java':
      return ['mvn', 'dependency:get', `-Dartifact=${pkg}:LATEST`];
    case 'dotnet':
      return ['dotnet', 'add', 'package', pkg];
    case 'zig':
      return ['zig', 'fetch', '--save', 'https://github.com/Relintio/relintio-zig-agent/archive/refs/heads/main.tar.gz'];
    case 'wordpress':
      return runtime.install;
    default:
      return null;
  }
}
