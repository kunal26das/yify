import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join, posix, relative, sep} from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import policy from '../../tests/policy/bannedStrings.cjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SHARED = 'app/(tabs)/(home,search,library,you)';

const API_FILES = [
  'home', 'discover', 'search', 'title/[type]/[id]', 'title/[type]/[id]/season/[season]', 'person/[id]', 'genres', 'regions',
  'providers', 'availability', 'find/[imdbId]', 'legacy/movie/[v1Id]', 'resolve', 'geo', 'health', 'img/[size]/[file]',
].map((route) => `app/api/v2/${route}+api.ts`);

const WEB_TWINS = [
  `${SHARED}/title/movie/[id].web.tsx`,
  `${SHARED}/title/tv/[id]/index.web.tsx`,
  `${SHARED}/person/[id].web.tsx`,
];

const STATIC_METADATA: Readonly<Record<string, string>> = {
  'app/(tabs)/(home)/index.tsx': 'home',
  'app/(tabs)/(search)/search.tsx': 'search',
  'app/(tabs)/(library)/library/index.tsx': 'watchlist',
  'app/(tabs)/(library)/library/watched.tsx': 'watched',
  'app/(tabs)/(library)/library/lists.tsx': 'lists',
  'app/(tabs)/(library)/library/recent.tsx': 'recent',
  'app/(tabs)/(library)/list/[id].tsx': 'list',
  'app/(tabs)/(you)/you.tsx': 'you',
  'app/(tabs)/(you)/plus.tsx': 'plus',
  'app/(tabs)/(you)/settings/index.tsx': 'settings',
  'app/(tabs)/(you)/settings/appearance.tsx': 'appearance',
  'app/(tabs)/(you)/settings/streaming.tsx': 'streaming',
  'app/(tabs)/(you)/settings/privacy.tsx': 'privacy',
  'app/(tabs)/(you)/settings/account.tsx': 'account',
  'app/(tabs)/(you)/settings/about.tsx': 'about',
};

const APP_FILES = [
  'app/_layout.tsx',
  'app/+html.tsx',
  'app/+not-found.tsx',
  'app/+middleware.ts',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/(library)/library/_layout.tsx',
  ...Object.keys(STATIC_METADATA),
  `${SHARED}/_layout.tsx`,
  `${SHARED}/title/movie/[id].tsx`,
  `${SHARED}/title/tv/[id]/index.tsx`,
  `${SHARED}/title/tv/[id]/season/[season].tsx`,
  `${SHARED}/person/[id].tsx`,
  ...WEB_TWINS,
  'app/movies.tsx',
  'app/shows.tsx',
  'app/movie/[id].tsx',
  'app/show/[imdbId].tsx',
  'app/sitemap.xml+api.ts',
  'app/sitemaps/[name]+api.ts',
  ...API_FILES,
  'app/api/catalog/[operation]+api.ts',
  'app/__/auth/[...path]+api.ts',
  'app/__/firebase/[...path]+api.ts',
];

const ALLOWED_TWIN_PREFIXES = ['src/core/platform/', 'src/core/ui/'];
const ALLOWED_TWIN_FILES = ['src/core/api/baseUrl.web.ts', 'src/core/query/lifecycle.web.ts', 'src/core/storage/kv.web.ts', ...WEB_TWINS];
const FEATURE_PLATFORM = /^src\/features\/[^/]+\/platform\//;
const SOURCE_FILE = /\.(?:ts|tsx|js|cjs|mjs)$/;
const TEXT_FILE = /\.(?:ts|tsx|js|cjs|mjs|json|css|html|md|txt|svg|xml)$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$|\/testing\//;
const MAX_ROUTE_LINES = 30;
const SERVER_ENTRY = /^app\/(?:.*\+api\.ts|\+middleware\.ts)$/;
const SERVER_ENTRY_TARGETS = ['src/server/', 'src/core/domain/', 'src/core/config/'];

const SDK_RULES: readonly {packages: RegExp; allowed: readonly string[]}[] = [
  {packages: /^react-native-google-mobile-ads$/, allowed: ['src/features/monetization/platform/']},
  {packages: /^(?:react-native-purchases|@revenuecat\/purchases-js)$/, allowed: ['src/features/monetization/platform/']},
  {packages: /^(?:react-native-youtube-iframe|react-native-webview)$/, allowed: ['src/features/player/platform/']},
  {packages: /^@sentry\/(?:react-native|browser)$/, allowed: ['src/core/platform/telemetry/']},
  {packages: /^(?:@react-native-firebase\/.+|firebase)$/, allowed: ['src/core/platform/auth/', 'src/core/platform/firebase/', 'src/core/platform/telemetry/']},
  {packages: /^@react-native-google-signin\/google-signin$/, allowed: ['src/core/platform/auth/']},
  {packages: /^expo-sqlite$/, allowed: ['src/core/storage/']},
  {packages: /^(?:expo-in-app-updates|expo-updates)$/, allowed: ['src/core/platform/updates/', 'src/core/platform/telemetry/']},
  {packages: /^(?:expo-network|expo-localization|expo-web-browser|expo-linking|expo-haptics)$/, allowed: ['src/core/platform/']},
  {packages: /^@tanstack\/react-query$/, allowed: ['src/core/query/', 'src/core/api/', 'src/features/']},
];

