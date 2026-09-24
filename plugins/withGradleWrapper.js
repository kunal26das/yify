const fs = require('node:fs/promises');
const path = require('node:path');
const {withDangerousMod, withGradleProperties} = require('@expo/config-plugins');

const DISTRIBUTION = 'https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip';
const CHECKSUM = '2ab2958f2a1e51120c326cad6f385153bb11ee93b3c216c5fccebfdfbb7ec6cb';

module.exports = (config) => withDangerousMod(withGradleProperties(config, (cfg) => {
    const keys = ['android.newDsl', 'android.builtInKotlin'];
    cfg.modResults = cfg.modResults.filter((entry) => !(entry.type === 'property' && keys.includes(entry.key)));
    cfg.modResults.push(...keys.map((key) => ({type: 'property', key, value: 'false'})));
    return cfg;
}), ['android', async (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, 'gradle/wrapper/gradle-wrapper.properties');
    const contents = await fs.readFile(file, 'utf8');
    const ending = contents.includes('\r\n') ? '\r\n' : '\n';
    const lines = contents.split(/\r?\n/);
    const urls = lines.filter((line) => /^distributionUrl=/.test(line));
    const checksums = lines.filter((line) => /^distributionSha256Sum=/.test(line));
    if (urls.length !== 1 || checksums.length > 1) {
        throw new Error('withGradleWrapper requires one distributionUrl and at most one distributionSha256Sum.');
    }
    const result = lines.map((line) => {
        if (/^distributionUrl=/.test(line)) return `distributionUrl=${DISTRIBUTION}`;
        if (/^distributionSha256Sum=/.test(line)) return `distributionSha256Sum=${CHECKSUM}`;
        return line;
    });
    if (checksums.length === 0) {
        const index = result.findIndex((line) => /^distributionUrl=/.test(line));
        result.splice(index + 1, 0, `distributionSha256Sum=${CHECKSUM}`);
    }
    const updated = result.join(ending);
    if (updated !== contents) await fs.writeFile(file, updated);
    return cfg;
}]);
