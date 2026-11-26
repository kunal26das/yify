const {spy} = require('./kit.cjs');

function tabProps(focusedIndex = 0, options = {}) {
  const routes = ['(home)', '(search)', '(library)', '(you)'].map((name) => ({key: `${name}-key`, name, params: undefined}));
  const emitted = [];
  const emitter = {
    emit: spy((event) => {
      emitted.push(event);
      return {defaultPrevented: options.prevent === true};
    }),
  };
  return {
    emitted,
    props: {
      state: {index: focusedIndex, routes},
      descriptors: {},
      emitter,
      navigateToTab: spy(),
      insets: {top: 24, bottom: 16, left: 0, right: 0},
      youBadge: options.youBadge ?? 'none',
    },
  };
}

module.exports = {tabProps};
