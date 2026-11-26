const assert = require('node:assert/strict');
const {test} = require('node:test');
const {React, createKit, hosts, render, spy} = require('../../../core/ui/testing/kit.cjs');
const {tabProps} = require('../../../core/ui/testing/tabs.cjs');

const SIGNED_OUT = {ready: true, signingIn: false, available: false, account: null, error: null};
const FREE = {status: 'free', entitlement: {billingIssue: false}, ensureKnown: async () => 'free', openPaywall: () => undefined};

function HeaderSearch() {
  return React.createElement('HeaderSearch');
}

function loadTabBar({segments, pathname, session = SIGNED_OUT, plus = FREE}) {
  const kit = createKit();
  const route = {segments, pathname};
  const trackScreen = spy();
  const mod = kit.load('src/features/shell/public/AppTabBar.tsx', {
    'expo-router': {useSegments: () => route.segments, usePathname: () => route.pathname},
    '@/core/platform/telemetry/events': {trackScreen},
    '@/core/ui/navigation/AdaptiveNavigation': {AdaptiveNavigation: (props) => React.createElement('Chrome', props)},
    '@/features/account/public/session': {useSession: () => session},
    '@/features/monetization/public/plus': {usePlus: () => plus},
    '@/features/search/public/HeaderSearch': {HeaderSearch},
  });
  return {route, trackScreen, AppTabBar: mod.AppTabBar};
}

test('AppTabBar passes the tab state, header search, account and You badge to AdaptiveNavigation', () => {
  const account = {uid: 'u1', name: null, email: 'ada@example.com', photoUrl: 'https://example.com/a.png'};
  const {AppTabBar} = loadTabBar({
    segments: ['(tabs)', '(home)'],
    pathname: '/',
    session: {...SIGNED_OUT, account},
    plus: {...FREE, entitlement: {billingIssue: true}},
  });
  const {props} = tabProps(2);
  const view = render(React.createElement(AppTabBar, props));
  const [chrome] = hosts(view.root, 'Chrome');
  assert.equal(chrome.props.state, props.state);
  assert.equal(chrome.props.navigateToTab, props.navigateToTab);
  assert.deepEqual(chrome.props.account, {name: 'ada@example.com', photoUrl: 'https://example.com/a.png'});
  assert.equal(chrome.props.youBadge, 'billing');
  assert.equal(chrome.props.headerSearch.type, HeaderSearch);
});

test('AppTabBar reports a screen view on every route focus with the B4.0.2 names', () => {
  const {route, trackScreen, AppTabBar} = loadTabBar({segments: ['(tabs)', '(home)'], pathname: '/'});
  const {props} = tabProps(0);
  const view = render(React.createElement(AppTabBar, props));
  assert.deepEqual(trackScreen.calls, [['home']]);
  route.segments = ['(tabs)', '(home)', 'title', 'movie', '[id]'];
  route.pathname = '/title/movie/603-the-matrix';
  view.update(React.createElement(AppTabBar, {...props}));
  route.pathname = '/title/movie/299536-avengers-infinity-war';
  view.update(React.createElement(AppTabBar, {...props}));
  route.segments = ['(tabs)', '(home)', 'title', 'tv', '[id]', 'season', '[season]'];
  route.pathname = '/title/tv/1399-game-of-thrones/season/1';
  view.update(React.createElement(AppTabBar, {...props}));
  assert.deepEqual(trackScreen.calls, [['home'], ['title_movie'], ['title_movie'], ['title_tv']]);
  const {AppTabBar: SignedOut} = loadTabBar({segments: ['(tabs)', '(you)', 'you'], pathname: '/you'});
  const [chrome] = hosts(render(React.createElement(SignedOut, props)).root, 'Chrome');
  assert.equal(chrome.props.account, null);
  assert.equal(chrome.props.youBadge, 'none');
});
