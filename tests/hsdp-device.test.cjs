const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const SHA = 'a'.repeat(40);
const RUN = 'local-test-run';
const ROOT = path.resolve(__dirname, '..');

function eventFixture(variant, scenario) {
    const raw = scenario === 'raw-missing';
    const activity = raw ? 'com.google.android.play.core.hsdp.service.HsdpShimActivity' : 'io.github.kunal26das.hsdpregression.CallbackProbeActivity';
    const entries = ['driver_started', 'launch_requested'];
    if (!raw) entries.push('probe_create_enter');
    entries.push('framework_created');
    if (!raw) entries.push('probe_create_exit');
    entries.push('framework_post_created');
    if (!scenario.endsWith('-create') && !raw) {
        entries.push('framework_attached');
        if (scenario === 'configuration') entries.push('sdk_attach_deferred', 'framework_configuration');
        if (scenario === 'new-intent') entries.push('sdk_attach_deferred', 'framework_new_intent');
        entries.push('sdk_callback_enter');
        entries.push(...(variant === 'legacy' ? ['sdk_callback_throw'] : ['sdk_callback_exit', 'sdk_callback_repeat_exit']));
    }
    if (variant === 'fixed') entries.push('framework_destroyed');
    return entries.map((event, index) => ({run: RUN, case: scenario, event,
        version: variant === 'legacy' ? '2.0.1' : '2.2.0', sourceSha: SHA, api: 30, pid: 123,
        elapsedNanos: index, activity, windowToken: true,
        finishing: variant === 'fixed' && (scenario.endsWith('-create') || raw
            ? ['probe_create_exit', 'framework_post_created', 'framework_destroyed'].includes(event)
            : ['sdk_callback_exit', 'sdk_callback_repeat_exit', 'framework_destroyed'].includes(event)), detail: event === 'sdk_callback_throw'
            ? 'java.lang.IllegalStateException: targetPackageName is null' : scenario,
    }));
}
const log = (variant, scenario) => variant === 'legacy' ? `FATAL EXCEPTION: main\nProcess: io.github.kunal26das.hsdpregression.legacy, PID: 123\njava.lang.IllegalStateException: targetPackageName is null\n at com.google.android.play.core.hsdp.service.HsdpShimActivity.${{attached:'onAttachedToWindow',configuration:'onConfigurationChanged','new-intent':'onNewIntent','raw-missing':'onAttachedToWindow'}[scenario]}` : '';
const evidence = (variant, scenario) => ({events: eventFixture(variant, scenario), logcat: log(variant, scenario),
    variant, scenario, run: RUN, sourceSha: SHA, api: 30});

test('all required cases distinguish original process crash from fixed completion', async () => {
    const {verifyCase} = await import('../qa/hsdp-device/evidence.mjs');
    for (const variant of ['legacy', 'fixed']) {
        for (const scenario of ['raw-missing', 'attached', 'configuration', 'new-intent', ...(variant === 'fixed' ? ['empty-create', 'null-create'] : [])]) {
            assert.equal(verifyCase(evidence(variant, scenario)).result,
                variant === 'legacy' ? 'expected-original-process-crash' : 'finished-safely');
        }
    }
});

test('absence of launch, callback, token, repeat, crash or destruction cannot pass', async () => {
    const {verifyCase} = await import('../qa/hsdp-device/evidence.mjs');
    for (const name of ['driver_started', 'launch_requested', 'framework_created', 'framework_configuration',
        'sdk_callback_enter', 'sdk_callback_exit', 'sdk_callback_repeat_exit', 'framework_destroyed']) {
        const input = evidence('fixed', 'configuration');
        input.events = input.events.filter(item => item.event !== name);
        assert.throws(() => verifyCase(input), undefined, name);
    }
    const missingWindow = evidence('fixed', 'attached');
    missingWindow.events.forEach(item => { item.windowToken = false; });
    assert.throws(() => verifyCase(missingWindow), /attached Android window/);
    assert.throws(() => verifyCase({...evidence('legacy', 'attached'), logcat: ''}), /process crash/);
    assert.throws(() => verifyCase({...evidence('fixed', 'attached'), logcat: 'FATAL EXCEPTION: main'}), /crashed/);
    for (const scenario of ['raw-missing', 'empty-create', 'null-create']) {
        const withoutPost = evidence('fixed', scenario);
        withoutPost.events = withoutPost.events.filter(item => item.event !== 'framework_post_created');
        assert.throws(() => verifyCase(withoutPost), /after SDK initialization/);
        const withoutFinish = evidence('fixed', scenario);
        withoutFinish.events.find(item => item.event === 'framework_post_created').finishing = false;
        assert.throws(() => verifyCase(withoutFinish), /after SDK initialization/);
        const earlyFinish = evidence('fixed', scenario);
        earlyFinish.events.find(item => item.event === 'framework_created').finishing = true;
        assert.throws(() => verifyCase(earlyFinish), /after SDK initialization/);
    }
});

