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
    if (!raw) entries.push('probe_create_enter', 'probe_create_exit');
    entries.push('framework_created');
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
        finishing: variant === 'fixed', detail: event === 'sdk_callback_throw'
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

test('SDK metadata keeps source API37.0 stable and separately pins API30/API35 images', async () => {
    const {verifyPlatform, verifyImage} = await import('../qa/hsdp-device/check-sdk.mjs');
    const platform = {'AndroidVersion.ApiLevel':'37.0','Pkg.Revision':'2','Platform.CodeName':'',
        'AndroidVersion.CodeName':'','AndroidVersion.PreviewSdkInt':'0','AndroidVersion.BetaVersion':'','AndroidVersion.IsBaseSdk':'true'};
    verifyPlatform(platform);
    for (const [key,value] of [['AndroidVersion.ApiLevel','37.1'],['AndroidVersion.MinorApiLevel','1'],['AndroidVersion.PreviewSdkInt','1'],['Pkg.Revision','1']]) {
        assert.throws(() => verifyPlatform({...platform,[key]:value}), /stable source/);
    }
    for (const api of [30,35]) verifyImage({'AndroidVersion.ApiLevel':String(api),'Pkg.Revision':'1','SystemImage.Abi':'x86_64','SystemImage.TagId':'google_apis'}, api);
    assert.throws(() => verifyImage({'AndroidVersion.ApiLevel':'37','Pkg.Revision':'1','SystemImage.Abi':'x86_64','SystemImage.TagId':'google_apis'},35), /Wrong test image/);
});

test('workflow remains manual, secret-free and does not change host permissions or accept licenses', () => {
    const workflow = fs.readFileSync(path.join(ROOT,'.github/workflows/hsdp-framework-qa.yml'),'utf8');
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /api: \[30, 35\]/);
    const gradle = fs.readFileSync(path.join(ROOT, 'qa/hsdp-device/app/build.gradle'), 'utf8');
    assert.match(gradle, /buildToolsVersion '37\.0\.0'/);
    assert.doesNotMatch(workflow, /secrets\.|pull_request:|push:/);
    const scripts = ['run.sh','run-isolated.sh','run-device.mjs'].map(name => fs.readFileSync(path.join(ROOT,'qa/hsdp-device',name),'utf8')).join('\n');
    assert.doesNotMatch(scripts, /sudo|chmod|chown|usermod|--licenses|yes\s*\|/);
    assert.match(scripts, /test -r \/dev\/kvm && test -w \/dev\/kvm/);
    assert.match(scripts, /--install[^\n]+<\/dev\/null/);
    assert.match(scripts, /Refusing to modify an unowned emulator/);
    const driver = fs.readFileSync(path.join(ROOT,'qa/hsdp-device/app/src/main/java/io/github/kunal26das/hsdpregression/CallbackProbeActivity.java'),'utf8');
    assert.match(driver, /throw error;/);
    assert.match(driver, /super\.onAttachedToWindow/);
    assert.match(driver, /super\.onConfigurationChanged/);
    assert.match(driver, /super\.onNewIntent/);
});
