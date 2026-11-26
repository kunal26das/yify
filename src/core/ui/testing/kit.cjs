const React = require('react');
const {loadTs} = require('../../../../tests/helpers/loadTs.cjs');
const {createRnMock, spy} = require('../../../../tests/helpers/rnMock.cjs');
const {act, render} = require('../../../../tests/helpers/render.cjs');

function sharedValue(initial) {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? next(value) : next;
    },
    get value() {
      return value;
    },
  };
}

function createReanimatedMock() {
  const Animated = {
    View: 'Animated.View',
    ScrollView: 'Animated.ScrollView',
    Text: 'Animated.Text',
    createAnimatedComponent: (component) => component,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (initial) => React.useState(() => sharedValue(initial))[0],
    useAnimatedStyle: (factory) => factory(),
    useAnimatedReaction: (prepare, react) => {
      React.useEffect(() => {
        react(prepare(), null);
      });
    },
    useReducedMotion: () => false,
    withTiming: (value) => value,
    withRepeat: (value) => value,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: spy(),
    interpolate: (value, input, output) => {
      const [x0, x1] = input;
      const [y0, y1] = output;
      return y0 + ((value - x0) * (y1 - y0)) / (x1 - x0);
    },
    Easing: {bezier: () => (t) => t, inOut: (f) => f, ease: (t) => t},
    ReduceMotion: {System: 'system'},
  };
}

function createRouterMock(overrides = {}) {
  const router = {
    push: spy(),
    replace: spy(),
    back: spy(),
    navigate: spy(),
  };
  const state = {canGoBack: true, segments: ['(tabs)', '(home)'], ...overrides};
  return {
    router,
    state,
    module: {
      useRouter: () => router,
      useCanGoBack: () => state.canGoBack,
      useSegments: () => state.segments,
      useFocusEffect: (effect) => React.useEffect(effect, [effect]),
    },
  };
}

function createKvMock() {
  const data = new Map();
  return {
    data,
    module: {
      __esModule: true,
      default: {
        getItemSync: (key) => (data.has(key) ? data.get(key) : null),
        setItemSync: (key, value) => data.set(key, value),
        removeItemSync: (key) => data.delete(key),
        getAllKeysSync: () => [...data.keys()],
      },
    },
  };
}

function createKit(options = {}) {
  const rn = createRnMock();
  rn.AccessibilityInfo.announceForAccessibility = spy();
  const insets = options.insets ?? {top: 24, bottom: 16, left: 0, right: 0};
  const routing = createRouterMock(options.router);
  const kv = createKvMock();
  const navigationBar = {setStyle: spy()};
  const statusBar = {setStatusBarStyle: spy()};
  const systemUi = {setBackgroundColorAsync: spy(() => Promise.resolve())};
  const heightContext = React.createContext(undefined);
  const mocks = {
    react: React,
    'react-native': rn,
    'react-native-reanimated': createReanimatedMock(),
    'react-native-worklets': {scheduleOnRN: (fn, ...args) => fn(...args)},
    'react-native-gesture-handler': {
      GestureDetector: ({children}) => children,
      GestureHandlerRootView: 'GestureHandlerRootView',
      usePanGesture: (config) => config,
    },
    'react-native-safe-area-context': {useSafeAreaInsets: () => insets},
    'expo-router': routing.module,
    'expo-router/head': {__esModule: true, default: ({children}) => React.createElement('Head', null, children)},
    'expo-router/js-tabs': {BottomTabBarHeightCallbackContext: heightContext},
    'expo-image': {Image: 'ExpoImage'},
    '@expo/vector-icons/createIconSet': {
      __esModule: true,
      default: (glyphMap, fontName) => {
        function GlyphIcon(props) {
          return React.createElement('Glyph', {...props, fontName, glyph: glyphMap[props.name]});
        }
        return GlyphIcon;
      },
    },
    'expo-navigation-bar': {NavigationBar: navigationBar},
    'expo-status-bar': statusBar,
    'expo-system-ui': systemUi,
    'expo-sqlite/kv-store': kv.module,
    ...(options.web ? webMocks() : {}),
    ...options.mocks,
  };
  return {
    rn,
    router: routing.router,
    routerState: routing.state,
    kv,
    navigationBar,
    statusBar,
    systemUi,
    heightContext,
    mocks,
    load: (file, extra = {}) => loadTs(file, {...mocks, ...extra}),
  };
}

function webMocks() {
  return {
    '../environment': {IS_WEB: true},
    '../a11y': loadTs('src/core/ui/a11y.web.ts'),
    './themeColors': loadTs('src/core/ui/theme/themeColors.web.ts'),
    './fontStack': loadTs('src/core/ui/theme/fontStack.web.ts'),
  };
}

function hosts(root, type) {
  return root.findAll((node) => node.type === type);
}

function texts(root) {
  return hosts(root, 'Text').map((node) => [].concat(node.props.children).filter((child) => typeof child === 'string' || typeof child === 'number').join(''));
}

function findByProp(root, name, value) {
  return root.findAll((node) => typeof node.type === 'string' && node.props[name] === value);
}

function press(node, event) {
  act(() => {
    node.props.onPress(event ?? {});
  });
}

function flatStyle(style) {
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function clipOf(node) {
  const parent = node.parent;
  if (!parent || parent.type !== 'View') return null;
  const style = flatStyle(parent.props.style);
  return style.overflow === 'hidden' && style.pointerEvents === 'box-none' ? parent : null;
}

function touchableStyle(node) {
  const clip = clipOf(node);
  return clip ? {...flatStyle(node.props.style), ...flatStyle(clip.props.style)} : flatStyle(node.props.style);
}

module.exports = {React, act, clipOf, createKit, findByProp, flatStyle, hosts, press, render, spy, texts, touchableStyle};
