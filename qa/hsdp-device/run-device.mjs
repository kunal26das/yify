import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {cases, fixedOnlyCases, variants, sourcePattern, images} from './policy.mjs';
import {verifyCase} from './evidence.mjs';
import {verifyProcessIdentity} from './process-identity.mjs';
const [adbPath, serial, project, sourceSha, apiValue, evidence, avdName] = process.argv.slice(2);
const api = Number(apiValue);
if (!avdName || !sourcePattern.test(sourceSha ?? '') || !images[apiValue] || !/^emulator-\d+$/.test(serial)) throw new Error('Invalid disposable emulator inputs');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024}).replaceAll('\r', '');
const assert = (value, message) => { if (!value) throw new Error(message); };
const identity = adb('emu', 'avd', 'name').split('\n')[0].trim();
assert(identity === avdName && avdName === `yify-hsdp-${api}-${sourceSha.slice(0, 12)}`, 'Refusing to modify an unowned emulator');
assert(adb('shell', 'getprop', 'ro.kernel.qemu').trim() === '1', 'Refusing a non-emulator device');
assert(Number(adb('shell', 'getprop', 'ro.build.version.sdk').trim()) === api, 'Wrong emulator API');
assert(adb('shell', 'getprop', 'ro.product.cpu.abi').trim() === 'x86_64', 'Wrong AOSP emulator ABI');
assert(/aosp|sdk_(?:g)?phone(?:64)?_x86_64/.test(adb('shell', 'getprop', 'ro.build.fingerprint')), 'Unexpected AOSP fingerprint');
mkdirSync(evidence, {recursive: true});
const confinement = [];
function verifyNoGoogleServices() {
    const packages = adb('shell', 'pm', 'list', 'packages');
    assert(/^package:android$/m.test(packages), 'Android package inventory is incomplete');
    assert(!/^package:(com\.android\.vending|com\.google\.android\.(?:gms|gsf))$/m.test(packages), 'Google service package present in AOSP device');
}
function verifyBoundary(packageName, artifact, requireProcess = true) {
    verifyNoGoogleServices();
    const installed = adb('shell', 'dumpsys', 'package', packageName);
    assert(!installed.includes('android.permission.INTERNET'), 'Installed driver unexpectedly declares Internet permission');
    const uid = Number(installed.match(/^\s*userId=(\d+)$/m)?.[1]);
    assert(Number.isInteger(uid) && uid >= 10000, 'Invalid installed application UID');
    const packagePath = adb('shell', 'pm', 'path', packageName).trim();
    assert(/^package:\/data\/app\/[^\n]+\/base\.apk$/.test(packagePath), 'Installed package could not be identified');
    assert(adb('shell', 'sha256sum', packagePath.slice(8)).trim().split(/\s+/)[0] === artifact.apkSha256, 'Installed APK changed after verification');
    if (!requireProcess) return {uid};
    const raw = adb('shell', 'run-as', packageName, 'cat', 'files/identity.json');
    writeFileSync(path.join(evidence, `${packageName}-actual-process-identity.json`), raw);
    return verifyProcessIdentity(JSON.parse(raw), {sourceSha, packageName, uid, hsdpVersion: artifact.version});
}
verifyNoGoogleServices();
const results = [];
for (const [variant, target] of Object.entries(variants)) {
    const artifact = JSON.parse(readFileSync(path.join(evidence, `${variant}-artifact.json`), 'utf8'));
    const apk = path.join(project, `app/build/outputs/apk/${variant}/debug/app-${variant}-debug.apk`);
    assert(artifact.sourceSha === sourceSha && artifact.apkSha256 === createHash('sha256').update(readFileSync(apk)).digest('hex'), 'APK changed after static verification');
    assert(adb('install', '--no-streaming', apk).includes('Success'), 'APK installation did not succeed');
    const installed = adb('shell', 'dumpsys', 'package', target.packageName);
    writeFileSync(path.join(evidence, `${variant}-installed.txt`), installed);
    assert(!installed.includes('android.permission.INTERNET'), 'Installed driver unexpectedly declares Internet permission');
    const installedIdentity = verifyBoundary(target.packageName, artifact, false);
    assert(!confinement.some(item => item.uid === installedIdentity.uid), 'Both variants unexpectedly share an application UID');
    adb('shell', 'am', 'force-stop', target.packageName);
    const identityLaunch = adb('shell', 'am', 'start', '-W', '-n', `${target.packageName}/io.github.kunal26das.hsdpregression.DriverActivity`, '--ez', 'qa_identity_only', 'true');
    writeFileSync(path.join(evidence, `${variant}-identity-launch.txt`), identityLaunch);
    assert(identityLaunch.includes('Status: ok'), 'Identity-only driver launch failed');
    const appIdentity = verifyBoundary(target.packageName, artifact);
    assert(adb('shell', 'pidof', '-s', target.packageName).trim() === String(appIdentity.pid), 'Identity-only app process did not survive');
    confinement.push(appIdentity);
    for (const scenario of [...cases, ...(variant === 'fixed' ? fixedOnlyCases : [])]) {
        const run = randomUUID();
        const stem = path.join(evidence, `${variant}-${scenario}`);
        adb('shell', 'am', 'force-stop', target.packageName);
        adb('shell', 'wm', 'size', 'reset');
        adb('logcat', '-c');
        const launch = adb('shell', 'am', 'start', '-W', '-n', `${target.packageName}/io.github.kunal26das.hsdpregression.DriverActivity`, '--es', 'qa_case', scenario, '--es', 'qa_run', run);
        writeFileSync(`${stem}-launch.txt`, launch);
        assert(launch.includes('Status: ok'), 'Android did not acknowledge driver launch');
        let events = [];
        let logcat = '';
        let configurationRequested = false;
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
            try {
                const text = adb('shell', 'run-as', target.packageName, 'cat', 'files/events.jsonl');
                events = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
            } catch {}
            if (events[0]?.run === run && Number.isSafeInteger(events[0].pid)) {
                if (scenario === 'configuration' && !configurationRequested && events.some(event => event.event === 'configuration_requested')) {
                    adb('shell', 'wm', 'size', '720x1280');
                    configurationRequested = true;
                }
                logcat = adb('logcat', '-d', '--pid', String(events[0].pid), '-v', 'threadtime');
                if (variant === 'legacy' ? logcat.includes('FATAL EXCEPTION: main') : events.some(event => event.event === 'framework_destroyed')) break;
            }
            await setTimeout(1000);
        }
        writeFileSync(`${stem}-events.json`, JSON.stringify(events, null, 2));
        writeFileSync(`${stem}-logcat.txt`, logcat);
        const result = verifyCase({events, logcat, variant, scenario, run, sourceSha, api});
        if (variant === 'fixed') {
            assert(adb('shell', 'pidof', '-s', target.packageName).trim() === String(result.pid), 'Fixed process did not survive Activity finish');
            await setTimeout(1000);
            const finalLog = adb('logcat', '-d', '--pid', String(result.pid), '-v', 'threadtime');
            assert(!finalLog.includes('FATAL EXCEPTION:'), 'Fixed process crashed after completion');
        }
        const actualIdentity = verifyBoundary(target.packageName, artifact);
        assert(actualIdentity.pid === result.pid, 'Case evidence and actual process identity PID differ');
        writeFileSync(`${stem}-identity.json`, JSON.stringify(actualIdentity, null, 2));
        results.push({...result, run, apkSha256: artifact.apkSha256});
        console.log(`${api} ${variant} ${scenario}: ${result.result}`);
    }
}
writeFileSync(path.join(evidence, 'device-receipt.json'), JSON.stringify({sourceSha, serial, avdName, api,
    deviceFingerprint: adb('shell', 'getprop', 'ro.build.fingerprint').trim(),
    abi: adb('shell', 'getprop', 'ro.product.cpu.abi').trim(),
    execution: 'hosted-aosp-kvm-emulation', hostSecurityChanged: false, guestSecurityChanged: false,
    wholeOsNetworkConfinement: false, guestFirewallApplied: false, appInternetPermission: false,
    runAsGroupEvidenceUsed: false, googleServicePackagesAbsent: true,
    directAppSocketDenialsVerified: confinement.every(item => item.socketCreationProbes.every(probe => probe.created === false && [1, 13].includes(probe.errno))), confinement,
    sdkCallbackProbesUseUnmodifiedSuperclass: true, firebaseIntegrationProven: false,
    results,
}, null, 2), {flag: 'wx'});
