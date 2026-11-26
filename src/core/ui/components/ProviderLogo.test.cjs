const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, render, texts} = require('../testing/kit.cjs');
const {PROVIDER} = require('../testing/fixtures.cjs');

test('a provider logo is a named image at w92, with a monogram when TMDB has no logo', () => {
  const kit = createKit();
  const {ProviderLogo} = kit.load('src/core/ui/components/ProviderLogo.tsx');
  const view = render(React.createElement(ProviderLogo, {provider: PROVIDER, size: 48}));
  const [image] = findByProp(view.root, 'role', 'img');
  assert.equal(image.props['aria-label'], 'Netflix');
  assert.equal(hosts(view.root, 'ExpoImage')[0].props.source.uri, 'https://image.tmdb.org/t/p/w92/netflixlogo.jpg');
  const monogram = render(React.createElement(ProviderLogo, {provider: {...PROVIDER, name: 'mubi', logoPath: null}, size: 40}));
  assert.deepEqual(texts(monogram.root), ['M']);
  assert.equal(findByProp(monogram.root, 'role', 'img')[0].props['aria-label'], 'mubi');
  const decorative = render(React.createElement(ProviderLogo, {provider: PROVIDER, size: 24, decorative: true}));
  assert.equal(findByProp(decorative.root, 'role', 'img').length, 0);
  assert.equal(findByProp(decorative.root, 'aria-hidden', true).length > 0, true);
});
