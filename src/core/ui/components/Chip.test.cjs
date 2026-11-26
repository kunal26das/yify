const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, hosts, press, render, spy, texts, touchableStyle} = require('../testing/kit.cjs');

function flat(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

test('filter chips are checkboxes whose selection is exposed and shown with a check', () => {
  const kit = createKit();
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  const onPress = spy();
  const view = render(React.createElement(Chip, {kind: 'filter', label: 'On my services', selected: true, onPress}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props.role, 'checkbox');
  assert.equal(pressable.props['aria-checked'], true);
  assert.equal(hosts(view.root, 'Glyph')[0].props.name, 'check');
  assert.equal(flat(pressable.props.style).backgroundColor, '#262C3A');
  assert.deepEqual(pressable.props.hitSlop, {top: 8, bottom: 8});
  view.update(React.createElement(Chip, {kind: 'filter', label: 'On my services', selected: false, onPress}));
  assert.equal(hosts(view.root, 'Pressable')[0].props['aria-checked'], false);
  assert.equal(hosts(view.root, 'Glyph').length, 0);
  press(hosts(view.root, 'Pressable')[0]);
  assert.equal(onPress.calls.length, 1);
});

test('dropdown chips name their value, expose the popup state and show the trailing arrow', () => {
  const kit = createKit();
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  const view = render(React.createElement(Chip, {kind: 'dropdown', label: 'Genre', value: 'Drama', expanded: true, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props.role, 'button');
  assert.equal(pressable.props['aria-label'], 'Genre: Drama');
  assert.equal(pressable.props['aria-expanded'], true);
  assert.deepEqual(texts(view.root), ['Drama']);
  assert.equal(hosts(view.root, 'Glyph').at(-1).props.name, 'arrow_drop_down');
  const empty = render(React.createElement(Chip, {kind: 'dropdown', label: 'Year', onPress: spy()}));
  assert.equal(hosts(empty.root, 'Pressable')[0].props['aria-label'], 'Year: any');
});

test('on web dropdown chips announce a dialog popup', () => {
  const kit = createKit({web: true});
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  const view = render(React.createElement(Chip, {kind: 'dropdown', label: 'Sort', value: null, expanded: false, onPress: spy()}));
  const [pressable] = hosts(view.root, 'Pressable');
  assert.equal(pressable.props['aria-haspopup'], 'dialog');
  assert.equal(pressable.props['aria-expanded'], false);
});

test('input chips keep a separate remove button and assist chips with an href are links on web', () => {
  const kit = createKit();
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  const onRemove = spy();
  const view = render(React.createElement(Chip, {kind: 'input', label: 'Comedy', onPress: spy(), onRemove}));
  const [chip, remove] = hosts(view.root, 'Pressable');
  assert.equal(chip.props.role, 'button');
  assert.equal(remove.props['aria-label'], 'Remove Comedy');
  press(remove);
  assert.equal(onRemove.calls.length, 1);
  const web = createKit({web: true});
  const {Chip: WebChip} = web.load('src/core/ui/components/Chip.tsx');
  const link = render(React.createElement(WebChip, {kind: 'assist', label: 'Drama', href: '/search?genres=18'}));
  assert.equal(hosts(link.root, 'Pressable')[0].props.role, 'link');
  assert.equal(hosts(link.root, 'Pressable')[0].props.href, '/search?genres=18');
});

function space(node) {
  const element = {};
  const event = {nativeEvent: {key: ' '}, target: element, currentTarget: element, preventDefault: spy()};
  act(() => node.props.onKeyDown(event));
  act(() => node.props.onKeyUp(event));
  return event;
}

test('on web Space toggles a filter chip without scrolling the page', () => {
  const kit = createKit({web: true});
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  function Filter() {
    const [selected, setSelected] = React.useState(false);
    return React.createElement(Chip, {kind: 'filter', label: 'Free', selected, onPress: () => setSelected((value) => !value)});
  }
  const view = render(React.createElement(Filter));
  const chip = () => hosts(view.root, 'Pressable')[0];
  assert.equal(chip().props['aria-checked'], false);
  const event = space(chip());
  assert.equal(event.preventDefault.calls.length, 1);
  assert.equal(chip().props['aria-checked'], true);
  space(chip());
  assert.equal(chip().props['aria-checked'], false);
});

test('the remove button of an input chip is a 48 dp target that does not overlap the chip body', () => {
  const kit = createKit();
  const {Chip} = kit.load('src/core/ui/components/Chip.tsx');
  const view = render(React.createElement(Chip, {kind: 'input', label: 'Comedy', onPress: spy(), onRemove: spy()}));
  const [body, remove] = hosts(view.root, 'Pressable');
  const size = touchableStyle(remove);
  const slop = remove.props.hitSlop;
  assert.ok(size.width + slop.left + slop.right >= 48);
  assert.ok(size.height + slop.top + slop.bottom >= 48);
  assert.ok((size.marginLeft ?? 0) >= slop.left);
  assert.equal(body.props.hitSlop.left, undefined);
  assert.equal(body.props.hitSlop.right, undefined);
  assert.ok(touchableStyle(body).minHeight + body.props.hitSlop.top + body.props.hitSlop.bottom >= 48);
});
