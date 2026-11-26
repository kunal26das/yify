import {spawn} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const {bannedMatches} = createRequire(import.meta.url)('../tests/policy/bannedStrings.cjs');

export const HTML_ROUTES = ['/', '/search', '/library', '/you', '/plus', '/title/movie/603-the-matrix', '/person/6384-keanu-reeves'];
export const CLIENT_MARKERS = ['api.themoviedb.org', 'TMDB_API_KEY', 'YIFY_API_FIXTURES'];
export const LEGAL_PAGES = new Set();
const TEXT_FILE = /\.(?:js|mjs|cjs|map|css|html|json|txt|xml|webmanifest|svg)$/;
const READY_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 30_000;

export function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function delay(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

export async function serveExport(distDirectory) {
  const dist = resolve(ROOT, distDirectory);
  if (!existsSync(join(dist, 'server')) || !existsSync(join(dist, 'client'))) {
    throw new Error(`${relative(ROOT, dist) || dist} is not a server-output web export (expected client/ and server/). Run yarn export:web first.`);
  }
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, [join(ROOT, 'node_modules/expo/bin/cli'), 'serve', dist, '--port', String(port)], {
    cwd: ROOT,
    env: {...process.env, YIFY_API_FIXTURES: '1', CI: '1', EXPO_NO_TELEMETRY: '1'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  let exited = null;
  child.on('exit', (code, signal) => {
    exited = {code, signal};
  });
  const stop = async () => {
    if (exited !== null) return;
    child.kill('SIGTERM');
    for (let waited = 0; exited === null && waited < 5000; waited += 100) await delay(100);
    if (exited === null) child.kill('SIGKILL');
  };
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited !== null) throw new Error(`expo serve exited (${exited.code ?? exited.signal}) before it answered:\n${output.join('')}`);
    try {
      await fetch(`${origin}/api/v2/health`, {signal: AbortSignal.timeout(2000)});
      return {origin, dist, stop, output};
    } catch {
      await delay(250);
    }
  }
  await stop();
  throw new Error(`expo serve did not answer within ${READY_TIMEOUT_MS / 1000} s:\n${output.join('')}`);
}

export async function request(origin, path, init = {}) {
  return fetch(new URL(path, origin), {redirect: 'manual', ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
}

export function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function documentTitle(html) {
  return /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
}

async function checkRoutes(origin, failures, rows) {
  for (const path of HTML_ROUTES) {
    const response = await request(origin, path);
    const html = await response.text();
    const type = response.headers.get('content-type') ?? '';
    rows.push({path, status: response.status, bytes: Buffer.byteLength(html), title: documentTitle(html) ?? '(none)'});
    if (response.status !== 200) failures.push(`${path}: expected HTTP 200, received ${response.status}`);
    if (!type.includes('text/html')) failures.push(`${path}: expected text/html, received ${type || 'no content type'}`);
    if (!/<div[^>]*\bid="root"/.test(html)) failures.push(`${path}: the server HTML has no root element (<div id="root">)`);
    if (visibleText(html).includes('18+')) failures.push(`${path}: the page text contains "18+"`);
  }
}

async function checkHealth(origin, failures, rows) {
  const response = await request(origin, '/api/v2/health');
  const text = await response.text();
  rows.push({path: '/api/v2/health', status: response.status, bytes: Buffer.byteLength(text), title: response.headers.get('content-type') ?? ''});
  if (response.status !== 200) failures.push(`/api/v2/health: expected HTTP 200, received ${response.status}`);
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) failures.push('/api/v2/health: expected a JSON response');
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    failures.push('/api/v2/health: the body is not JSON');
  }
  if (body !== null && (body.v !== 2 || body.ok !== true || body.tmdbKey !== 'fixtures')) {
    failures.push(`/api/v2/health: expected {v: 2, ok: true, tmdbKey: "fixtures"}, received ${text}`);
  }
}

function checkClientFiles(dist, failures, notes) {
  const client = join(dist, 'client');
  let scanned = 0;
  const exempted = new Set();
  for (const file of filesUnder(client).filter((path) => TEXT_FILE.test(path))) {
    const path = relative(client, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    scanned += 1;
    const matches = bannedMatches(text);
    if (matches.length > 0) {
      if (LEGAL_PAGES.has(path)) {
        exempted.add(path);
        notes.push(`${path}: ${matches.join(' ')} (legal page owned by Stream C, C6.8 item 8; not a client bundle)`);
      } else failures.push(`dist/client/${path}: matches ${matches.join(' ')}`);
    }
    if (/\.(?:js|mjs|cjs|map)$/.test(path)) {
      for (const marker of CLIENT_MARKERS) {
        if (text.includes(marker)) failures.push(`dist/client/${path}: contains the server-only marker ${marker}`);
      }
    }
  }
  if (scanned === 0) failures.push('dist/client: no client files to scan');
  for (const path of LEGAL_PAGES) {
    if (!exempted.has(path)) failures.push(`dist/client/${path}: no longer needs the legal-page exemption; remove it from LEGAL_PAGES`);
  }
  return scanned;
}

export async function checkWebExport(distDirectory) {
  const failures = [];
  const notes = [];
  const rows = [];
  const server = await serveExport(distDirectory);
  try {
    await checkRoutes(server.origin, failures, rows);
    await checkHealth(server.origin, failures, rows);
  } finally {
    await server.stop();
  }
  const scanned = checkClientFiles(server.dist, failures, notes);
  return {failures, notes, rows, scanned};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [distDirectory, ...extra] = process.argv.slice(2);
  if (!distDirectory || extra.length > 0) {
    console.error('usage: node scripts/check-web-export.mjs <export-dir>');
    process.exit(2);
  }
  try {
    const {failures, notes, rows, scanned} = await checkWebExport(distDirectory);
    console.table(rows);
    console.log(`Scanned ${scanned} text files in ${distDirectory}/client for banned strings and server-only markers.`);
    for (const note of notes) console.log(`note: ${note}`);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exitCode = 1;
    } else {
      console.log(`Web export check passed: ${HTML_ROUTES.length} HTML routes and /api/v2/health answered from fixtures.`);
    }
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
