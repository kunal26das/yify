module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', {worklets: false}]],
    plugins: [require('./tooling/babel.cjs')],
  };
};
