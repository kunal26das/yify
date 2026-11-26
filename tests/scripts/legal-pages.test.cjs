const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const brand = require('../../config/brand.json');
const fontSubsets = require('../../src/core/ui/theme/fontSubsets.json');
const {bannedMatches} = require('../policy/bannedStrings.cjs');

const root = path.resolve(__dirname, '../..');
const publicDir = path.join(root, 'public');
const PAGES = ['privacy', 'terms', 'support', 'delete-account'];
const APP_ROUTES = new Set(['/', '/plus']);
const BANNED_PHRASES = [
  /18 or older/i, /aged 18/i, /adults only/i, /for adults/i, /file listings/i, /buy me a coffee/i,
  /sign-in is required for purchases/i, /\byts\b/i, /eztv/i, /nyaa/i,
];
const SUPPORT_EMAIL = /export const SUPPORT_EMAIL = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'src/core/config/legal.ts'), 'utf8'))[1];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const name = brand.appName;

function htmlFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.name.endsWith('.html') ? [file] : [];
  });
}

function read(page) {
  return fs.readFileSync(path.join(publicDir, `${page}.html`), 'utf8');
}

function visibleText(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/i, ' ')
    .replace(/<\/?(?:a|span|strong|em|code|time)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('no public page carries v1 adult, download, tip-jar or retired-catalog language', () => {
  const files = htmlFiles(publicDir);
  assert.ok(files.length >= PAGES.length * 2);
  for (const file of [...files, path.join(publicDir, 'legal.css')]) {
    const text = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ');
    const relative = path.relative(root, file);
    for (const phrase of BANNED_PHRASES) assert.doesNotMatch(text, phrase, `${relative} contains ${phrase}`);
    assert.deepEqual(bannedMatches(text), [], `${relative} matches tests/policy/bannedStrings.cjs`);
    assert.doesNotMatch(text, /kunal26das\.github\.io|adsense|autoplay/i, relative);
  }
});

test('every legal page has a byte-identical folder twin', () => {
  for (const page of PAGES) {
    const twin = fs.readFileSync(path.join(publicDir, page, 'index.html'), 'utf8');
    assert.equal(twin, read(page), `public/${page}/index.html must equal public/${page}.html`);
  }
});

test('every legal page is a static document that loads brand.css before legal.css and nothing else', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /^<!doctype html>\n<html lang="en">/, page);
    assert.match(html, /<meta charset="utf-8">/, page);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, page);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://yify\\.expo\\.app/${page}\\.html">`), page);
    const stylesheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((match) => match[1]);
    assert.deepEqual(stylesheets, ['/brand.css', '/legal.css'], page);
    assert.doesNotMatch(html, /<script\b|<style\b|\sstyle="|\son[a-z]+="/i, `${page} must not run code or carry inline styles`);
    const colours = html.replace(/\s(?:href|id|aria-labelledby)="[^"]*"/g, '');
    assert.doesNotMatch(colours, /#[0-9a-f]{3,8}\b|rgba?\(/i, `${page} must take every colour from brand.css`);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${page} has one h1`);
    assert.match(html, /<a class="skip" href="#main">Skip to content<\/a>/, page);
    assert.match(html, /<main id="main">/, page);
    assert.match(html, new RegExp(`<a href="/${page}\\.html" aria-current="page">`), `${page} marks itself in the header`);
  }
});

test('every page wraps the app name in app-name spans so yarn brand:stamp can rename it', () => {
  const word = new RegExp(`\\b(?:${[...new Set([name, 'Yify'])].map(escape).join('|')})\\b`);
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, new RegExp(`<title>[^<]+ · ${escape(name)}</title>`), `${page} title ends with " · ${name}"`);
    assert.ok((html.match(/<span class="app-name">/g) ?? []).length >= 3, page);
    for (const span of html.matchAll(/<span class="app-name">([^<]*)<\/span>/g)) assert.equal(span[1], name, page);
    const rest = html.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<span class="app-name">[^<]*<\/span>/g, '');
    const stray = rest.split('\n').filter((line) => word.test(line));
    assert.deepEqual(stray, [], `${page} names the app outside <span class="app-name">`);
  }
});

