import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import path from 'node:path';
import {setTimeout} from 'node:timers/promises';
import {cases, fixedOnlyCases, variants, sourcePattern, images} from './policy.mjs';
import {verifyCase} from './evidence.mjs';
const [adbPath, serial, project, sourceSha, apiValue, evidence, avdName] = process.argv.slice(2);
const api = Number(apiValue);
if (!avdName || !sourcePattern.test(sourceSha ?? '') || !images[apiValue] || !/^emulator-\d+$/.test(serial)) throw new Error('Invalid disposable emulator inputs');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024}).replaceAll('\r', '');
const assert = (value, message) => { if (!value) throw new Error(message); };
const identity = adb('emu', 'avd', 'name').split('\n')[0].trim();
assert(identity === avdName && avdName === `yify-hsdp-${api}-${sourceSha.slice(0, 12)}`, 'Refusing to modify an unowned emulator');
assert(adb('shell', 'getprop', 'ro.kernel.qemu').trim() === '1', 'Refusing a non-emulator device');
assert(Number(adb('shell', 'getprop', 'ro.build.version.sdk').trim()) === api, 'Wrong emulator API');
assert(adb('shell', 'id', '-u').trim() === '0', 'Disposable emulator must already have root adbd');
mkdirSync(evidence, {recursive: true});
adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
adb('shell', 'svc', 'wifi', 'disable');
adb('shell', 'svc', 'data', 'disable');
for (const command of ['iptables', 'ip6tables']) {
    adb('shell', command, '-P', 'OUTPUT', 'DROP');
    adb('shell', command, '-I', 'OUTPUT', '1', '-j', 'DROP');
}
function verifyNetwork() {
    for (const command of ['iptables', 'ip6tables']) {
        const rules = adb('shell', command, '-S', 'OUTPUT').trim().split('\n');
        assert(rules[0] === '-P OUTPUT DROP' && rules[1] === '-A OUTPUT -j DROP', `${command}: independent egress check failed`);
        writeFileSync(path.join(evidence, `${command}.txt`), rules.join('\n') + '\n');
    }
    assert(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on').trim() === '1', 'Airplane mode did not remain enabled');
}
verifyNetwork();
for (const [command, host, flag] of [['iptables', '127.0.0.1', '-4'], ['ip6tables', '::1', '-6']]) {
    const packets = () => {
        const listing = adb('shell', command, '-nvx', '-L', 'OUTPUT');
        const rule = listing.split('\n').find(line => /^\s*\d+\s+\d+\s+DROP\b/.test(line));
        assert(rule, 'Missing first DROP counter');
        return Number(rule.trim().split(/\s+/)[0]);
    };
    const before = packets();
    let blocked = false;
    try { adb('shell', 'ping', flag, '-c', '1', '-W', '1', host); }
    catch (error) { blocked = error.status === 1; }
    assert(blocked && packets() > before, `${command}: loopback canary did not prove kernel OUTPUT rejection`);
}
const results = [];
for (const [variant, target] of Object.entries(variants)) {
    const artifact = JSON.parse(readFileSync(path.join(evidence, `${variant}-artifact.json`), 'utf8'));
    const apk = path.join(project, `app/build/outputs/apk/${variant}/debug/app-${variant}-debug.apk`);
    assert(artifact.sourceSha === sourceSha && artifact.apkSha256 === createHash('sha256').update(readFileSync(apk)).digest('hex'), 'APK changed after static verification');
    assert(adb('install', '--no-streaming', apk).includes('Success'), 'APK installation did not succeed');
    const installed = adb('shell', 'dumpsys', 'package', target.packageName);
    writeFileSync(path.join(evidence, `${variant}-installed.txt`), installed);
    assert(!installed.includes('android.permission.INTERNET'), 'Installed driver unexpectedly declares Internet permission');
    const packagePath = adb('shell', 'pm', 'path', target.packageName).trim();
    assert(/^package:\/data\/app\/[^\n]+\/base\.apk$/.test(packagePath), 'Installed package could not be identified');
    const localHash = adb('shell', 'sha256sum', packagePath.slice(8)).trim().split(/\s+/)[0];
    assert(localHash === artifact.apkSha256, 'Installed APK does not match verified artifact');
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
        verifyNetwork();
        results.push({...result, run, apkSha256: artifact.apkSha256});
        console.log(`${api} ${variant} ${scenario}: ${result.result}`);
    }
}
writeFileSync(path.join(evidence, 'device-receipt.json'), JSON.stringify({sourceSha, serial, avdName, api,
    deviceFingerprint: adb('shell', 'getprop', 'ro.build.fingerprint').trim(),
    abi: adb('shell', 'getprop', 'ro.product.cpu.abi').trim(),
    ipv4AndIpv6OutputDropVerified: true, ipv4AndIpv6KernelDropCanariesPassed: true, appInternetPermission: false,
    sdkCallbackProbesUseUnmodifiedSuperclass: true, firebaseIntegrationProven: false,
    results,
}, null, 2), {flag: 'wx'});
