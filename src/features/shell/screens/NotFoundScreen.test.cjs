const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, press, render, texts} = require('../../../core/ui/testing/kit.cjs');

test('NotFoundScreen shows the B4.15 copy with Home and Search links', () => {
  const kit = createKit();
  const {NotFoundScreen, NOT_FOUND_COPY} = kit.load('src/features/shell/screens/NotFoundScreen.tsx');
  const view = render(React.createElement(NotFoundScreen));
  const shown = texts(view.root);
  for (const copy of [NOT_FOUND_COPY.title, NOT_FOUND_COPY.body, NOT_FOUND_COPY.home, NOT_FOUND_COPY.search]) assert.ok(shown.includes(copy), copy);
  assert.equal(NOT_FOUND_COPY.body, "The page you're looking for doesn't exist or has moved.");
  assert.equal(findByProp(view.root, 'role', 'main').length, 1);
  const buttons = findByProp(view.root, 'role', 'button');
  assert.ok(buttons.length >= 2);
  press(buttons.at(-2));
  press(buttons.at(-1));
  assert.deepEqual(kit.router.push.calls, [['/'], ['/search']]);
});

test('on web the not-found page carries the header whose links still navigate', () => {
  const kit = createKit({web: true});
  const {NotFoundHeader} = kit.load('src/features/shell/platform/NotFoundHeader.web.tsx', {
    '@/features/account/public/session': {useSession: () => ({ready: true, signingIn: false, available: false, account: null, error: null})},
    '@/features/search/public/HeaderSearch': {HeaderSearch: () => React.createElement('HeaderSearch')},
  });
  const view = render(React.createElement(NotFoundHeader));
  assert.deepEqual(findByProp(view.root, 'role', 'banner').map((node) => node.props.dataSet.nav), ['header']);
  const links = findByProp(view.root, 'role', 'link');
  assert.equal(links.filter((node) => node.props['aria-current'] === 'page').length, 0);
  const library = links.find((node) => node.props.href === '/library');
  press(library, {button: 0, preventDefault: () => undefined});
  assert.deepEqual(kit.router.navigate.calls, [['/library']]);
});
