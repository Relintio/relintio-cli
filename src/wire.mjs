import fs from 'node:fs';
import path from 'node:path';
import { nodeDependencies } from './detect.mjs';

/**
 * Copy-paste wiring for every runtime the CLI cannot edit safely.
 *
 * Each entry is deliberately register-first: the agent is installed
 * before the application's own routes, so a decision is made before any
 * handler runs. Every snippet fails open — an agent that cannot reach
 * the control plane must never take the application down with it.
 */
export const SNIPPETS = {
  node: {
    file: 'your server entry file',
    code: `import express from 'express';
import { ultimateProtectorExpress } from '@relintio/agent/express';

const app = express();

// Register before your routes so every request is scored first.
app.use(ultimateProtectorExpress({
  licenseKey: process.env.UP_LICENSE_KEY,
  apiUrl: process.env.UP_API_URL,
}));
`,
  },
  // Browser runtimes take a publishable key and nothing else. This snippet
  // used to paste `licenseKey={import.meta.env.VITE_UP_LICENSE_KEY}` into an
  // app root — a bundler inlines that, so every visitor received the HMAC key
  // that signs challenge passports. The provider now refuses anything that
  // does not begin `pk_`, but the snippet is what people actually copy.
  react: {
    file: 'your app root',
    code: `import { RelintioProvider } from '@relintio/react-agent';

const config = {
  publishableKey: import.meta.env.VITE_RELINTIO_PUBLISHABLE_KEY, // pk_live_…
  apiUrl: process.env.UP_API_URL,
};

export default function App({ children }) {
  return <RelintioProvider config={config}>{children}</RelintioProvider>;
}
`,
  },
  vue: {
    file: 'src/main.ts',
    code: `import { createApp } from 'vue';
import { relintio } from '@relintio/vue-agent';
import App from './App.vue';

createApp(App)
  .use(relintio, {
    publishableKey: import.meta.env.VITE_RELINTIO_PUBLISHABLE_KEY,
    apiUrl: process.env.UP_API_URL,
  })
  .mount('#app');
`,
  },
  svelte: {
    file: 'src/routes/+layout.svelte',
    code: `<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createRelintio } from '@relintio/svelte-agent';

  const relintio = createRelintio({
    publishableKey: import.meta.env.VITE_RELINTIO_PUBLISHABLE_KEY,
  });

  onDestroy(() => relintio.destroy());
</script>
`,
  },
  angular: {
    file: 'src/main.ts',
    code: `import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRelintio, relintioInterceptor } from '@relintio/angular-agent';

bootstrapApplication(AppComponent, {
  providers: [
    provideRelintio({ publishableKey: environment.relintioPublishableKey }),
    provideHttpClient(withInterceptors([relintioInterceptor])),
  ],
});
`,
  },
  expo: {
    file: 'relintio.ts',
    code: `import { Platform } from 'react-native';
import { createRelintio } from '@relintio/expo-agent';

// domain is required on native: there is no location.hostname to read.
export const relintio = createRelintio({
  publishableKey: process.env.EXPO_PUBLIC_RELINTIO_KEY,
  domain: 'api.example.com',
  environment: { platform: Platform.OS, platformVersion: Platform.Version },
});
`,
  },
  express: {
    file: 'your server entry file',
    code: `import express from 'express';
import { relintio } from '@relintio/express';

const app = express();

// Before your routes and before any body parser: enforcement that runs after
// a 40MB upload has been read has let the request cost what it was going to.
app.use(relintio({
  licenseKey: process.env.UP_LICENSE_KEY,
  apiUrl: process.env.UP_API_URL,
  onError: (error, req) => console.error('[relintio]', req.originalUrl, error),
}));

app.use(express.json());
`,
  },
  nuxt: {
    file: 'nuxt.config.ts',
    code: `export default defineNuxtConfig({
  modules: ['@relintio/nuxt'],
  relintio: {
    // Two keys, one each side. Swapping them is refused at build time.
    licenseKey: process.env.RELINTIO_LICENSE_KEY,
    publishableKey: process.env.RELINTIO_PUBLISHABLE_KEY,
  },
});
`,
  },
  vercel: {
    file: 'middleware.js',
    code: `import { relintio } from '@relintio/vercel';

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};

export default relintio();
`,
  },
  supabase: {
    file: 'supabase/functions/<name>/index.ts',
    code: `import { withRelintio } from 'jsr:@relintio/supabase';

Deno.serve(withRelintio(async (request) => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}));
`,
  },
  firebase: {
    file: 'functions/index.js',
    code: `const { onRequest } = require('firebase-functions/v2/https');
const { createAgent, withRelintio } = require('@relintio/firebase');

// One agent shared across exports: one ruleset fetch, one set of buckets.
const agent = createAgent();

exports.api = onRequest(
  { secrets: ['RELINTIO_LICENSE_KEY'] },
  withRelintio(async (req, res) => { res.send('protected'); }, { agent }),
);
`,
  },
  python: {
    file: 'your ASGI entry point',
    code: `from relintio_agent.asgi import RelintioMiddleware

app = RelintioMiddleware(
    app,
    license_key=os.environ["UP_LICENSE_KEY"],
    api_url=os.environ["UP_API_URL"],
)
`,
  },
  php: {
    file: 'public/index.php (or your front controller)',
    code: `require __DIR__ . '/../vendor/autoload.php';

\\Relintio\\Agent::protect([
    'license_key' => getenv('UP_LICENSE_KEY'),
    'api_url'     => getenv('UP_API_URL'),
]);
`,
  },
  go: {
    file: 'your router setup',
    code: `import relintio "github.com/Relintio/relintio-golang-agent"

r := gin.Default()
r.Use(relintio.GinMiddleware(relintio.Config{
    LicenseKey: os.Getenv("UP_LICENSE_KEY"),
    APIURL:     os.Getenv("UP_API_URL"),
}))
`,
  },
  ruby: {
    file: 'config.ru',
    code: `require "relintio-agent"

use Relintio::Middleware,
    license_key: ENV["UP_LICENSE_KEY"],
    api_url:     ENV["UP_API_URL"]
`,
  },
  rust: {
    file: 'your router setup',
    code: `use relintio_agent::axum::RelintioLayer;

let app = Router::new()
    .route("/", get(handler))
    .layer(RelintioLayer::from_env());
`,
  },
  java: {
    file: 'your servlet or Spring configuration',
    code: `@Bean
public FilterRegistrationBean<RelintioFilter> relintio() {
    var registration = new FilterRegistrationBean<>(new RelintioFilter());
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
    registration.addUrlPatterns("/*");
    return registration;
}
`,
  },
  dotnet: {
    file: 'Program.cs',
    code: `using Relintio.Agent;

var app = builder.Build();

// Before UseRouting so the decision happens first.
app.UseRelintio();
`,
  },
  zig: {
    file: 'src/main.zig',
    code: `const relintio = @import("relintio");

var agent = try relintio.Agent.initFromEnv(allocator);
defer agent.deinit();
`,
  },
  wordpress: {
    file: null,
    code: null,
  },
  shopify: {
    file: null,
    code: null,
  },
};

