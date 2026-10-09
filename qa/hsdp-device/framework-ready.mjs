import {execFileSync} from 'node:child_process';
import {writeFileSync, appendFileSync} from 'node:fs';
import {setTimeout} from 'node:timers/promises';
import path from 'node:path';

export function advanceReadiness(previous, probe) {
    const responsive = !probe.error && probe.boot === '1' && /^[1-9]\d*$/.test(probe.beforePid ?? '') && probe.beforePid === probe.afterPid &&
        ['Service package: found', 'Service activity: found', 'Service window: found',
            'ACTIVITY MANAGER ACTIVITIES', 'WINDOW MANAGER WINDOWS'].every(marker => probe.services?.includes(marker)) &&
        /^package:\/[^\n]*\/framework-res\.apk$/m.test(probe.services ?? '');
    if (!responsive) return {systemServerPid: null, consecutive: 0};
    return {systemServerPid: probe.afterPid, consecutive: previous.systemServerPid === probe.afterPid ? previous.consecutive + 1 : 1};
}

const [adbPath, serial, evidence, emulatorPid] = process.argv.slice(2);
if (evidence) {
    if (!/^emulator-\d+$/.test(serial ?? '') || !/^[1-9]\d*$/.test(emulatorPid ?? '')) throw new Error('Invalid emulator readiness inputs');
    const started = Date.now();
    const deadline = started + 540000;
    let state = {systemServerPid: null, consecutive: 0};
    let attempt = 0;
    const adb = (...args) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error('Emulator framework boot budget expired');
        return execFileSync(adbPath, ['-s', serial, ...args], {
            encoding: 'utf8', timeout: Math.min(30000, remaining), maxBuffer: 8 * 1024 * 1024,
        }).replaceAll('\r', '').trim();
    };
    while (Date.now() < deadline) {
        process.kill(Number(emulatorPid), 0);
        const probe = {attempt: ++attempt, elapsedMs: Date.now() - started};
        try {
            probe.boot = adb('shell', 'getprop', 'sys.boot_completed');
            if (probe.boot === '1') {
                probe.beforePid = adb('shell', 'pidof', '-s', 'system_server');
                probe.services = adb('shell', 'service check package; service check activity; service check window; pm path android; dumpsys activity activities; dumpsys window windows');
                probe.afterPid = adb('shell', 'pidof', '-s', 'system_server');
            }
        } catch (error) {
            probe.error = String(error);
        }
        state = advanceReadiness(state, probe);
        appendFileSync(path.join(evidence, 'framework-readiness.jsonl'), JSON.stringify({...probe, ...state}) + '\n');
        if (state.consecutive >= 3 && Date.now() < deadline) {
            writeFileSync(path.join(evidence, 'framework-ready.json'), JSON.stringify({serial, ...state, elapsedMs: Date.now() - started}, null, 2), {flag: 'wx'});
            break;
        }
        await setTimeout(Math.min(3000, Math.max(0, deadline - Date.now())));
    }
    if (state.consecutive < 3 || Date.now() >= deadline) throw new Error('Android package/activity/window services did not stabilize within the boot budget');
}
