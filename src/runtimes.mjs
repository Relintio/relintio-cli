/**
 * Every Relintio agent runtime the CLI can install.
 *
 * Order matters: `detect()` walks this list top to bottom and the first
 * runtime whose signals match wins. That is the whole design, and it is why
 * the list is grouped the way it is.
 *
 * Platform integrations come first, because a WordPress install also contains
 * a composer.json and a Shopify theme also contains a package.json. Then the
 * meta-frameworks — Nuxt, Next, SvelteKit — because each of those is also a
 * Node project and also a framework project, and answering "Node" for a Nuxt
 * repository is technically true and useless. Then the frontend frameworks,
 * then the bare language runtimes, which are the fallbacks.
 *
 * A runtime placed below something that also matches it will never be
 * detected. `test/detect.test.mjs` pins the orderings that are load-bearing.
 */

export const RUNTIMES = [
  {
    id: 'vercel',
    label: 'Vercel',
    // A vercel.json or a .vercel directory is conclusive; a Next project
    // without either is just Next, and belongs to the framework below.
    signals: { files: ['vercel.json', '.vercel/project.json'] },
    manager: 'npm',
    pkg: '@relintio/vercel',
    docs: 'https://relintio.com/docs/quickstart/vercel',
    env: 'dotenv',
    note: 'Edge middleware runs before the application is invoked at all. Add RELINTIO_LICENSE_KEY in Project → Settings → Environment Variables.',
  },
  {
    id: 'supabase',
    label: 'Supabase',
    signals: { files: ['supabase/config.toml'] },
    manager: 'deno',
    pkg: '@relintio/supabase',
    install: null,
    docs: 'https://relintio.com/docs/quickstart/supabase',
    env: 'supabase-secrets',
    note: "Edge Functions are Deno: import from 'jsr:@relintio/supabase' — there is nothing to install. Set the licence key with `supabase secrets set`.",
  },
  {
    id: 'firebase',
    label: 'Firebase',
    signals: { files: ['firebase.json', '.firebaserc'] },
    manager: 'npm',
    pkg: '@relintio/firebase',
    docs: 'https://relintio.com/docs/quickstart/firebase',
    env: 'firebase-secrets',
    note: 'Install inside functions/, not the repository root — that is the package.json Firebase deploys. Declare the secret in the onRequest options or the function runs unprotected.',
  },
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
    id: 'nuxt',
    label: 'Nuxt',
    // Above node and vue: a Nuxt project is both, and answering "Vue" for it
    // installs the browser half and leaves Nitro unprotected.
    signals: { files: ['package.json'], deps: ['nuxt'] },
    manager: 'npm',
    pkg: '@relintio/nuxt',
    docs: 'https://relintio.com/docs/quickstart/nuxt',
    env: 'dotenv',
    note: 'Nuxt takes two keys: a licence key for Nitro and a publishable key for the browser. The module refuses to build if they are swapped.',
  },
  {
    id: 'svelte',
    label: 'Svelte',
    signals: { files: ['package.json'], deps: ['svelte', '@sveltejs/kit'] },
    manager: 'npm',
    pkg: '@relintio/svelte-agent',
    docs: 'https://relintio.com/docs/quickstart/svelte',
    env: 'dotenv',
    companion: true,
    note: 'A browser agent reacts to enforcement; it does not perform it. Pair it with a server-side agent on the same licence.',
  },
  {
    id: 'angular',
    label: 'Angular',
    signals: { files: ['angular.json'] },
    manager: 'npm',
    pkg: '@relintio/angular-agent',
    docs: 'https://relintio.com/docs/quickstart/angular',
    env: 'dotenv',
    companion: true,
    note: 'A browser agent reacts to enforcement; it does not perform it. Pair it with a server-side agent on the same licence.',
  },
  {
    id: 'expo',
    label: 'Expo',
    // Above react: an Expo app depends on react, and installing the web
    // agent into a React Native bundle gives it a DOM that is not there.
    signals: { files: ['app.json', 'app.config.js', 'app.config.ts'], deps: ['expo', 'react-native'] },
    manager: 'expo',
    pkg: '@relintio/expo-agent',
    install: ['npx', 'expo', 'install', '@relintio/expo-agent', 'react-native-webview'],
    docs: 'https://relintio.com/docs/quickstart/expo',
    env: 'dotenv',
    companion: true,
    note: 'Native has no DOM, so the device signals are a smaller, truthful subset. `domain` is required — a native app has no location.hostname to read.',
  },
  {
    id: 'vue',
    label: 'Vue',
    // Below nuxt, above node: a Vue project is a Node project.
    signals: { files: ['package.json'], deps: ['vue'] },
    manager: 'npm',
    pkg: '@relintio/vue-agent',
    docs: 'https://relintio.com/docs/quickstart/vue',
    env: 'dotenv',
    companion: true,
    note: 'A browser agent reacts to enforcement; it does not perform it. Pair it with a server-side agent on the same licence.',
  },
  {
    id: 'express',
    label: 'Express',
    // Above node: both match a package.json, and the Express adapter is the
    // better install for an Express app — same engine, one app.use().
    signals: { files: ['package.json'], deps: ['express'], notDeps: ['next', 'nuxt'] },
    manager: 'npm',
    pkg: '@relintio/express',
    docs: 'https://relintio.com/docs/quickstart/express',
    env: 'dotenv',
    note: 'Mount it before your routes and before any body parser.',
  },
  {
    id: 'node',
    label: 'Node.js',
    signals: { files: ['package.json'], notDeps: ['react', 'next', 'vue', 'svelte', 'nuxt', 'express', 'expo'] },
    manager: 'npm',
    pkg: '@relintio/agent',
    docs: 'https://relintio.com/docs/quickstart/node',
    env: 'dotenv',
  },
  {
    id: 'react',
    label: 'React',
    // Last of the frontend frameworks: Expo, Nuxt and the rest all depend on
    // react or are also react projects, so they have to be matched first.
    signals: { files: ['package.json'], deps: ['react', 'next'] },
    manager: 'npm',
    pkg: '@relintio/react-agent',
    docs: 'https://relintio.com/docs/quickstart/react',
    env: 'dotenv',
    companion: true,
    note: 'A browser agent reacts to enforcement; it does not perform it. Pair it with a server-side agent on the same licence.',
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
