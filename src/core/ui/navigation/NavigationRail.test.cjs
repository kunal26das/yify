const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, findByProp, hosts, press, render} = require('../testing/kit.cjs');
const {tabProps} = require('../testing/tabs.cjs');

test('the rail is 80 dp wide with the same tabs and events as the bar', () => {
  const kit = createKit();
  const {NavigationRail} = kit.load('src/core/ui/navigation/NavigationRail.tsx');
  const {props, emitted} = tabProps(3);
  const view = render(React.createElement(NavigationRail, props));
  const [rail] = findByProp(view.root, 'role', 'tablist');
  assert.deepEqual(rail.props.dataSet, {nav: 'rail'});
  const style = Object.assign({}, ...[rail.props.style].flat(Infinity).filter(Boolean));
  assert.equal(style.width, 80);
  assert.equal(style.paddingTop, 48);
  const tabs = hosts(view.root, 'Pressable');
  assert.deepEqual(tabs.map((node) => node.props['aria-selected']), [false, false, false, true]);
  press(tabs[1]);
  assert.equal(emitted[0].target, '(search)-key');
  assert.deepEqual(props.navigateToTab.calls, [['(search)-key']]);
});
