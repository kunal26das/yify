const assert = require('node:assert/strict');
const {test} = require('node:test');
const {createKit} = require('./testing/kit.cjs');

function setup(stored) {
  const kit = createKit();
  if (stored) kit.kv.data.set('v2.image.host', JSON.stringify({v: 1, d: stored}));
  const connectivity = kit.load('src/core/ui/connectivity.ts');
  const imageHost = kit.load('src/core/ui/imageHost.ts', {'./connectivity': connectivity});
  const images = kit.load('src/core/ui/images.ts', {'./imageHost': imageHost});
  let now = 1_764_000_000_000;
  imageHost.setImageHostClock(() => now);
  return {kit, connectivity, imageHost, images, advance: (ms) => (now += ms), now: () => now};
}

test('three errors with no success while online switch to the proxy for 24 hours and persist', () => {
  const s = setup();
  s.imageHost.settleImageHost();
  s.imageHost.reportImageError();
  s.imageHost.reportImageError();
  assert.equal(s.imageHost.getImageHostMode(), 'direct');
  s.imageHost.reportImageError();
  assert.equal(s.imageHost.getImageHostMode(), 'proxy');
  assert.deepEqual(JSON.parse(s.kit.kv.data.get('v2.image.host')), {v: 1, d: {mode: 'proxy', until: s.now() + 24 * 60 * 60 * 1000}});
  assert.equal(s.images.imageUrl('/abcdefghijk.jpg', 'w342'), 'https://yify.expo.app/api/v2/img/w342/abcdefghijk.jpg');
});

test('a success, or errors while offline, never switch hosts', () => {
  const s = setup();
  s.imageHost.settleImageHost();
  s.imageHost.reportImageLoad();
  for (let index = 0; index < 5; index += 1) s.imageHost.reportImageError();
  assert.equal(s.imageHost.getImageHostMode(), 'direct');
  const offline = setup();
  offline.imageHost.settleImageHost();
  offline.connectivity.setConnectivity(false);
  for (let index = 0; index < 5; index += 1) offline.imageHost.reportImageError();
  assert.equal(offline.imageHost.getImageHostMode(), 'direct');
});

test('the proxy reverts to direct on the first launch after it expires', () => {
  const s = setup({mode: 'proxy', until: 1_764_000_000_000 + 1000});
  s.imageHost.settleImageHost();
  assert.equal(s.imageHost.getImageHostMode(), 'proxy');
  s.advance(1000);
  s.imageHost.settleImageHost();
  assert.equal(s.imageHost.getImageHostMode(), 'direct');
});

test('image urls: direct TMDB rungs, original SVG logos, and null for invalid paths', () => {
  const {images} = setup();
  assert.equal(images.imageUrl('/abcdefghijk.jpg', 'w342', 'direct'), 'https://image.tmdb.org/t/p/w342/abcdefghijk.jpg');
  assert.equal(images.imageUrl('/abcdefghijk.png', 'w92', 'proxy'), 'https://yify.expo.app/api/v2/img/w92/abcdefghijk.png');
  assert.equal(images.imageUrl('/logoABCDEF.svg', 'w92', 'proxy'), 'https://image.tmdb.org/t/p/original/logoABCDEF.svg');
  assert.equal(images.imageUrl(null, 'w342'), null);
  assert.equal(images.imageUrl('/../etc/passwd', 'w342'), null);
  assert.equal(images.imageUrl('https://evil.example/x.jpg', 'w342'), null);
  assert.equal(images.imageUrl('/short.jpg', 'w342'), null);
});

test('web proxy urls stay on the same origin', () => {
  const kit = createKit();
  const imageHost = kit.load('src/core/ui/imageHost.ts');
  const web = kit.load('src/core/ui/images.ts', {'./imageHost': imageHost, './media/imageOrigin': kit.load('src/core/ui/media/imageOrigin.web.ts')});
  assert.equal(web.imageUrl('/abcdefghijk.jpg', 'w780', 'proxy'), '/api/v2/img/w780/abcdefghijk.jpg');
});
