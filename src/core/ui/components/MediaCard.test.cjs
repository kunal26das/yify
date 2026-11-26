const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, act, createKit, findByProp, hosts, press, render, spy, texts} = require('../testing/kit.cjs');
const {PROVIDER, entry, title} = require('../testing/fixtures.cjs');

test('the card is one control named with title, year, type, rating, watched and provider', () => {
  const kit = createKit();
  const {MediaCard} = kit.load('src/core/ui/components/MediaCard.tsx');
  const onOpen = spy();
  const item = title(603, 'The Matrix', 1999);
  const view = render(React.createElement(MediaCard, {item, width: 112, surface: 'home', watched: true, provider: PROVIDER, onOpen}));
  const [card] = hosts(view.root, 'Pressable');
  assert.equal(card.props['aria-label'], 'The Matrix, 1999, Movie, rated 7.8 out of 10, watched, on Netflix');
  assert.equal(card.props.role, 'button');
  press(card);
  assert.deepEqual(onOpen.calls, [[item]]);
  assert.ok(texts(view.root).includes('The Matrix'));
  const artwork = findByProp(view.root, 'aria-hidden', true).find((node) => node.type === 'View' && node.props.role === undefined);
  assert.ok(artwork);
});

test('TV shows read "TV show", low-vote ratings are hidden and legacy entries say they are from v1', () => {
  const kit = createKit();
  const {MediaCard, mediaCardFacts, mediaCardName, LEGACY_META} = kit.load('src/core/ui/components/MediaCard.tsx');
  const show = title(1399, 'Game of Thrones', 2011, {type: 'tv', voteCount: 3});
  assert.equal(mediaCardName(mediaCardFacts(show)), 'Game of Thrones, 2011, TV show');
  const legacy = entry('v1:8462', 'A title saved by the old app', 2019);
  assert.equal(mediaCardName(mediaCardFacts(legacy)), `A title saved by the old app, ${LEGACY_META}`);
  assert.match(LEGACY_META, /^Saved in an older version of /);
  const saved = entry('movie:603', 'The Matrix', 1999, '/abcdefghijk.jpg');
  assert.equal(mediaCardName(mediaCardFacts(saved)), 'The Matrix, 1999, Movie');
  const view = render(React.createElement(MediaCard, {item: legacy, width: 112, surface: 'library', onOpen: spy()}));
  assert.ok(texts(view.root).includes(LEGACY_META));
});

test('Android quick actions use long-press and TalkBack custom actions', () => {
  const kit = createKit();
  const {MediaCard} = kit.load('src/core/ui/components/MediaCard.tsx');
  const more = spy();
  const toggle = spy();
  const watched = spy();
  const view = render(React.createElement(MediaCard, {item: title(603, 'The Matrix', 1999), width: 112, surface: 'home', onOpen: spy(), onQuickActions: more, inWatchlist: true, onToggleWatchlist: toggle, onMarkWatched: watched}));
  const [card] = hosts(view.root, 'Pressable');
  assert.equal(card.props.onLongPress, more);
  assert.deepEqual(card.props.accessibilityActions.map((action) => action.label), ['Remove from watchlist', 'Mark watched', 'More actions']);
  act(() => card.props.onAccessibilityAction({nativeEvent: {actionName: 'toggleWatchlist'}}));
  act(() => card.props.onAccessibilityAction({nativeEvent: {actionName: 'markWatched'}}));
  act(() => card.props.onAccessibilityAction({nativeEvent: {actionName: 'moreActions'}}));
  assert.deepEqual([toggle.calls.length, watched.calls.length, more.calls.length], [1, 1, 1]);
  assert.equal(findByProp(view.root, 'aria-label', 'More actions for The Matrix').length, 0);
});

test('on web the card is a link to its title page with a separate More actions button', () => {
  const kit = createKit({web: true});
  const {MediaCard} = kit.load('src/core/ui/components/MediaCard.tsx');
  const more = spy();
  const view = render(React.createElement(MediaCard, {item: title(603, 'The Matrix', 1999), variant: 'ranked', rank: 1, width: 112, surface: 'home', onOpen: spy(), onQuickActions: more}));
  const [card, moreButton] = hosts(view.root, 'Pressable');
  assert.equal(card.props.role, 'link');
  assert.equal(card.props.href, '/title/movie/603-the-matrix');
  assert.equal(moreButton.props['aria-label'], 'More actions for The Matrix');
  assert.equal(hosts(card, 'Pressable').length, 1);
  press(moreButton);
  assert.equal(more.calls.length, 1);
  const rank = hosts(view.root, 'Text').find((node) => node.props.children === '1');
  assert.equal(rank.props['aria-hidden'], true);
  const legacy = render(React.createElement(MediaCard, {item: entry('v1:42', 'Old Title'), width: 112, surface: 'library', onOpen: spy()}));
  assert.equal(hosts(legacy.root, 'Pressable')[0].props.href, '/search?q=Old%20Title');
});
