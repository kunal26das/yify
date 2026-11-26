const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, render, texts} = require('../testing/kit.cjs');

test('avatars are named images with initials on secondaryContainer as the fallback', () => {
  const kit = createKit();
  const {Avatar, initialsOf} = kit.load('src/core/ui/components/Avatar.tsx');
  const view = render(React.createElement(Avatar, {name: 'Ada Lovelace', size: 40}));
  const [image] = findByProp(view.root, 'role', 'img');
  assert.equal(image.props['aria-label'], 'Ada Lovelace');
  assert.equal(Object.assign({}, ...[image.props.style].flat(Infinity).filter(Boolean)).backgroundColor, '#262C3A');
  assert.deepEqual(texts(view.root), ['AL']);
  assert.equal(initialsOf('  grace   brewster hopper '), 'GH');
  assert.equal(initialsOf('Cher'), 'C');
  assert.equal(initialsOf(''), '');
  const photo = render(React.createElement(Avatar, {name: 'Ada Lovelace', size: 32, photoUrl: 'https://lh3.googleusercontent.com/a/photo', decorative: true}));
  assert.equal(findByProp(photo.root, 'role', 'img').length, 0);
  assert.equal(hosts(photo.root, 'ExpoImage')[0].props.source.uri, 'https://lh3.googleusercontent.com/a/photo');
});
