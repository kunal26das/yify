import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const easRequire = createRequire(require.resolve('eas-cli/package.json'));

test('EAS generates App Store API key names through its installed Nano ID dependency', () => {
    const {getAscApiKeyName} = easRequire('eas-cli/build/credentials/ios/actions/AscApiKeyUtils');
    const names = Array.from({length: 20}, () => getAscApiKeyName('SUBMIT'));
    for (const name of names) assert.match(name, /^\[Expo\] SUBMIT [A-Za-z0-9_-]{10}$/);
    assert.equal(new Set(names).size, names.length);
});

test('EAS fingerprint comparison renders removed and added lines through its installed diff dependency', (t) => {
    const log = easRequire('eas-cli/build/log').default;
    const output: string[] = [];
    t.mock.method(log, 'log', (line: string) => output.push(line));
    const {abridgedDiff} = easRequire('eas-cli/build/fingerprint/diff');
    abridgedDiff('first\nold\nlast\n', 'first\nnew\nlast\n', 1);
    const plain = output.join('\n').replace(/\u001b\[[0-9;]*m/g, '');
    assert.match(plain, /@@ -1,3 \+1,3 @@/);
    assert.match(plain, /^-old$/m);
    assert.match(plain, /^\+new$/m);
    assert.match(plain, /^ last$/m);
});

test('Xcode generates distinct project identifiers through its installed UUID dependency', () => {
    const project = easRequire('xcode').project('compatibility.pbxproj');
    project.hash = {project: {objects: {}}};
    const ids = Array.from({length: 20}, () => project.generateUuid());
    for (const id of ids) assert.match(id, /^[0-9A-F]{24}$/);
    assert.equal(new Set(ids).size, ids.length);
});

test('EAS accepts a valid wildcard iOS provisioning profile and rejects another bundle identifier', async (t) => {
    const forge = easRequire('node-forge');
    const plist = easRequire('@expo/plist').default;
    const keyPair = forge.pki.rsa.generateKeyPair({bits: 1024});
    const cert = forge.pki.createCertificate();
    cert.publicKey = keyPair.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 60_000);
    cert.validity.notAfter = new Date(Date.now() + 86_400_000);
    const subject = [{name: 'commonName', value: 'Dependency compatibility fixture'}];
    cert.setSubject(subject);
    cert.setIssuer(subject);
    cert.sign(keyPair.privateKey, forge.md.sha256.create());
    const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const certificateP12 = forge.util.encode64(forge.asn1.toDer(
        forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, cert, 'fixture', {algorithm: '3des'}),
    ).getBytes());
    const profile = plist.build({
        Entitlements: {'application-identifier': 'TESTTEAM.com.example.*'},
        DeveloperCertificates: [forge.util.encode64(certificateDer)],
        ExpirationDate: cert.validity.notAfter,
    });
    const credentials = {
        distributionCertificate: {certificateP12, certificatePassword: 'fixture'},
        provisioningProfile: {provisioningProfile: Buffer.from(profile).toString('base64')},
    };
    const log = easRequire('eas-cli/build/log').default;
    t.mock.method(log, 'warn', () => {});
    const {validateProvisioningProfileAsync} = easRequire('eas-cli/build/credentials/ios/validators/validateProvisioningProfile');
    const context = {appStore: {authCtx: null}};
    assert.equal(await validateProvisioningProfileAsync(context, {}, {bundleIdentifier: 'com.example.app'}, credentials), true);
    assert.equal(await validateProvisioningProfileAsync(context, {}, {bundleIdentifier: 'org.example.app'}, credentials), false);
});

test('EAS build profiles retain defaults, inheritance and invalid-value rejection', () => {
    const {EasJsonSchema} = easRequire('@expo/eas-json/build/schema');
    const {resolveBuildProfile} = easRequire('@expo/eas-json/build/build/resolver');
    const easJson = {
        build: {
            base: {environment: 'production', env: {SHARED: 'yes'}, android: {credentialsSource: 'local'}},
            production: {extends: 'base', env: {CHILD: 'yes'}, android: {buildType: 'app-bundle'}},
        },
    };
    assert.equal(EasJsonSchema.validate(easJson).error, undefined);
    const profile = resolveBuildProfile({easJson, platform: 'android', profileName: 'production'});
    assert.equal(profile.distribution, 'store');
    assert.equal(profile.credentialsSource, 'local');
    assert.equal(profile.buildType, 'app-bundle');
    assert.equal(profile.environment, 'production');
    assert.deepEqual(profile.env, {SHARED: 'yes', CHILD: 'yes'});
    assert.ok(EasJsonSchema.validate({build: {bad: {android: {buildType: 'invalid'}}}}).error);
    assert.ok(EasJsonSchema.validate({build: {bad: {cache: {paths: ['a'], customPaths: ['b']}}}}).error);
});