interface ImportRef {
  specifier: string;
  kind: 'static' | 'type' | 'dynamic' | 'require';
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function walk(directory: string): string[] {
  const absolute = join(ROOT, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, {withFileTypes: true}).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const path = posix.join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function importsOf(text: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const match of text.matchAll(/\b(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    if (match[1] === 'export' && !/\sfrom\s/.test(match[0])) continue;
    refs.push({specifier: match[3], kind: match[2] ? 'type' : 'static'});
  }
  for (const match of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.push({specifier: match[1], kind: 'dynamic'});
  for (const match of text.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) refs.push({specifier: match[1], kind: 'require'});
  return refs;
}

function isLocal(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('@assets/');
}

function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function resolveLocal(file: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith('.')) return toPosix(relative(ROOT, join(ROOT, dirname(file), specifier)));
  return null;
}

function closingIndex(text: string, open: number, opener: string, closer: string): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === opener) depth += 1;
    else if (text[index] === closer) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function exportedFunction(text: string, name: string): {async: boolean; body: string} | 'declaration' | null {
  const declared = new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\s*\\(`).exec(text);
  if (declared === null) {
    const other = new RegExp(`export\\s+(?:const|let|var)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text);
    return other ? 'declaration' : null;
  }
  const paramsOpen = declared.index + declared[0].length - 1;
  const paramsClose = closingIndex(text, paramsOpen, '(', ')');
  const bodyOpen = text.indexOf('{', paramsClose);
  const bodyClose = closingIndex(text, bodyOpen, '{', '}');
  return {async: declared[1] !== undefined, body: text.slice(bodyOpen + 1, bodyClose).replace(/\s+/g, ' ').trim()};
}

const sourceFiles = [...walk('src'), ...walk('app')].filter((path) => SOURCE_FILE.test(path));
const runtimeFiles = sourceFiles.filter((path) => !TEST_FILE.test(path));
const appFiles = walk('app');

test('1. src/app does not exist, so the router root stays app/', () => {
  assert.equal(existsSync(join(ROOT, 'src/app')), false, 'src/app/ must never exist');
});

test('2. app/ holds exactly the A7.1 route files', () => {
  const expected = new Set(APP_FILES);
  const actual = new Set(appFiles);
  const violations = [
    ...APP_FILES.filter((path) => !actual.has(path)).map((path) => `missing: ${path}`),
    ...appFiles.filter((path) => !expected.has(path)).map((path) => `unlisted: ${path}`),
  ];
  assert.deepEqual(violations, []);
  assert.equal(APP_FILES.length, expected.size, 'the A7.1 list has duplicates');
});

test('3. route files are adapters of at most 30 lines and the document renders WebDocument', () => {
  const violations: string[] = [];
  for (const path of appFiles) {
    const lines = read(path).replace(/\n$/, '').split('\n').length;
    if (lines > MAX_ROUTE_LINES) violations.push(`${path}: ${lines} lines`);
  }
  const html = read('app/+html.tsx');
  if (!/from\s+'@\/core\/ui\/document\/WebDocument'/.test(html) || !/<WebDocument[\s>]/.test(html)) {
    violations.push('app/+html.tsx: must render WebDocument from src/core/ui/document/WebDocument.tsx');
  }
  assert.deepEqual(violations, []);
});

test('4. no barrel index files under src/', () => {
  assert.deepEqual(walk('src').filter((path) => /\/index\.tsx?$/.test(path)), []);
});

test('5. platform twins live only in the allowed folders, named adapters and route twins', () => {
  const twins = [...walk('src'), ...appFiles].filter((path) => /\.web\.tsx?$/.test(path));
  const violations = twins.filter((path) => !ALLOWED_TWIN_FILES.includes(path)
    && !ALLOWED_TWIN_PREFIXES.some((prefix) => path.startsWith(prefix))
    && !FEATURE_PLATFORM.test(path));
  assert.deepEqual(violations, []);
});

test('6. loader and generateMetadata exports follow the twin and static-route rules', () => {
  const violations: string[] = [];
  const exporting = new Set<string>();
  for (const path of appFiles.filter((file) => file.endsWith('.tsx'))) {
    const text = read(path);
    if (/from\s+['"]@\/server\//.test(text)) violations.push(`${path}: static import of @/server`);
    for (const match of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!WEB_TWINS.includes(path)) violations.push(`${path}: dynamic import ${match[1]} outside the web twins`);
      else if (!match[1].startsWith('@/server/seo/')) violations.push(`${path}: dynamic import ${match[1]} is not under @/server/seo/`);
    }
    for (const name of ['loader', 'generateMetadata']) {
      const found = exportedFunction(text, name);
      if (found === null) continue;
      if (found === 'declaration') {
        violations.push(`${path}: ${name} must be an exported function declaration, not a re-export or variable`);
        continue;
      }
      if (name === 'generateMetadata') exporting.add(path);
      if (WEB_TWINS.includes(path)) {
        if (!found.async) violations.push(`${path}: ${name} must be async`);
        if (!/^const \{(\w+)\} = await import\('@\/server\/seo\/[\w/]+'\); return \1\([^;]*\);$/.test(found.body)) {
          violations.push(`${path}: ${name} body must be one await import('@/server/seo/...') and one call`);
        }
        continue;
      }
      const page = STATIC_METADATA[path];
      if (name === 'loader' || page === undefined) {
        violations.push(`${path}: ${name} is exported only by the three web twins${name === 'generateMetadata' ? ' and the C3.2 static routes' : ''}`);
        continue;
      }
      if (found.async) violations.push(`${path}: the static generateMetadata must be synchronous`);
      if (found.body !== `return staticMetadata('${page}', request?.headers.get('x-forwarded-host') ?? null);`) {
        violations.push(`${path}: generateMetadata must return staticMetadata('${page}', <x-forwarded-host>) only`);
      }
      if (!/import\s*\{[^}]*\bstaticMetadata\b[^}]*\}\s*from\s*'@\/core\/config\/seo'/.test(text)) {
        violations.push(`${path}: staticMetadata must come from @/core/config/seo`);
      }
    }
  }
  for (const path of [...WEB_TWINS, ...Object.keys(STATIC_METADATA)]) {
    if (!exporting.has(path)) violations.push(`${path}: must export generateMetadata`);
  }
  assert.deepEqual(violations, []);
});

