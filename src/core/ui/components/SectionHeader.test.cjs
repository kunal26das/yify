const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render, spy, texts} = require('../testing/kit.cjs');

test('section headers are H2 or H3 headings with a "See all" action named after the section', () => {
  const web = createKit({web: true});
  const {SectionHeader} = web.load('src/core/ui/components/SectionHeader.tsx');
  const view = render(React.createElement(SectionHeader, {title: 'Where to watch', subtitle: 'Streaming in India', nativeID: 'where', action: {label: 'See all', accessibilityLabel: 'See all Where to watch', href: '/search'}}));
  const heading = hosts(view.root, 'Text').find((node) => node.props.role === 'heading');
  assert.equal(heading.props['aria-level'], 2);
  assert.equal(heading.props.nativeID, 'where');
  const [action] = hosts(view.root, 'Pressable');
  assert.equal(action.props['aria-label'], 'See all Where to watch');
  assert.equal(action.props.href, '/search');
  assert.deepEqual(texts(view.root), ['Where to watch', 'Streaming in India', 'See all']);
  const sub = render(React.createElement(SectionHeader, {title: 'Crew', level: 3, action: {label: 'See all', accessibilityLabel: 'See all Crew', onPress: spy()}}));
  assert.equal(hosts(sub.root, 'Text').find((node) => node.props.role === 'heading').props['aria-level'], 3);
});