test('EAS submission schemas enforce rollout conditions and Apple account identifiers', () => {
    const {AndroidSubmitProfileSchema, ResolvedIosSubmitProfileSchema} = easRequire('@expo/eas-json/build/submit/schema');
    const defaults = AndroidSubmitProfileSchema.validate({});
    assert.equal(defaults.error, undefined);
    assert.equal(defaults.value.track, 'internal');
    assert.equal(defaults.value.releaseStatus, 'completed');
    assert.equal(defaults.value.changesNotSentForReview, false);
    assert.equal(AndroidSubmitProfileSchema.validate({releaseStatus: 'inProgress', rollout: 0.25}).error, undefined);
    assert.ok(AndroidSubmitProfileSchema.validate({releaseStatus: 'inProgress'}).error);
    assert.ok(AndroidSubmitProfileSchema.validate({releaseStatus: 'completed', rollout: 0.25}).error);
    assert.equal(ResolvedIosSubmitProfileSchema.validate({
        ascApiKeyIssuerId: 'f841b08e-0831-4530-b834-6852b48b7fcb', appleId: 'developer@example.com',
    }).error, undefined);
    assert.ok(ResolvedIosSubmitProfileSchema.validate({ascApiKeyIssuerId: 'invalid'}).error);
    assert.ok(ResolvedIosSubmitProfileSchema.validate({appleId: 'invalid'}).error);
});

test('EAS credentials schemas permit empty passwords and reject incomplete credentials', () => {
    const {CredentialsJsonSchema} = easRequire('eas-cli/build/credentials/credentialsJson/types');
    assert.equal(CredentialsJsonSchema.validate({
        android: {keystore: {keystorePath: 'key.jks', keystorePassword: '', keyAlias: 'release', keyPassword: ''}},
        ios: {provisioningProfilePath: 'app.mobileprovision', distributionCertificate: {path: 'cert.p12', password: ''}},
    }).error, undefined);
    assert.ok(CredentialsJsonSchema.validate({android: {keystore: {keystorePath: 'key.jks'}}}).error);
});

test('EAS custom build steps preserve schema aliases, input types and environment coercion', () => {
    const {BuildConfigSchema} = easRequire('@expo/steps/dist/BuildConfig');
    const result = BuildConfigSchema.validate({
        functions: {hello: {command: 'echo hi', inputs: [{name: 'enabled', type: 'boolean', default_value: true}]}},
        build: {steps: [{hello: {}}, {run: {command: 'echo hi', env: {COUNT: 1}, working_directory: 'app'}}]},
    });
    assert.equal(result.error, undefined);
    assert.equal(result.value.functions.hello.inputs[0].allowedValueType, 'boolean');
    assert.equal(result.value.functions.hello.inputs[0].defaultValue, true);
    assert.equal(result.value.build.steps[1].run.env.COUNT, '1');
    assert.equal(result.value.build.steps[1].run.workingDirectory, 'app');
    assert.ok(BuildConfigSchema.validate({build: {steps: [null]}}).error);
});

test('EAS build jobs retain validation, defaults and unknown-field sanitization', () => {
    const {sanitizeBuildJob} = easRequire('@expo/eas-build-job/dist/job');
    const job = {
        platform: 'android', type: 'generic', projectArchive: {type: 'URL', url: 'https://example.com/build.tgz'},
        projectRootDirectory: '.', secrets: {}, initiatingUserId: 'fixture-user', appId: 'fixture-app', unexpected: true,
    };
    const sanitized = sanitizeBuildJob(job);
    assert.equal(sanitized.platform, 'android');
    assert.equal(sanitized.mode, 'build');
    assert.equal(sanitized.triggeredBy, 'EAS_CLI');
    assert.equal(sanitized.unexpected, undefined);
    assert.throws(() => sanitizeBuildJob({...job, platform: 'invalid'}));
    assert.throws(() => sanitizeBuildJob({...job, projectArchive: {type: 'URL', url: 'invalid'}}));
});
