const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render, texts} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('the web footer is the contentinfo landmark with focusable 40 px legal links and attribution', () => {
  const kit = createKit({web: true});
  const {SiteFooter, FOOTER_ATTRIBUTION} = kit.load('src/core/ui/components/SiteFooter.web.tsx');
  const {APP_NAME} = kit.load('src/core/config/app.ts');
  const view = render(React.createElement(SiteFooter));
  assert.equal(findByProp(view.root, 'role', 'contentinfo').length, 1);
  const links = hosts(view.root, 'Pressable');
  assert.deepEqual(links.map((node) => texts(node).join('')), ['About', 'Privacy', 'Terms', 'Get the Android app']);
  assert.deepEqual(links.map((node) => node.props.href), ['/settings/about', 'https://yify.expo.app/privacy.html', 'https://yify.expo.app/terms.html', 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify']);
  for (const link of links) {
    assert.equal(link.props.role, 'link');
    assert.equal(link.props.dataSet.focusable, '');
    assert.ok(flat(link.props.style).minHeight >= 40);
    assert.ok(flat(link.props.style).minWidth >= 40);
    assert.equal(flat(hosts(link, 'Text')[0].props.style).textDecorationLine, 'underline');
  }
  assert.equal(links[0].props.hrefAttrs, undefined);
  assert.equal(links[1].props.hrefAttrs.target, '_blank');
  assert.equal(links[3].props.hrefAttrs.rel, 'noopener noreferrer');
  const preventDefault = () => undefined;
  press(links[0], {button: 0, preventDefault});
  assert.deepEqual(kit.router.push.calls, [['/settings/about']]);
  press(links[2], {button: 0, preventDefault});
  assert.deepEqual(kit.router.push.calls, [['/settings/about']]);
  assert.ok(texts(view.root).includes(FOOTER_ATTRIBUTION));
  assert.ok(FOOTER_ATTRIBUTION.endsWith(`${APP_NAME} does not host video.`));
  const native = createKit();
  const {SiteFooter: NativeFooter} = native.load('src/core/ui/components/SiteFooter.tsx');
  assert.equal(render(React.createElement(NativeFooter)).root.children.length, 0);
});
