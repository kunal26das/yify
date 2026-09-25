const {withAppDelegate} = require('@expo/config-plugins');

module.exports = (config) => withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
        throw new Error('withFirebaseSceneStartup requires a Swift AppDelegate.');
    }
    let contents = cfg.modResults.contents;
    const ending = contents.includes('\r\n') ? '\r\n' : '\n';
    if (!/^\s*(?:(?:public|internal)\s+)?import FirebaseCore\s*$/m.test(contents)) {
        contents = `import FirebaseCore${ending}${contents}`;
    }
    if (!/\bFirebaseApp\.configure\s*\(/.test(contents)) {
        const launch = /\b(?:public\s+)?override\s+func\s+application\([^{}]*?\bdidFinishLaunchingWithOptions\b[^{}]*?\)\s*->\s*Bool\s*\{/g;
        if ([...contents.matchAll(launch)].length !== 1) {
            throw new Error('withFirebaseSceneStartup requires one didFinishLaunchingWithOptions method.');
        }
        contents = contents.replace(launch, (method) => `${method}${ending}    if FirebaseApp.app() == nil {${ending}      FirebaseApp.configure()${ending}    }${ending}`);
    }
    cfg.modResults.contents = contents;
    return cfg;
});
