const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, render, texts} = require('../testing/kit.cjs');

test('the web footer is the contentinfo landmark with legal links and attribution', () => {
  const kit = createKit({web: true});
  const {SiteFooter, FOOTER_ATTRIBUTION} = kit.load('src/core/ui/components/SiteFooter.web.tsx');
  const {APP_NAME} = kit.load('src/core/config/app.ts');
  const view = render(React.createElement(SiteFooter));
  assert.equal(findByProp(view.root, 'role', 'contentinfo').length, 1);
  const links = hosts(view.root, 'Text').filter((node) => node.props.href);
  assert.deepEqual(links.map((node) => node.props.children), ['About', 'Privacy', 'Terms', 'Get the Android app']);
  assert.deepEqual(links.map((node) => node.props.href), ['/settings/about', 'https://yify.expo.app/privacy.html', 'https://yify.expo.app/terms.html', 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify']);
  assert.equal(links[1].props.hrefAttrs.target, '_blank');
  assert.ok(texts(view.root).includes(FOOTER_ATTRIBUTION));
  assert.ok(FOOTER_ATTRIBUTION.endsWith(`${APP_NAME} does not host video.`));
  const native = createKit();
  const {SiteFooter: NativeFooter} = native.load('src/core/ui/components/SiteFooter.tsx');
  assert.equal(render(React.createElement(NativeFooter)).root.children.length, 0);
});
