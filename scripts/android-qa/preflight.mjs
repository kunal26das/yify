import {accessSync, constants, existsSync, readFileSync, readdirSync, statfsSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

export const toolchain = JSON.parse(readFileSync(new URL('./toolchain.json', import.meta.url)));
export const stages = [
    'locked-source-and-js-checks', 'hsdp-real-bytecode-regression', 'resolved-native-graph',
    'full-native-release-compile', 'all-abi-packaging', 'offline-device-launch',
    'consent-and-connected-startup', 'catalog-browsing', 'sandbox-sign-in', 'sandbox-purchase-and-restore',
];

export function sourceProblems(pkg, wrapper, catalog, reactAndroid) {
    const failures = [];
    if (pkg.dependencies?.expo !== toolchain.expo) failures.push('Expo pin differs from audited toolchain');
    if (pkg.dependencies?.['react-native'] !== toolchain.reactNative) failures.push('React Native pin differs from audited toolchain');
    if (!wrapper.includes(`gradle-${toolchain.gradle}-bin.zip`)) failures.push('Gradle wrapper differs from audited toolchain');
    if (!wrapper.includes(`distributionSha256Sum=${toolchain.gradleSha256}`)) failures.push('Gradle checksum differs from audited toolchain');
    if (!catalog) failures.push('Installed React Native version catalog is required');
    else {
        for (const [key, expected] of Object.entries({agp: toolchain.agp, compileSdk: toolchain.compileSdk,
            targetSdk: toolchain.targetSdk, minSdk: toolchain.minSdk, buildTools: toolchain.buildTools, ndkVersion: toolchain.ndk})) {
            const actual = catalog.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
            if (actual !== String(expected)) failures.push(`${key} differs from audited toolchain`);
        }
    }
    if (!reactAndroid?.includes(`System.getenv("CMAKE_VERSION") ?: "${toolchain.reactNativeCmake}"`)) {
        failures.push('Installed React Native CMake default differs from audited toolchain');
    }
    return failures;
}

export function sdkPackages(includeDevice = false) {
    return ['platform-tools', `platforms;android-${toolchain.compileSdk}`, `build-tools;${toolchain.buildTools}`,
        `ndk;${toolchain.ndk}`, ...toolchain.cmake.map(version => `cmake;${version}`),
        ...(includeDevice ? ['emulator', toolchain.emulatorImage] : [])];
}

export function properties(text) {
    return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
        const match = line.match(/^([^#!\s][^=]*?)\s*=\s*(.*?)\s*$/);
        return match ? [[match[1].trim(), match[2]]] : [];
    }));
}

function readable(path) {
    try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function executable(path) {
    try { accessSync(path, constants.X_OK); return true; } catch { return false; }
}

export function sdkPackageStatus(sdk, identifier) {
    const path = sdk && join(sdk, ...identifier.split(';'));
    const metadata = properties(path ? readable(join(path, 'source.properties')) ?? '' : '');
    const [kind, version] = identifier.split(';');
    const expectedRevision = ['ndk', 'cmake', 'build-tools'].includes(kind) ? version : null;
    const api = kind === 'platforms' || kind === 'system-images' ? version.slice('android-'.length) : null;
    const revisionOkay = Boolean(metadata['Pkg.Revision']) && (!expectedRevision || metadata['Pkg.Revision'] === expectedRevision);
    const apiOkay = !api || metadata['AndroidVersion.ApiLevel'] === api;
    const requiredFiles = {
        'platform-tools': ['adb'], 'build-tools': ['aapt2', 'apksigner', 'zipalign'],
        ndk: ['toolchains/llvm/prebuilt/linux-x86_64/bin/clang'], cmake: ['bin/cmake', 'bin/ninja'],
        emulator: ['emulator'], platforms: ['android.jar'], 'system-images': ['system.img'],
    }[kind] ?? [];
    const missing = requiredFiles.filter(file => !path ||
        (file.endsWith('.jar') || file.endsWith('.img') ? !existsSync(join(path, file)) : !executable(join(path, file))));
    const imageOkay = kind !== 'system-images' || (metadata['SystemImage.Abi'] === 'x86_64' && metadata['SystemImage.TagId'] === 'google_apis');
    return {identifier, revision: metadata['Pkg.Revision'] ?? null,
        ...(api ? {api: metadata['AndroidVersion.ApiLevel'] ?? null} : {}),
        valid: revisionOkay && apiOkay && imageOkay && missing.length === 0, missing};
}

function command(executable_, arguments_, cwd) {
    const result = spawnSync(executable_, arguments_, {cwd, encoding: 'utf8', timeout: 15000});
    return {ok: result.status === 0, text: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()};
}

function readableWritable(path) {
    try { accessSync(path, constants.R_OK | constants.W_OK); return true; } catch { return false; }
}

export function localOverrides(root) {
    return [...readdirSync(root).filter(name => /^\.env(?:$|\.)/.test(name) && name !== '.env.example'),
        ...['android/keystore.properties', 'android/local.properties'].filter(name => existsSync(join(root, name)))];
}

export const setupInputs = ['package.json', 'yarn.lock', 'tooling/package.json', 'crashreporting/package.json',
    'android/gradle/wrapper/gradle-wrapper.properties', 'scripts/android-qa/toolchain.json',
    'scripts/android-qa/preflight.mjs', 'scripts/android-qa/setup-cloud.sh', 'scripts/expo-native-compat.mjs',
    'scripts/apply-tooling-compatibility.mjs', 'tooling/compatibility-patches.json'];

export function setupInputHashes(root) {
    const patchFiles = directory => readdirSync(join(root, directory), {withFileTypes: true}).flatMap(entry => {
        const file = join(directory, entry.name);
        return entry.isDirectory() ? patchFiles(file) : entry.isFile() ? [file] : [];
    });
    return Object.fromEntries([...setupInputs, ...patchFiles('patches/expo-native')].sort().map(file => [file,
        createHash('sha256').update(readFileSync(join(root, file))).digest('hex')]));
}

export function inspect(root, expectedSha, mode = 'build') {
    if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('An immutable 40-character source SHA is required');
    if (!['audit', 'bootstrap', 'build', 'device', 'connected'].includes(mode)) throw new Error('Expected mode audit, bootstrap, build, device, or connected');
    const checks = [];
    const add = (id, okay, need, detail) => checks.push({id, status: okay ? 'pass' : 'blocked', need, ...(detail ? {detail} : {})});
    const sha = command('git', ['rev-parse', 'HEAD'], root).text;
    add('source', sha === expectedSha, 'Checkout exactly the requested SHA', sha);
    const clean = command('git', ['status', '--porcelain', '--untracked-files=normal'], root);
    add('clean-worktree', clean.ok && clean.text === '', 'Use an isolated clean checkout without source overrides');
    const overrides = localOverrides(root);
    add('no-local-overrides', overrides.length === 0, 'Use a fresh checkout without dotenv, local SDK, or signing overrides', overrides.join(', '));
    add('linux-x64', process.platform === 'linux' && process.arch === 'x64', 'This cloud setup targets Linux x86_64');
    add('node', process.versions.node === toolchain.node, `Node ${toolchain.node}`, process.versions.node);
    const yarn = command(process.env.YARN_BIN || 'yarn', ['--version'], root);
    add('yarn', yarn.ok && yarn.text === toolchain.yarn, `Yarn ${toolchain.yarn}`, yarn.ok ? yarn.text : 'not available');
    const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin/java') : 'java';
    const javaVersion = command(java, ['-version'], root);
    add('build-java', javaVersion.ok && new RegExp(`version "${toolchain.javaMajor}(?:[."])`).test(javaVersion.text), `Full JDK ${toolchain.javaMajor} for native compilation`, javaVersion.text.split('\n')[0]);
    const compiler = command(java, ['-m', 'jdk.compiler/com.sun.tools.javac.Main', '-version'], root);
    add('compiler', compiler.ok, 'JDK compiler module; the java executable alone is insufficient', compiler.text);
    const sdk = process.env.ANDROID_HOME;
    add('sdk-root', Boolean(sdk && existsSync(sdk)), 'ANDROID_HOME points at an existing Android SDK');
    add('sdk-root-consistent', !process.env.ANDROID_SDK_ROOT || sdk === process.env.ANDROID_SDK_ROOT, 'ANDROID_HOME and ANDROID_SDK_ROOT must agree');
    const manager = sdk && join(sdk, 'cmdline-tools/latest');
    const managerMetadata = properties(manager ? readable(join(manager, 'source.properties')) ?? '' : '');
    add('sdkmanager', Boolean(manager && executable(join(manager, 'bin/sdkmanager')) && managerMetadata['Pkg.Revision']), 'Official Android command-line tools with source.properties at ANDROID_HOME/cmdline-tools/latest', managerMetadata['Pkg.Revision']);
    add('sdk-licenses', Boolean(sdk && readable(join(sdk, 'licenses/android-sdk-license'))?.trim()), 'Previously accepted Android SDK licenses; never automatically accept new terms');
    const space = statfsSync(root);
    const gib = Number(space.bavail) * Number(space.bsize) / 1024 ** 3;
    add('disk', gib >= toolchain.minimumFreeGiB, `At least ${toolchain.minimumFreeGiB} GiB free before heavy installs and native compilation`, `${gib.toFixed(1)} GiB available`);
    let installed = [];
    if (mode !== 'bootstrap') {
        installed = sdkPackages(mode === 'device' || mode === 'connected').map(identifier => sdkPackageStatus(sdk, identifier));
        for (const entry of installed) add(`sdk:${entry.identifier}`, entry.valid, `Install official SDK package ${entry.identifier} with matching metadata and required tools`, JSON.stringify(entry));
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        const wrapper = readFileSync(join(root, 'android/gradle/wrapper/gradle-wrapper.properties'), 'utf8');
        const catalog = readable(join(root, 'node_modules/react-native/gradle/libs.versions.toml'));
        const reactAndroid = readable(join(root, 'node_modules/react-native/ReactAndroid/build.gradle.kts'));
        const problems = sourceProblems(pkg, wrapper, catalog, reactAndroid);
        add('audited-source-toolchain', problems.length === 0, 'Re-audit pins after source toolchain changes; installed source checks are mandatory', problems.join('; '));
        add('locked-dependencies', existsSync(join(root, 'node_modules/.yarn-integrity')) && Boolean(catalog), 'Successful root yarn install --frozen-lockfile --non-interactive including compatibility postinstall');
    }
    if (mode === 'device' || mode === 'connected') add('kvm', readableWritable('/dev/kvm'), 'Usable /dev/kvm for accelerated Linux Android emulation; no permission elevation is performed');
    if (mode === 'connected') {
        add('connected-test-service-routing', false, 'Connected Yify QA is blocked until a reviewed test-only native configuration and test-service routes exist; production defaults are present even without .env');
        add('sandbox-accounts', false, 'Verify dedicated Google/Firebase test identity and RevenueCat Test Store or Play license-tester setup; mocked tests do not establish integration coverage');
        add('device-egress-policy', false, 'Verify deny-by-default device egress before first native process start, then permit only approved test services; native startup happens before JS consent');
    }
    const fileHashes = setupInputHashes(root);
    const fingerprint = {files: fileHashes, sdk, java: javaVersion.text, compiler: compiler.text,
        commandLineTools: managerMetadata['Pkg.Revision'] ?? null, packages: installed,
        node: process.versions.node, yarn: yarn.text};
    return {schemaVersion: 1, sourceSha: sha, expectedSha, mode, passed: checks.every(check => check.status === 'pass'), checks, fingerprint,
        networkPrerequisites: ['registry.yarnpkg.com', 'registry.npmjs.org', 'services.gradle.org and its distribution redirects',
            'dl.google.com', 'repo.maven.apache.org', 'www.jitpack.io'],
        requiredEvidence: stages.map(stage => ({stage, status: 'not-run'})),
        signing: 'Production EAS profile uses remote credentials. Compile-only checks use the repository debug signer and are never store-release verification.'};
}

export function reusable(previous, current) {
    return previous?.schemaVersion === 1 && previous.mode === 'build' && previous.passed === true && current.mode === 'build' && current.passed === true &&
        JSON.stringify(previous.fingerprint) === JSON.stringify(current.fingerprint);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [action, root = '.', expectedSha, mode = 'build', receipt] = process.argv.slice(2);
    if (action === 'sdk-packages') {
        process.stdout.write(sdkPackages(root === 'device').join('\n') + '\n');
    } else if (['inspect', 'save', 'reuse'].includes(action)) {
        const result = inspect(resolve(root), expectedSha, mode);
        if (action === 'save') {
            if (!receipt || !result.passed || mode !== 'build') throw new Error('A passing build preflight and external receipt path are required');
            writeFileSync(receipt, JSON.stringify(result, null, 2) + '\n');
        }
        if (action === 'reuse') {
            const previous = receipt && readable(receipt);
            if (!previous || !reusable(JSON.parse(previous), result)) process.exitCode = 1;
        } else console.log(JSON.stringify(result, null, 2));
        if (!result.passed) process.exitCode = 1;
    } else {
        throw new Error('Usage: preflight.mjs inspect|save|reuse <checkout> <source-sha> [audit|bootstrap|build|device|connected] [receipt], or sdk-packages [device]');
    }
}
