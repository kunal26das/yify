const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Follow symlinks created by yarn workspaces
config.resolver.unstable_enableSymlinks = true;

// Watch workspace package source directories directly so Metro picks up
// changes without needing a full reinstall
config.watchFolders = [
  path.resolve(projectRoot, 'domain'),
  path.resolve(projectRoot, 'data'),
  path.resolve(projectRoot, 'presentation'),
];

module.exports = config;
