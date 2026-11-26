const {getSentryExpoConfig} = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'android' && moduleName === '@revenuecat/purchases-js-hybrid-mappings') {
        return {type: 'empty'};
    }
    return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