test('7. third-party SDKs stay in their adapter folders', () => {
  const violations: string[] = [];
  for (const path of runtimeFiles) {
    for (const ref of importsOf(read(path))) {
      if (isLocal(ref.specifier)) continue;
      const name = packageName(ref.specifier);
      if (path.startsWith('src/core/domain/') || path.startsWith('src/core/config/')) {
        violations.push(`${path}: imports the package ${ref.specifier}`);
        continue;
      }
      if (path.startsWith('src/server/') && !(ref.kind === 'type' && ref.specifier === 'expo-router/server')) {
        violations.push(`${path}: server code may only import type from expo-router/server, not ${ref.kind} ${ref.specifier}`);
        continue;
      }
      const rule = SDK_RULES.find((candidate) => candidate.packages.test(name));
      if (rule !== undefined && !rule.allowed.some((prefix) => path.startsWith(prefix))) {
        violations.push(`${path}: ${ref.specifier} is allowed only in ${rule.allowed.join(', ')}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('8. no banned strings in src/ or app/, and the TMDB API host only in server code', () => {
  const violations: string[] = [];
  const files = [...walk('src'), ...appFiles].filter((path) => TEXT_FILE.test(path) && !TEST_FILE.test(path));
  for (const path of files) {
    const text = read(path);
    if (!path.startsWith('src/server/legacy/')) {
      for (const pattern of policy.bannedMatches(text)) violations.push(`${path}: matches ${pattern}`);
    }
    if (!path.startsWith('src/server/') && text.includes('api.themoviedb.org')) violations.push(`${path}: names the TMDB API host`);
  }
  assert.deepEqual(violations, []);
});

test('9. feature public files export something and import only public files of other features', () => {
  const violations: string[] = [];
  for (const path of runtimeFiles.filter((file) => /^src\/features\/[^/]+\/public\/[^/]+$/.test(file))) {
    const own = path.split('/')[2];
    const text = read(path);
    if (!/^\s*export\s/m.test(text)) violations.push(`${path}: exports nothing`);
    for (const ref of importsOf(text)) {
      const target = resolveLocal(path, ref.specifier);
      const feature = target === null ? null : /^src\/features\/([^/]+)\/(.*)$/.exec(target);
      if (feature !== null && feature[1] !== own && !feature[2].startsWith('public/')) {
        violations.push(`${path}: imports ${ref.specifier}, a non-public file of features/${feature[1]}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('10. API routes and the middleware import only server, domain and config code', () => {
  const violations: string[] = [];
  for (const path of appFiles.filter((file) => SERVER_ENTRY.test(file))) {
    for (const ref of importsOf(read(path))) {
      const target = resolveLocal(path, ref.specifier);
      if (target !== null && SERVER_ENTRY_TARGETS.some((prefix) => target.startsWith(prefix))) continue;
      if (ref.kind === 'type' && ref.specifier === 'expo-router/server') continue;
      violations.push(`${path}: ${ref.kind} import of ${ref.specifier}; API routes and the middleware may import only src/server, src/core/domain, src/core/config and types from expo-router/server`);
    }
  }
  assert.deepEqual(violations, []);
});
