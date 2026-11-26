const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const brand = require('../../config/brand.json');

const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'store-listing');
const LIMITS = {title: 30, shortDescription: 80, fullDescription: 4000};
const RELEASE_NOTES_LIMIT = 500;
const PLAY_LANGUAGES = ['en-US'];
const BCP47 = /^[a-z]{2,3}(?:-[A-Z]{2}|-[A-Za-z]{4}|-\d{3})?$/;
const SUPPORT_EMAIL = /export const SUPPORT_EMAIL = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'src/core/config/legal.ts'), 'utf8'))[1];
const banned = JSON.parse(fs.readFileSync(path.join(directory, 'banned-words.json'), 'utf8'));
const length = (text) => [...text].length;
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function languages() {
  return fs.readdirSync(directory).filter((file) => file.endsWith('.json') && file !== 'banned-words.json').map((file) => file.slice(0, -5)).sort();
}

function listing(language) {
  return JSON.parse(fs.readFileSync(path.join(directory, `${language}.json`), 'utf8'));
}

function releaseNotes(language) {
  return fs.readFileSync(path.join(directory, 'release-notes', `${language}.txt`), 'utf8').replace(/\n$/, '');
}

function bannedIn(text, words) {
  return words.filter((word) => new RegExp(/^[A-Za-z0-9]+$/.test(word) && word.length <= 3 ? `\\b${escape(word)}\\b` : escape(word), 'i').test(text));
}

test('every listing language Play reports has a listing, a banned-word list and release notes', () => {
  const files = languages();
  assert.ok(files.length > 0);
  for (const language of PLAY_LANGUAGES) assert.ok(files.includes(language), `store-listing/${language}.json is missing`);
  assert.deepEqual(Object.keys(banned).sort(), files, 'banned-words.json needs exactly one list per listing file');
  assert.deepEqual(fs.readdirSync(path.join(directory, 'release-notes')).sort(), files.map((language) => `${language}.txt`));
  for (const language of files) assert.match(language, BCP47, `${language} is not a BCP-47 code Play accepts`);
});

test('every listing has exactly the Play Listing text fields, within Play limits and without stray whitespace', () => {
  for (const language of languages()) {
    const entry = listing(language);
    assert.deepEqual(Object.keys(entry).sort(), Object.keys(LIMITS).sort(), language);
    for (const [field, limit] of Object.entries(LIMITS)) {
      const text = entry[field];
      assert.equal(typeof text, 'string', `${language}.${field}`);
      assert.ok(length(text) > 0, `${language}.${field} is empty`);
      assert.ok(length(text) <= limit, `${language}.${field} has ${length(text)} characters; Play allows ${limit}`);
      assert.equal(text, text.trim(), `${language}.${field} has leading or trailing whitespace`);
      assert.doesNotMatch(text, /<[a-z/][^>]*>/i, `${language}.${field} must be plain text`);
    }
    assert.doesNotMatch(entry.title, /\n/);
    assert.doesNotMatch(entry.shortDescription, /\n/);
    const notes = releaseNotes(language);
    assert.ok(length(notes) > 0 && length(notes) <= RELEASE_NOTES_LIMIT, `release-notes/${language}.txt has ${length(notes)} characters`);
  }
});

test('no listing or release note uses a banned word of its language', () => {
  assert.deepEqual(banned['en-US'], ['download', 'free movies', 'watch movies', 'HD', '4K', 'YTS', 'torrent', 'Watch Now']);
  for (const language of languages()) {
    const entry = listing(language);
    for (const [field, text] of [...Object.entries(entry), ['releaseNotes', releaseNotes(language)]]) {
      assert.deepEqual(bannedIn(text, banned[language]), [], `${language}.${field}`);
    }
  }
  assert.deepEqual(bannedIn('Free Movies in HD, download now', banned['en-US']), ['download', 'free movies', 'HD']);
  assert.deepEqual(bannedIn('A birthday pick for 4Kids', banned['en-US']), []);
});

test('the English listing is the B8.1 text', () => {
  const entry = listing('en-US');
  assert.equal(entry.title, 'Yify: Where to Watch & Track');
  assert.ok(entry.title.startsWith(`${brand.appName}:`), 'the title starts with the app name in config/brand.json');
  assert.equal(entry.shortDescription, 'Find where to stream movies and TV, watch trailers and keep a film diary.');
  const full = entry.fullDescription;
  assert.ok(full.startsWith("Yify helps you decide what to watch and where to stream it. Browse movies and TV shows, watch official trailers, see which services carry a title in your country, and keep track of what you've watched."));
  for (const line of [
    "• Discover trending, popular and critically acclaimed titles, what's in theaters and new episodes.",
    '• Search movies, TV shows and people, with filters.',
    '• See where to watch in your country, with your services first.',
    '• Watch official trailers.',
    '• Keep a watchlist, a diary with ratings and notes, and your own lists.',
    '• Sign in with Google to sync (optional).',
    '• No Yify ads', '• Unlimited lists', '• Your year in review', '• Accent themes',
    'Subscriptions renew until you cancel them in Google Play. Plus also unlocks on the web when you sign in.',
    'Yify does not host, stream or sell movies or TV shows. Trailers play from YouTube. To watch a title, use one of the streaming services listed.',
    'Analytics is optional and off until you allow it, and sign-in is optional.',
    'This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data by JustWatch.',
  ]) {
    assert.ok(full.split('\n').includes(line), `the full description has the line "${line}"`);
  }
  assert.ok(full.includes(SUPPORT_EMAIL), 'the full description gives the support address');
  assert.deepEqual(full.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi), [SUPPORT_EMAIL], 'no other contact data');
  assert.doesNotMatch(full, /\+\d{6,}|\d{10,}/, 'no phone number');
  for (const removed of [/no account to create/i, /Support Yify subscription/i, /fifteen genre rows/i, /rolls straight on/i, /miniplayer/i, /notification/i]) {
    assert.doesNotMatch(full, removed, `remove ${removed} from the description (B8.1)`);
  }
});
