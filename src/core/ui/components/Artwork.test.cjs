const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, render, texts} = require('../testing/kit.cjs');

test('artwork loads the TMDB size, keeps its aspect ratio and draws the hairline', () => {
  const kit = createKit();
  const {Artwork} = kit.load('src/core/ui/components/Artwork.tsx');
  const view = render(React.createElement(Artwork, {kind: 'poster', path: '/abcdefghijk.jpg', size: 'w342', width: 120, alt: 'Poster for The Matrix'}));
  const [frame] = findByProp(view.root, 'role', 'img');
  assert.equal(frame.props['aria-label'], 'Poster for The Matrix');
  const style = Object.assign({}, ...[frame.props.style].flat(Infinity).filter(Boolean));
  assert.equal(style.aspectRatio, 2 / 3);
  assert.equal(style.backgroundColor, '#1F222C');
  const [image] = hosts(view.root, 'ExpoImage');
  assert.equal(image.props.source.uri, 'https://image.tmdb.org/t/p/w342/abcdefghijk.jpg');
  assert.equal(image.props.recyclingKey, '/abcdefghijk.jpg');
  assert.equal(image.props.transition, 200);
  assert.equal(image.props.accessible, false);
  const hairline = hosts(view.root, 'View').find((node) => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean)).borderWidth === 1);
  const hairlineStyle = Object.assign({}, ...[hairline.props.style].flat(Infinity).filter(Boolean));
  assert.equal(hairlineStyle.borderColor, '#2B303C');
  assert.equal(hairlineStyle.opacity, 0.5);
});

test('decorative artwork is hidden, and a failed load shows the fallback title', () => {
  const kit = createKit();
  const {Artwork} = kit.load('src/core/ui/components/Artwork.tsx');
  const view = render(React.createElement(Artwork, {kind: 'backdrop', path: '/abcdefghijk.jpg', size: 'w780', width: '100%', alt: '', decorative: true, fallbackLabel: 'The Matrix'}));
  assert.equal(findByProp(view.root, 'role', 'img').length, 0);
  assert.equal(hosts(view.root, 'View')[0].props['aria-hidden'], true);
  act(() => hosts(view.root, 'ExpoImage')[0].props.onError({error: 'boom'}));
  assert.equal(hosts(view.root, 'ExpoImage').length, 0);
  assert.deepEqual(texts(view.root), ['The Matrix']);
  const missing = render(React.createElement(Artwork, {kind: 'poster', path: null, size: 'w342', width: 100, alt: 'Poster', fallbackLabel: 'Old Title'}));
  assert.deepEqual(texts(missing.root), ['Old Title']);
});
