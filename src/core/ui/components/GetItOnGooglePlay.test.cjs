const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, press, render, spy} = require('../testing/kit.cjs');

test('the web badge is a named link to the Play listing that opens a new tab', () => {
  const kit = createKit({web: true});
  const {GetItOnGooglePlay, GOOGLE_PLAY_LABEL} = kit.load('src/core/ui/components/GetItOnGooglePlay.web.tsx');
  const onPress = spy();
  const view = render(React.createElement(GetItOnGooglePlay, {onPress}));
  const [link] = hosts(view.root, 'Pressable');
  assert.equal(link.props.role, 'link');
  assert.equal(link.props['aria-label'], GOOGLE_PLAY_LABEL);
  assert.equal(link.props.href, 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify');
  assert.deepEqual(link.props.hrefAttrs, {target: '_blank', rel: 'noopener noreferrer'});
  assert.equal(hosts(view.root, 'ExpoImage')[0].props.accessible, false);
  press(link);
  assert.equal(onPress.calls.length, 1);
  const native = createKit();
  const {GetItOnGooglePlay: NativeBadge} = native.load('src/core/ui/components/GetItOnGooglePlay.tsx');
  assert.equal(render(React.createElement(NativeBadge)).root.children.length, 0);
});