const ENTRY_CANDIDATES = [
  'server.js',
  'server.mjs',
  'app.js',
  'app.mjs',
  'index.js',
  'index.mjs',
  'src/server.js',
  'src/app.js',
  'src/index.js',
];

/** Best guess at the file that boots this Node app. */
export function findNodeEntry(dir = process.cwd()) {
  const node = nodeDependencies(dir);
  const declared = node?.pkg?.main;

  const ordered = [];
  if (declared) ordered.push(declared);
  ordered.push(...ENTRY_CANDIDATES);

  for (const rel of ordered) {
    const full = path.join(dir, rel);
    try {
      if (fs.statSync(full).isFile()) return rel;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const IMPORT_ESM =
  "import { ultimateProtectorExpress } from '@relintio/agent/express';";
const IMPORT_CJS =
  "const { ultimateProtectorExpress } = require('@relintio/agent/express');";
const USE_BLOCK = `
// Relintio: register before your routes so every request is scored first.
app.use(ultimateProtectorExpress({
  licenseKey: process.env.UP_LICENSE_KEY,
  apiUrl: process.env.UP_API_URL,
}));`;

/**
 * Insert the Express middleware into an entry file, immediately after the
 * app is created.
 *
 * Refuses rather than guesses: if the app construction is not a plain
 * `const app = express()`, it returns `applied: false` with a reason and
 * lets the caller print the snippet instead. Running twice is a no-op.
 */
export function wireExpress(dir, entryRel) {
  const entry = path.join(dir, entryRel);
  let source;
  try {
    source = fs.readFileSync(entry, 'utf8');
  } catch (error) {
    return { applied: false, reason: `could not read ${entryRel}`, error };
  }

  if (source.includes('@relintio/agent')) {
    return { applied: false, already: true, reason: 'already wired', entry: entryRel };
  }

  const appMatch = source.match(
    /^([ \t]*)(?:const|let|var)\s+(\w+)\s*=\s*express\(\s*\)\s*;?[ \t]*$/m,
  );
  if (!appMatch) {
    return {
      applied: false,
      reason: 'could not find a plain `const app = express()` to register after',
      entry: entryRel,
    };
  }

  const [matchedLine, indent, appName] = appMatch;
  const isEsm = /^\s*import\s/m.test(source);
  const importLine = isEsm ? IMPORT_ESM : IMPORT_CJS;

  // Put the import next to the other imports, not at the very top of the file,
  // so a shebang or a "use strict" pragma is left alone.
  const importBlock = isEsm
    ? /^(?:import[\s\S]*?;[ \t]*\n)+/m
    : /^(?:(?:const|let|var)[\s\S]*?require\([\s\S]*?\)[^\n]*\n)+/m;

  const importMatch = source.match(importBlock);
  let next;
  if (importMatch) {
    const end = importMatch.index + importMatch[0].length;
    next = source.slice(0, end) + importLine + '\n' + source.slice(end);
  } else {
    next = importLine + '\n' + source;
  }

  const use = USE_BLOCK.replaceAll('app.', `${appName}.`)
    .split('\n')
    .map((l) => (l ? indent + l : l))
    .join('\n');

  const insertAt = next.indexOf(matchedLine) + matchedLine.length;
  next = next.slice(0, insertAt) + '\n' + use + next.slice(insertAt);

  return { applied: true, entry: entryRel, contents: next, appName, isEsm };
}

export function commitWiring(dir, result) {
  fs.writeFileSync(path.join(dir, result.entry), result.contents, 'utf8');
  return result;
}

/** The zero-code alternative for Node apps the CLI will not edit. */
export function preloadInstructions() {
  return `export UP_LICENSE_KEY='UP_LIVE_...'
export UP_API_URL='https://api.relintio.com/v1'
export NODE_OPTIONS='--require @relintio/agent/preload'`;
}
