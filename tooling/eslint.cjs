const {fixupConfigRules} = require('@eslint/compat');

module.exports = fixupConfigRules(require('eslint-config-expo/flat'));
