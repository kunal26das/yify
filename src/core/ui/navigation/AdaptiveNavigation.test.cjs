const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render} = require('../testing/kit.cjs');
const {tabProps} = require('../testing/tabs.cjs');

test('Android renders the bar on compact widths and the rail from 600 dp', () => {
  const kit = createKit();
  const {AdaptiveNavigation} = kit.load('src/core/ui/navigation/AdaptiveNavigation.tsx');
  const {props} = tabProps(0);
  const view = render(React.createElement(AdaptiveNavigation, {...props, headerSearch: null, account: null}));
  assert.deepEqual(findByProp(view.root, 'role', 'tablist').map((node) => node.props.dataSet.nav), ['bar']);
  kit.rn.setWindowDimensions({width: 700});
  const medium = render(React.createElement(AdaptiveNavigation, {...props, headerSearch: null, account: null}));
  assert.deepEqual(findByProp(medium.root, 'role', 'tablist').map((node) => node.props.dataSet.nav), ['rail']);
  const {useChromePosition} = kit.load('src/core/ui/navigation/useChromePosition.ts');
  let position;
  function Probe() {
    position = useChromePosition();
    return null;
  }
  render(React.createElement(Probe));
  assert.equal(position, 'left');
});

test('web renders the skip link first and all three variants for CSS to choose from', () => {
  const kit = createKit({web: true});
  const mainContent = kit.load('src/core/ui/layout/mainContent.ts');
  const {AdaptiveNavigation} = kit.load('src/core/ui/navigation/AdaptiveNavigation.web.tsx', {'../layout/mainContent': mainContent});
  const {useChromePosition} = kit.load('src/core/ui/navigation/useChromePosition.web.ts');
  const {props} = tabProps(0);
  const view = render(React.createElement(AdaptiveNavigation, {...props, headerSearch: null, account: null}));
  const navs = hosts(view.root, 'View').filter((node) => node.props.dataSet && node.props.dataSet.nav).map((node) => node.props.dataSet.nav);
  assert.deepEqual(navs, ['header', 'rail', 'bar']);
  const [skip] = hosts(view.root, 'Pressable');
  assert.equal(skip.props.href, '#main');
  assert.deepEqual(skip.props.dataSet, {skipLink: '', focusable: ''});
  const focus = [];
  mainContent.setMainContent({focus: (options) => focus.push(options)});
  press(skip, {button: 0, preventDefault: () => undefined});
  assert.equal(focus.length, 1);
  assert.equal(useChromePosition(), 'top');
});