test('links resolve to published files, app routes or anchors on the same page', () => {
  for (const page of PAGES) {
    const html = read(page);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const [, attribute, target] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
      if (target.startsWith('#')) {
        assert.ok(ids.has(target.slice(1)), `${page}: ${target} has no matching id`);
      } else if (target.startsWith('/')) {
        const [file, anchor] = target.split('#');
        if (APP_ROUTES.has(file)) continue;
        assert.ok(fs.existsSync(path.join(publicDir, file)), `${page}: ${attribute}="${target}" is not a file in public/`);
        if (anchor) {
          const other = fs.readFileSync(path.join(publicDir, file), 'utf8');
          assert.match(other, new RegExp(`\\sid="${escape(anchor)}"`), `${page}: ${target} has no matching id`);
        }
      } else {
        assert.match(target, /^(?:https:\/\/|mailto:)/, `${page}: ${target} must be https or mailto`);
      }
    }
  }
});

test('the pages publish only the support address the app already uses and no other contact data', () => {
  for (const page of PAGES) {
    const html = read(page);
    const emails = new Set(html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi));
    assert.deepEqual([...emails], [SUPPORT_EMAIL], page);
    for (const link of html.matchAll(/href="mailto:([^"]+)"/g)) assert.equal(link[1], SUPPORT_EMAIL, page);
    assert.doesNotMatch(html, /href="tel:|\+\d{6,}|\d{10,}/, `${page} must not publish a phone number`);
  }
});

test('the privacy policy describes the v2 providers and data flows', () => {
  const html = read('privacy');
  const text = visibleText(html);
  assert.match(html, /<h1>Privacy Policy<\/h1>/);
  assert.ok(html.includes('https://policies.google.com/privacy'));
  assert.ok(text.includes(`${name} uses YouTube API Services to play trailers. When you play a trailer, YouTube receives your IP address and what you watch, and may set cookies. Google's Privacy Policy applies: https://policies.google.com/privacy.`));
  assert.ok(text.includes(`${name} is not directed to children under 13. We do not knowingly collect personal information from children under 13.`));
  for (const provider of ['Firebase Authentication', 'Cloud Firestore', 'Google Analytics for Firebase', 'Sentry', 'AdMob',
    "Google's User Messaging Platform", 'RevenueCat', 'Google Play', 'EAS Update', 'EAS Hosting', 'image.tmdb.org', 'JustWatch', 'TMDB']) {
    assert.ok(text.includes(provider), `the privacy policy names ${provider}`);
  }
  for (const fact of ['random installation ID', 'random app user ID', 'does not store your IP address', 'off until you allow it',
    'never on our servers', 'You › Settings › Privacy', 'at most 25 error reports']) {
    assert.ok(text.includes(fact), `the privacy policy states "${fact}"`);
  }
  assert.ok(text.includes('https://yify.expo.app') || html.includes('href="https://yify.expo.app/"'));
  assert.doesNotMatch(text, /\biOS\b|desktop|connects directly to TMDB|adult/i);
  assert.match(html, new RegExp(`<h2 id="older-versions">\\d+\\. <span class="app-name">${escape(name)}</span> 1\\.8 and earlier \\(Android\\)</h2>`),
    'keep the 1.8 section until 2.0.0 is at 100 % and no track distributes 1.8.x (I-60)');
  const older = visibleText(html.slice(html.indexOf('id="older-versions"'), html.indexOf('id="changes"')));
  for (const item of ['Firebase Crashlytics', 'location permission', 'notifications', 'EAS Insights', 'third-party catalog services through our legacy API']) {
    assert.ok(older.includes(item), `the 1.8 section lists ${item}`);
  }
});