test('stale identity, other exceptions and wrong callback crashes cannot pass', async () => {
    const {verifyCase} = await import('../qa/hsdp-device/evidence.mjs');
    for (const key of ['run', 'version', 'sourceSha', 'api', 'pid']) {
        const input = evidence('legacy', 'attached');
        input.events[2][key] = key === 'pid' || key === 'api' ? 999 : 'wrong';
        assert.throws(() => verifyCase(input), /Mixed or stale/);
    }
    assert.throws(() => verifyCase({...evidence('legacy', 'attached'), logcat: log('legacy', 'attached').replace('targetPackageName', 'windowToken')}), /expected old-version/i);
    assert.throws(() => verifyCase({...evidence('legacy', 'attached'), logcat: log('legacy', 'configuration')}), /intended HSDP callback/);
});

test('merged APK gate rejects network access, providers, wrong graph/hash and exported original activity', async () => {
    const {verifyManifest} = await import('../qa/hsdp-device/evidence.mjs');
    const {variants} = await import('../qa/hsdp-device/policy.mjs');
    const variant = 'fixed';
    const target = variants.fixed;
    const good = {variant, sourceSha: SHA,
        badging: `package: name='${target.packageName}' versionCode='1'\nsdkVersion:'24'\ntargetSdkVersion:'36'`,
        xml: 'E: manifest\n E: application\n  E: activity\n   A: android:name="io.github.kunal26das.hsdpregression.DriverActivity"\n  E: activity\n   A: android:name="io.github.kunal26das.hsdpregression.CallbackProbeActivity"\n  E: activity\n   A: android:name="com.google.android.play.core.hsdp.service.HsdpShimActivity"\n   A: android:exported(0x1010010)=(type 0x12)0x0',
        aarReceipt: {sourceSha: SHA, hsdp: target.version, aarSha256: target.aarSha256, dependencies: ['com.google.android.play:hsdp:2.2.0']}};
    verifyManifest(good);
    assert.throws(() => verifyManifest({...good, badging: good.badging + "\nuses-permission: name='android.permission.INTERNET'"}), /no permissions/);
    assert.throws(() => verifyManifest({...good, xml: good.xml + '\n E: provider'}), /no content providers/);
    assert.throws(() => verifyManifest({...good, xml: good.xml.replace('(type 0x12)0x0', '(type 0x12)0xffffffff')}), /non-exported/);
    assert.throws(() => verifyManifest({...good, aarReceipt: {...good.aarReceipt, aarSha256: 'wrong'}}), /checksum/);
    assert.throws(() => verifyManifest({...good, aarReceipt: {...good.aarReceipt, dependencies: [...good.aarReceipt.dependencies, 'com.google.firebase:firebase-common:1.0']}}), /Forbidden/);
});

test('SDK metadata keeps source API37.0 stable and separately pins API30/API36 images', async () => {
    const {verifyPlatform, verifyImage} = await import('../qa/hsdp-device/check-sdk.mjs');
    const platform = {'AndroidVersion.ApiLevel':'37.0','Pkg.Revision':'2','Platform.CodeName':'',
        'AndroidVersion.CodeName':'','AndroidVersion.PreviewSdkInt':'0','AndroidVersion.BetaVersion':'','AndroidVersion.IsBaseSdk':'true'};
    verifyPlatform(platform);
    for (const [key,value] of [['AndroidVersion.ApiLevel','37.1'],['AndroidVersion.MinorApiLevel','1'],['AndroidVersion.PreviewSdkInt','1'],['Pkg.Revision','1']]) {
        assert.throws(() => verifyPlatform({...platform,[key]:value}), /stable source/);
    }
    for (const api of [30,36]) verifyImage({'AndroidVersion.ApiLevel':String(api),'Pkg.Revision':'1','SystemImage.Abi':'x86_64','SystemImage.TagId':'default'}, api);
    assert.throws(() => verifyImage({'AndroidVersion.ApiLevel':'36','Pkg.Revision':'1','SystemImage.Abi':'x86_64','SystemImage.TagId':'google_apis'},36), /Wrong test image/);
    assert.throws(() => verifyImage({'AndroidVersion.ApiLevel':'37','Pkg.Revision':'1','SystemImage.Abi':'x86_64','SystemImage.TagId':'default'},36), /Wrong test image/);
});

