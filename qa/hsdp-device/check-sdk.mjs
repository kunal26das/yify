import {readFileSync, writeFileSync, accessSync, constants} from 'node:fs';
import path from 'node:path';
import {images, toolchain} from './policy.mjs';
export function properties(text) {
    return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
        const match = line.match(/^([^#!\s][^=]*?)\s*=\s*(.*?)\s*$/);
        return match ? [[match[1].trim(), match[2]]] : [];
    }));
}
export function verifyPlatform(metadata) {
    if (metadata['AndroidVersion.ApiLevel'] !== '37.0' || metadata['Pkg.Revision'] !== '2' ||
        (metadata['AndroidVersion.MinorApiLevel'] ?? '0') !== '0' ||
        metadata['Platform.CodeName'] !== '' || metadata['AndroidVersion.CodeName'] !== '' ||
        metadata['AndroidVersion.PreviewSdkInt'] !== '0' || metadata['AndroidVersion.BetaVersion'] !== '' ||
        metadata['AndroidVersion.IsBaseSdk'] !== 'true') throw new Error('Expected stable source API37.0 revision2, not preview/minor replacement');
}
export function verifyImage(metadata, api) {
    if (metadata['AndroidVersion.ApiLevel'] !== String(api) || metadata['SystemImage.Abi'] !== 'x86_64' ||
        metadata['SystemImage.TagId'] !== 'google_apis' || !metadata['Pkg.Revision']) throw new Error('Wrong test image API, ABI or flavor');
}
const [sdk, api, output] = process.argv.slice(2);
if (output) {
    if (!images[api]) throw new Error('Only API30/API35 are reviewed for this incident');
    const metadata = relative => properties(readFileSync(path.join(sdk, relative, 'source.properties'), 'utf8'));
    const platform = metadata('platforms/android-37.0');
    const image = metadata(images[api].replaceAll(';', '/'));
    const build = metadata(`build-tools/${toolchain.buildTools}`);
    const manager = metadata('cmdline-tools/latest');
    verifyPlatform(platform);
    verifyImage(image, api);
    if (build['Pkg.Revision'] !== toolchain.buildTools || manager['Pkg.Revision'] !== toolchain.cmdlineTools) throw new Error('Unexpected build-tools or command-line-tools revision');
    for (const entry of ['platform-tools/adb', 'emulator/emulator', `build-tools/${toolchain.buildTools}/aapt2`,
        `build-tools/${toolchain.buildTools}/apksigner`, 'cmdline-tools/latest/bin/avdmanager']) accessSync(path.join(sdk, entry), constants.X_OK);
    accessSync(path.join(sdk, 'platforms/android-37.0/android.jar'), constants.R_OK);
    accessSync(path.join(sdk, images[api].replaceAll(';', '/'), 'system.img'), constants.R_OK);
    writeFileSync(output, JSON.stringify({toolchain, platform, image, build, manager,
        platformTools: metadata('platform-tools'), emulator: metadata('emulator')}, null, 2), {flag: 'wx'});
}