test('the terms cover what the service provides, Plus and the YouTube terms', () => {
  const text = visibleText(read('terms'));
  assert.ok(read('terms').includes('https://www.youtube.com/t/terms'));
  for (const sentence of [
    `${name} does not host, stream or sell movies or TV shows.`,
    'By playing trailers you agree to be bound by the YouTube Terms of Service: https://www.youtube.com/t/terms.',
    'Plus list storage has a fair-use limit of 100 lists and 2,000 listed titles per account.',
    'This product uses the TMDB API but is not endorsed or certified by TMDB.',
    `no ${name} ads in the Android app`, 'unlimited lists', 'your year in review', 'accent themes',
    "You don't need an account to buy it.", 'Subscriptions renew automatically until you cancel them.',
  ]) {
    assert.ok(text.includes(sentence), `the terms state "${sentence}"`);
  }
  assert.match(text, /Copyright and takedown notices .*good faith/);
  assert.doesNotMatch(text, /You must be at least|customer portal|Apple|App Store/i);
});

test('the support page carries the v2 Plus copy and opens the Plus page', () => {
  const html = read('support');
  const text = visibleText(html);
  for (const sentence of [
    'Support an independent app and unlock a few extras.',
    `${name} shows an occasional full-screen ad on Android. Plus turns it off. YouTube and streaming services may still show their own ads.`,
    'Without Plus you can keep 3 custom lists. Plus lifts the limit (fair use: up to 100 lists).',
    'Diary insights: titles watched, hours, top genres and your ratings, by month and year.',
    'Choose an accent color for the app.',
    'Renews automatically until you cancel. Cancel anytime in Google Play › Payments & subscriptions. Plus stays active until the end of the paid period.',
    'No account needed. Sign in later to use Plus on the web too.',
    "Restoring moves Plus to the account you're signed in with",
  ]) {
    assert.ok(text.includes(sentence), `the support page states "${sentence}"`);
  }
  assert.ok(html.includes('href="/plus"'));
  assert.doesNotMatch(html, /\/upgrade|source=website|\bNo ads\b/);
});

test('the account deletion page gives the v2 path and what deletion leaves behind', () => {
  const text = visibleText(read('delete-account'));
  for (const fact of ['You › Settings › Account › Delete account', 'empty deletion marker', 'RevenueCat', 'does not cancel it',
    'Finish deleting account', 'within 30 days']) {
    assert.ok(text.includes(fact), `the deletion page states "${fact}"`);
  }
});

test('legal.css uses only the stamped brand colours, the brand faces and no serif', () => {
  const css = fs.readFileSync(path.join(publicDir, 'legal.css'), 'utf8');
  const brandCss = fs.readFileSync(path.join(publicDir, 'brand.css'), 'utf8');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'no hex colours');
  assert.doesNotMatch(css, /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i, 'no colour functions');
  assert.doesNotMatch(css.replace(/sans-serif/g, ''), /serif|georgia|times|lora/i, 'no serif faces');
  const defined = new Set([...brandCss.matchAll(/(--c-[A-Za-z]+):/g)].map((match) => match[1]));
  const used = [...css.matchAll(/var\((--[A-Za-z-]+)\)/g)].map((match) => match[1]);
  assert.ok(used.length > 10);
  for (const variable of used) assert.ok(defined.has(variable), `${variable} is not stamped into brand.css`);
  const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map((match) => match[1]);
  const expected = Object.values(brand.fonts).flatMap((font) => fontSubsets.subsets.map((subset) => ({
    weight: String(font.weight),
    url: `/fonts/${font.web.replace(/\.woff2$/, `.${subset.name}.woff2`)}`,
    range: subset.unicodeRange,
  })));
  assert.equal(faces.length, expected.length);
  for (const face of expected) {
    const block = faces.find((body) => body.includes(`url(${face.url})`));
    assert.ok(block, `legal.css declares ${face.url}`);
    assert.ok(fs.existsSync(path.join(publicDir, face.url)), `${face.url} exists`);
    assert.match(block, new RegExp(`font-weight: ${face.weight};`));
    assert.ok(block.includes(`unicode-range: ${face.range};`), `${face.url} uses the shared unicode range`);
    assert.match(block, /font-display: swap;/);
  }
});

test('the web export check no longer exempts any legal page', async () => {
  const {LEGAL_PAGES} = await import('../../scripts/check-web-export.mjs');
  assert.equal(LEGAL_PAGES.size, 0);
});