test('workflow grants only its runner KVM access and does not accept licenses', () => {
    const workflow = fs.readFileSync(path.join(ROOT,'.github/workflows/hsdp-framework-qa.yml'),'utf8');
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /api: \[30, 36\]/);
    const gradle = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/app/build.gradle'), 'utf8');
    assert.match(gradle, /buildToolsVersion '37\.0\.0'/);
    assert.doesNotMatch(workflow, /secrets\.|pull_request_target:|push:/);
    assert.match(workflow, /sudo chown "\$\(id -u\):\$\(id -g\)" \/dev\/kvm/);
    assert.match(workflow, /sudo chmod 0600 \/dev\/kvm/);
    assert.match(workflow, /HOST_KVM_ACCESS_CHANGED: 'true'/);
    const scripts = ['run.sh','run-isolated.sh','run-device.mjs'].map(name => fs.readFileSync(path.join(ROOT,'qa/hsdp-device',name),'utf8')).join('\n');
    assert.doesNotMatch(scripts, /sudo|chmod|chown|usermod|--licenses|yes\s*\||iptables|ip6tables|airplane-mode|svc.*(?:wifi|data)|\"\$ANDROID_SERIAL\" root/);
    assert.match(scripts, /if \[\[ ! -r \/dev\/kvm \|\| ! -w \/dev\/kvm \]\]; then[\s\S]*?exit 1/);
    assert.match(scripts, /hostSecurityChanged: hostKvmAccessChanged/);
    assert.match(scripts, /--install[^\n]+<\/dev\/null/);
    assert.match(scripts, /Refusing to modify an unowned emulator/);
    const driver = fs.readFileSync(path.join(ROOT,'qa/hsdp-device/app/src/main/java/io/github/kunal26das/hsdpregression/CallbackProbeActivity.java'),'utf8');
    assert.match(driver, /throw error;/);
    assert.match(driver, /super\.onAttachedToWindow/);
    assert.match(driver, /super\.onConfigurationChanged/);
    assert.match(driver, /super\.onNewIntent/);
    const application = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/app/src/main/java/io/github/kunal26das/hsdpregression/ProbeApplication.java'), 'utf8');
    assert.match(application, /onActivityPostCreated\(Activity activity, Bundle state\) \{ record\("framework_post_created", activity\); \}/);
    const manifest = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/app/src/main/AndroidManifest.xml'), 'utf8');
    assert.match(manifest, /configChanges="[^"]*smallestScreenSize/);
});

