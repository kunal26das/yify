const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render, spy} = require('../testing/kit.cjs');

test('the input is a labelled searchbox with search keyboard hints', () => {
  const kit = createKit();
  const {SearchField, SEARCH_LABEL} = kit.load('src/core/ui/components/SearchField.tsx');
  const onSubmit = spy();
  const view = render(React.createElement(SearchField, {variant: 'appBar', value: '', onChangeText: spy(), onSubmit}));
  const [input] = hosts(view.root, 'TextInput');
  assert.equal(input.props.role, 'searchbox');
  assert.equal(input.props['aria-label'], SEARCH_LABEL);
  assert.equal(SEARCH_LABEL, 'Search movies, TV shows and people');
  assert.equal(input.props.placeholder, SEARCH_LABEL);
  assert.equal(input.props.inputMode, 'search');
  assert.equal(input.props.enterKeyHint, 'search');
  assert.equal(input.props.returnKeyType, 'search');
  assert.equal(input.props.autoCapitalize, 'none');
  assert.equal(input.props.autoCorrect, false);
  assert.equal(input.props.placeholderTextColor, '#ACB5C3');
  assert.equal(findByProp(view.root, 'aria-label', 'Clear search').length, 0);
  act(() => input.props.onSubmitEditing({nativeEvent: {text: 'dune'}}));
  assert.deepEqual(onSubmit.calls, [['dune']]);
});

test('a value shows the clear button, and Escape or the button clears the text', () => {
  const kit = createKit();
  const {SearchField} = kit.load('src/core/ui/components/SearchField.tsx');
  const onChangeText = spy();
  const view = render(React.createElement(SearchField, {variant: 'appBar', value: 'dune', onChangeText}));
  const [clear] = hosts(view.root, 'Pressable').filter((node) => node.props['aria-label'] === 'Clear search');
  press(clear);
  const [input] = hosts(view.root, 'TextInput');
  act(() => input.props.onKeyPress({nativeEvent: {key: 'Escape'}}));
  act(() => input.props.onKeyPress({nativeEvent: {key: 'a'}}));
  assert.deepEqual(onChangeText.calls, [[''], ['']]);
});

test('on web the wrapper is a search landmark and the header field advertises the / shortcut', () => {
  const kit = createKit({web: true});
  const {SearchField} = kit.load('src/core/ui/components/SearchField.tsx');
  const view = render(React.createElement(SearchField, {variant: 'header', value: '', onChangeText: spy()}));
  assert.equal(findByProp(view.root, 'role', 'search').length, 1);
  assert.equal(hosts(view.root, 'TextInput')[0].props['aria-keyshortcuts'], '/');
  const appBar = render(React.createElement(SearchField, {variant: 'appBar', value: '', onChangeText: spy()}));
  assert.equal(hosts(appBar.root, 'TextInput')[0].props['aria-keyshortcuts'], undefined);
});
