const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render, texts} = require('../testing/kit.cjs');

test('a rating renders a star glyph and one decimal, named for screen readers', () => {
  const kit = createKit();
  const {RatingBadge} = kit.load('src/core/ui/components/RatingBadge.tsx');
  const view = render(React.createElement(RatingBadge, {value: 7.84, votes: 1200}));
  const [badge] = hosts(view.root, 'View').filter((node) => node.props.role === 'img');
  assert.equal(badge.props['aria-label'], 'Rated 7.8 out of 10 on TMDB');
  assert.deepEqual(texts(view.root), ['7.8']);
  const [star] = hosts(view.root, 'Glyph');
  assert.equal(star.props.name, 'star');
  assert.equal(star.props.fontName, 'YifyIconsFilled');
  assert.equal(star.props.color, '#EEF1F6');
});

test('ratings are hidden without a value or with fewer than ten votes', () => {
  const kit = createKit();
  const {RatingBadge} = kit.load('src/core/ui/components/RatingBadge.tsx');
  assert.equal(render(React.createElement(RatingBadge, {value: null})).root.children.length, 0);
  assert.equal(render(React.createElement(RatingBadge, {value: 8, votes: 9})).root.children.length, 0);
  assert.equal(render(React.createElement(RatingBadge, {value: 8, votes: 10})).root.children.length, 1);
});