test('workflow limits PR execution to same-repository immutable heads and relevant paths', () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/hsdp-framework-qa.yml'), 'utf8');
    assert.match(workflow, /pull_request:\n    paths:\n      - \.github\/workflows\/hsdp-framework-qa\.yml\n      - qa\/hsdp-device\/\*\*\n      - tests\/hsdp-device\.test\.cjs\n  workflow_dispatch:/);
    assert.match(workflow, /github\.repository == 'kunal26das\/yify' &&\n      \(\(github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository\) \|\|\n      \(github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'\)\)/);
    assert.equal(workflow.match(/github\.event\.pull_request\.head\.sha \|\| inputs\.source_sha/g)?.length, 3);
    assert.match(workflow, /permissions:\n  contents: read/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /\[\[ "\$SOURCE_SHA" =~ \^\[a-f0-9\]\{40\}\$ \]\]/);
    assert.doesNotMatch(workflow, /contents: write|id-token:|pull-requests: write|github\.sha/);
});

function identityFixture() {
    const expected = {sourceSha: SHA, hsdpVersion: '2.0.1', packageName: 'io.github.kunal26das.hsdpregression.legacy', uid: 10130};
    return {expected, value: {...expected, evidenceVersion: 1, packageUid: 10130, pid: 123, groups: [50130, 9997],
        procUid: '10130 10130 10130 10130', procGid: '10130 10130 10130 10130', procGroups: '50130 9997',
        socketCreationProbes: [2, 10].flatMap(family => [1, 2].map(type => ({family, type, created: false, errno: 13, noAddressOrTraffic: true}))),
        internetPermission: -1, requestedPermissions: [], sharedUserId: null}};
}

test('in-process identity requires distinct application UID and denied Internet capability', async () => {
    const {verifyProcessIdentity} = await import('../qa/hsdp-device/process-identity.mjs');
    const {expected, value} = identityFixture();
    assert.equal(verifyProcessIdentity(value, expected), value);
    for (const delta of [{groups: [3003]}, {internetPermission: 0}, {uid: 2000}, {packageUid: 2000}, {pid: null},
        {groups: ['3003']}, {groups: null}, {requestedPermissions: ['android.permission.INTERNET']}, {sharedUserId: 'shared'},
        {evidenceVersion: 2}, {sourceSha: 'other'}, {hsdpVersion: '2.2.0'}, {packageName: 'other'},
        {procUid: '2000 2000 2000 2000'}, {procGid: '10130'}, {procGroups: '3003'}]) {
        assert.throws(() => verifyProcessIdentity({...value, ...delta}, expected));
    }
    assert.throws(() => verifyProcessIdentity('uid=10130(u0_a130) groups=3003(inet)', expected));
});

test('all four IPv4/IPv6 stream/datagram socket probes must fail before address or traffic', async () => {
    const {verifyProcessIdentity} = await import('../qa/hsdp-device/process-identity.mjs');
    const {expected, value} = identityFixture();
    for (const probes of [[], value.socketCreationProbes.slice(1), Array(4).fill(value.socketCreationProbes[0]),
        ...[{created: true}, {errno: 97}, {family: 1}, {type: 3}, {noAddressOrTraffic: false}].map(delta =>
            value.socketCreationProbes.map((probe, index) => index ? probe : {...probe, ...delta}))]) {
        assert.throws(() => verifyProcessIdentity({...value, socketCreationProbes: probes}, expected));
    }
});

test('identity gate runs before any driver navigation and evidence is tied to each case PID', () => {
    const java = name => fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/app/src/main/java/io/github/kunal26das/hsdpregression', name + '.java'), 'utf8');
    assert.match(java('ProbeApplication'), /super\.onCreate\(\);\s+IdentityEvidence\.verify\(this\);/);
    assert.match(java('DriverActivity'), /if \(getIntent\(\)\.getBooleanExtra\("qa_identity_only", false\)\) \{\s+finish\(\);\s+return;/);
    assert.match(java('IdentityEvidence'), /new FileReader\("\/proc\/self\/status"\)/);
    assert.doesNotMatch(java('IdentityEvidence'), /Os\.(?:connect|bind|sendto)|new (?:Socket|DatagramSocket)/);
    const script = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/run-device.mjs'), 'utf8');
    assert.match(script, /actualIdentity\.pid === result\.pid/);
    assert.match(script, /!confinement\.some\(item => item\.uid === installedIdentity\.uid\)/);
    assert.match(script, /wholeOsNetworkConfinement: false, guestFirewallApplied: false/);
    assert.match(script, /runAsGroupEvidenceUsed: false/);
    assert.doesNotMatch(script, /run-as[^\n]*['"]id['"]/);
});

test('aapt format adapter preserves old dumps and rejects ambiguous SDK fields', async () => {
    const {normalizeBadging, normalizeManifest} = await import('../qa/hsdp-device/aapt-format.mjs');
    assert.equal(normalizeBadging("minSdkVersion:'24'\ntargetSdkVersion:'36'"), "sdkVersion:'24'\ntargetSdkVersion:'36'");
    assert.equal(normalizeBadging("sdkVersion:'24'\ntargetSdkVersion:'36'"), "sdkVersion:'24'\ntargetSdkVersion:'36'");
    for (const value of ["sdkVersion:'23'\nminSdkVersion:'24'", "targetSdkVersion:'36'", "minSdkVersion:'24'\ntargetSdkVersion:'36'\ntargetSdkVersion:'35'"]) {
        assert.throws(() => normalizeBadging(value));
    }
    assert.equal(normalizeManifest(' A: android:exported(0x01010010)=false'), ' A: android:exported(0x01010010)=(type 0x12)0x0');
    assert.equal(normalizeManifest(' A: android:exported(0x01010010)=(type 0x12)0x0'), ' A: android:exported(0x01010010)=(type 0x12)0x0');
});

test('compiled component gate rejects added entrypoints, shared UID and replaced identity Application', async () => {
    const {verifyComponents} = await import('../qa/hsdp-device/component-manifest.mjs');
    const {normalizeManifest} = await import('../qa/hsdp-device/aapt-format.mjs');
    const good = 'E: manifest\n E: application\n  A: android:name="io.github.kunal26das.hsdpregression.ProbeApplication"\n' +
        [['io.github.kunal26das.hsdpregression.DriverActivity', true], ['io.github.kunal26das.hsdpregression.CallbackProbeActivity', false],
            ['com.google.android.play.core.hsdp.service.HsdpShimActivity', false]].map(([name, exported]) =>
            `  E: activity\n   A: android:name="${name}"\n   A: android:exported(0x01010010)=${exported}\n`).join('');
    const verify = text => verifyComponents(normalizeManifest(text));
    verify(good);
    for (const bad of [good.replace('ProbeApplication', 'OtherApplication'), good.replace('exported(0x01010010)=false', 'exported(0x01010010)=true'),
        good.replace('CallbackProbeActivity', 'OtherActivity'), good + ' E: service', good + ' E: receiver', good + ' E: provider',
        good + ' E: activity-alias', good + ' A: android:sharedUserId="shared"', good.replace('E: application', 'E: application\n E: application'),
        good.replace('exported(0x01010010)=true', 'exported(0x01010010)=true\n   A: android:exported(0x01010010)=false')]) assert.throws(() => verify(bad));
});

test('framework readiness requires boot, responsive services and three consistent system-server probes', async () => {
    const {advanceReadiness} = await import('../qa/hsdp-device/framework-ready.mjs');
    const initial = {systemServerPid: null, consecutive: 0};
    const probe = {boot: '1', beforePid: '321', afterPid: '321',
        services: 'Service package: found\nService activity: found\nService window: found\npackage:/system/framework/framework-res.apk\nACTIVITY MANAGER ACTIVITIES\nWINDOW MANAGER WINDOWS'};
    let state = initial;
    for (let count = 1; count <= 3; count++) {
        state = advanceReadiness(state, probe);
        assert.deepEqual(state, {systemServerPid: '321', consecutive: count});
    }
    for (const delta of [{boot: '0'}, {beforePid: ''}, {beforePid: '0', afterPid: '0'}, {beforePid: '321 322'},
        {afterPid: '322'}, {error: 'timeout'}, {services: ''},
        ...['Service package: found', 'Service activity: found', 'Service window: found', 'framework-res.apk',
            'ACTIVITY MANAGER ACTIVITIES', 'WINDOW MANAGER WINDOWS'].map(marker => ({services: probe.services.replace(marker, 'missing')}))]) {
        assert.deepEqual(advanceReadiness(state, {...probe, ...delta}), initial);
    }
    assert.deepEqual(advanceReadiness(state, {...probe, beforePid: '322', afterPid: '322'}), {systemServerPid: '322', consecutive: 1});
    assert.deepEqual(advanceReadiness(initial, probe), {systemServerPid: '321', consecutive: 1});
});

test('hosted boot uses bounded readiness and preserves continuous and failure diagnostics', () => {
    const script = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/run-isolated.sh'), 'utf8');
    const readiness = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/framework-ready.mjs'), 'utf8');
    assert.match(script, /framework-ready\.mjs/);
    assert.match(script, /continuous-boot-logcat\.txt/);
    assert.match(script, /failure-logcat\.txt/);
    assert.match(readiness, /deadline = started \+ 540000/);
    assert.match(readiness, /timeout: Math\.min\(30000, remaining\)/);
    assert.match(readiness, /state\.consecutive >= 3 && Date\.now\(\) < deadline/);
    assert.match(readiness, /setTimeout\(Math\.min\(3000,/);
    assert.doesNotMatch(script + readiness, /watchdog|setprop|iptables|ip6tables|sudo|chmod|chown|usermod/);
    const driver = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/run-device.mjs'), 'utf8');
    assert.match(driver, /\(\?:gms\|gsf\)/);
});
