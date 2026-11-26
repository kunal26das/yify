import {existsSync, readFileSync} from 'node:fs';
import {join, normalize, relative, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {brotliCompressSync, constants} from 'node:zlib';
import {request, serveExport} from './check-web-export.mjs';

export const BUDGET_ROUTES = ['/', '/search', '/title/movie/603-the-matrix'];
export const ROUTE_BUDGET_BYTES = 750_000;
export const FONT_BUDGET_BYTES = 120_000;

function attributes(tag) {
  const values = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    values[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5];
  }
  return values;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((match) => attributes(match[0]));
}

export function initialScripts(html) {
  const scripts = tags(html, 'script').map((tag) => tag.src).filter(Boolean);
  const links = tags(html, 'link').filter((tag) => {
    const rel = (tag.rel ?? '').toLowerCase().split(/\s+/);
    return rel.includes('modulepreload') || (rel.includes('preload') && (tag.as ?? '').toLowerCase() === 'script');
  }).map((tag) => tag.href).filter(Boolean);
  return [...new Set([...scripts, ...links])];
}

export function fontSources(html, readStylesheet) {
  const preloads = tags(html, 'link')
    .filter((tag) => (tag.rel ?? '').toLowerCase().split(/\s+/).includes('preload') && (tag.as ?? '').toLowerCase() === 'font')
    .map((tag) => tag.href)
    .filter(Boolean);
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  const linked = tags(html, 'link')
    .filter((tag) => (tag.rel ?? '').toLowerCase().split(/\s+/).includes('stylesheet') && tag.href)
    .map((tag) => readStylesheet(tag.href) ?? '');
  const faces = [...inline, ...linked].flatMap((css) => [...css.matchAll(/@font-face\s*\{([^}]*)\}/gi)].map((match) => match[1]));
  const urls = faces.flatMap((face) => [...face.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((match) => match[1]));
  return [...new Set([...preloads, ...urls])];
}

function clientFile(client, url) {
  if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')) return null;
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const file = normalize(join(client, path));
  return file.startsWith(client + sep) && existsSync(file) ? file : null;
}

export function brotliSize(buffer) {
  return brotliCompressSync(buffer, {params: {[constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buffer.length}}).length;
}

export async function checkWebBudget(distDirectory) {
  const failures = [];
  const report = [];
  const server = await serveExport(distDirectory);
  const client = join(server.dist, 'client');
  const compressed = new Map();
  const sizeOf = (file) => {
    if (!compressed.has(file)) compressed.set(file, brotliSize(readFileSync(file)));
    return compressed.get(file);
  };
  const readStylesheet = (url) => {
    const file = clientFile(client, url);
    return file === null ? null : readFileSync(file, 'utf8');
  };
  try {
    for (const route of BUDGET_ROUTES) {
      const response = await request(server.origin, route);
      const html = await response.text();
      if (response.status !== 200) {
        failures.push(`${route}: expected HTTP 200, received ${response.status}`);
        continue;
      }
      const scripts = initialScripts(html);
      if (scripts.length === 0) failures.push(`${route}: the HTML references no initial scripts`);
      let total = 0;
      for (const url of scripts) {
        const file = clientFile(client, url);
        if (file === null) {
          failures.push(`${route}: ${url} is not a file in ${distDirectory}/client`);
          continue;
        }
        const bytes = sizeOf(file);
        total += bytes;
        report.push({route, kind: 'script', file: relative(client, file).split(sep).join('/'), brotli: bytes});
      }
      report.push({route, kind: 'total', file: `${scripts.length} files`, brotli: total});
      if (total > ROUTE_BUDGET_BYTES) failures.push(`${route}: initial JavaScript is ${total} bytes brotli, over the ${ROUTE_BUDGET_BYTES} byte budget`);
      let fonts = 0;
      for (const url of fontSources(html, readStylesheet)) {
        const file = clientFile(client, url);
        if (file === null) {
          failures.push(`${route}: font ${url} is not a file in ${distDirectory}/client`);
          continue;
        }
        const bytes = readFileSync(file).length;
        fonts += bytes;
        report.push({route, kind: 'font', file: relative(client, file).split(sep).join('/'), brotli: bytes});
      }
      report.push({route, kind: 'fonts', file: 'preloads and @font-face sources', brotli: fonts});
      if (fonts > FONT_BUDGET_BYTES) failures.push(`${route}: fonts total ${fonts} bytes, over the ${FONT_BUDGET_BYTES} byte budget`);
    }
  } finally {
    await server.stop();
  }
  return {failures, report};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [distDirectory, ...extra] = process.argv.slice(2);
  if (!distDirectory || extra.length > 0) {
    console.error('usage: node scripts/check-web-budget.mjs <export-dir>');
    process.exit(2);
  }
  try {
    const {failures, report} = await checkWebBudget(distDirectory);
    console.table(report);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`FAIL ${failure}`);
      process.exitCode = 1;
    } else {
      console.log(`Web budget check passed: every route is within ${ROUTE_BUDGET_BYTES} bytes of brotli JavaScript and ${FONT_BUDGET_BYTES} bytes of fonts.`);
    }
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
