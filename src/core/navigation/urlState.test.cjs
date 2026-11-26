const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {loadTs} = require('../../../tests/helpers/loadTs.cjs');
const {act, render} = require('../../../tests/helpers/render.cjs');

const {searchUrlCodec} = loadTs('src/core/navigation/searchUrl.ts');
const {DEFAULT_SEARCH_URL_STATE} = loadTs('src/core/domain/search.ts');

function setup(initial) {
  let params = initial;
  const writes = [];
  const navigation = {
    setParams(update) {
      writes.push(update);
    },
  };
  const expoRouter = {
    useLocalSearchParams: () => ({...params}),
    useNavigation: () => navigation,
    get router() {
      throw new Error('the global router must not be used');
    },
  };
  const {useUrlState} = loadTs('src/core/navigation/urlState.ts', {'expo-router': expoRouter});
  const seen = [];
  function Probe() {
    const url = useUrlState(searchUrlCodec);
    seen.push(url);
    return React.createElement('Text', null, url.state.q);
  }
  const view = render(React.createElement(Probe));
  return {
    seen,
    writes,
    latest: () => seen[seen.length - 1],
    navigate(next) {
      params = next;
      view.update(React.createElement(Probe));
    },
    unmount: () => view.unmount(),
  };
}

test('URL state is the codec parse of the route params', () => {
  const screen = setup({q: 'dune', type: 'movie', page: '2', sort: null, genres: ['18', '80']});
  assert.deepEqual(screen.latest().state, {...DEFAULT_SEARCH_URL_STATE, q: 'dune', type: 'movie', genres: [18, 80]});
  screen.unmount();
});

test('the state and commit keep their identity until a codec param changes', () => {
  const screen = setup({q: 'dune'});
  const first = screen.latest();
  screen.navigate({q: 'dune'});
  screen.navigate({q: 'dune', page: '3', '#': 'top'});
  assert.equal(screen.seen.length, 3);
  assert.equal(screen.latest(), first);
  assert.equal(screen.latest().state, first.state);
  screen.navigate({q: 'dune', type: 'tv'});
  assert.notEqual(screen.latest().state, first.state);
  assert.equal(screen.latest().commit, first.commit);
  assert.equal(screen.latest().state.type, 'tv');
  screen.unmount();
});

test('commit writes every codec key through the screen navigation and clears defaults', () => {
  const screen = setup({q: 'dune', type: 'tv', sort: 'rating'});
  act(() => screen.latest().commit({...screen.latest().state, q: '', type: 'all', genres: [18], sort: 'popular'}));
  assert.deepEqual(screen.writes, [{
    q: undefined,
    type: undefined,
    genres: '18',
    providers: undefined,
    monetization: undefined,
    sort: undefined,
    year_from: undefined,
    year_to: undefined,
    rating_min: undefined,
    lang: undefined,
  }]);
  assert.deepEqual(Object.keys(screen.writes[0]), [...searchUrlCodec.keys]);
  screen.unmount();
});

test('the codec parses every route param, including aliases it never writes', () => {
  let params = {tab: 'insights'};
  const expoRouter = {useLocalSearchParams: () => ({...params}), useNavigation: () => ({setParams() {}})};
  const {useUrlState} = loadTs('src/core/navigation/urlState.ts', {'expo-router': expoRouter});
  const sectionCodec = {
    keys: ['section'],
    parse: (all) => ({section: all.section ?? (all.tab === 'insights' ? 'watched' : 'watchlist')}),
    serialize: (state) => ({section: state.section === 'watchlist' ? undefined : state.section}),
  };
  let url;
  function Probe() {
    url = useUrlState(sectionCodec);
    return null;
  }
  const view = render(React.createElement(Probe));
  assert.deepEqual(url.state, {section: 'watched'});
  view.unmount();
});

