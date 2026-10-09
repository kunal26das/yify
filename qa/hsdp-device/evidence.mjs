import {sourcePattern, variants, cases, fixedOnlyCases} from './policy.mjs';
const requireTrue = (condition, message) => { if (!condition) throw new Error(message); };
const callbackNames = {attached: 'onAttachedToWindow', configuration: 'onConfigurationChanged', 'new-intent': 'onNewIntent'};
export function verifyCase({events, logcat, variant, scenario, run, sourceSha, api}) {
    const target = variants[variant];
    requireTrue(target && sourcePattern.test(sourceSha), 'Invalid variant or source SHA');
    requireTrue([...cases, ...(variant === 'fixed' ? fixedOnlyCases : [])].includes(scenario), 'Invalid scenario');
    requireTrue(Array.isArray(events) && events.length >= 3, 'Missing driver/lifecycle evidence');
    const pid = events[0].pid;
    let previous = -1;
    for (const item of events) {
        requireTrue(item.run === run && item.case === scenario && item.version === target.version && item.sourceSha === sourceSha && item.api === api && item.pid === pid, 'Mixed or stale event evidence');
        requireTrue(Number.isSafeInteger(item.pid) && item.pid > 0 && Number.isFinite(item.elapsedNanos) && item.elapsedNanos >= previous, 'Invalid event order or PID');
        previous = item.elapsedNanos;
    }
    const find = name => events.find(item => item.event === name);
    const sdkEvents = events.filter(item => item.activity?.endsWith('HsdpShimActivity') || item.activity?.endsWith('CallbackProbeActivity'));
    requireTrue(find('driver_started') && find('launch_requested'), 'Driver did not request launch');
    const expectedActivity = scenario === 'raw-missing'
        ? 'com.google.android.play.core.hsdp.service.HsdpShimActivity'
        : 'io.github.kunal26das.hsdpregression.CallbackProbeActivity';
    requireTrue(sdkEvents.some(item => item.event === 'framework_created' && item.activity === expectedActivity), 'Framework did not create the intended Activity');
    if (scenario !== 'raw-missing') requireTrue(find('probe_create_exit'), 'Probe did not finish SDK onCreate');
    if (callbackNames[scenario]) {
        const actualCallback = {attached: 'framework_attached', configuration: 'framework_configuration', 'new-intent': 'framework_new_intent'}[scenario];
        requireTrue(find(actualCallback)?.windowToken === true, 'Requested framework callback lacked an attached Android window');
        requireTrue(find('sdk_callback_enter')?.detail === scenario, 'SDK callback was never entered');
        if (scenario !== 'attached') requireTrue(find('sdk_attach_deferred'), 'Expected pre-callback isolation marker missing');
    }
    const processCrash = logcat.includes(`Process: ${target.packageName}, PID: ${pid}`) && logcat.includes('FATAL EXCEPTION: main');
    if (variant === 'legacy') {
        requireTrue(processCrash && logcat.includes('java.lang.IllegalStateException: targetPackageName is null'), 'Expected old-version process crash not observed');
        const callback = scenario === 'raw-missing' ? 'onAttachedToWindow' : callbackNames[scenario];
        requireTrue(logcat.includes(`HsdpShimActivity.${callback}`), 'Crash did not originate in the intended HSDP callback');
        if (scenario !== 'raw-missing') {
            requireTrue(find('sdk_callback_throw')?.detail === 'java.lang.IllegalStateException: targetPackageName is null', 'Original exception was not recorded before rethrow');
            requireTrue(!find('sdk_callback_exit'), 'Legacy callback unexpectedly completed');
        }
        return {scenario, version: target.version, pid, result: 'expected-original-process-crash', callback};
    }
    requireTrue(!processCrash && !logcat.includes('FATAL EXCEPTION:') && !find('sdk_callback_throw'), 'Fixed-version process crashed or callback threw');
    requireTrue(sdkEvents.some(item => item.event === 'framework_destroyed' && item.finishing === true), 'Fixed Activity did not finish and reach framework destruction');
    if (callbackNames[scenario]) {
        requireTrue(find('sdk_callback_exit')?.finishing === true && find('sdk_callback_repeat_exit')?.finishing === true, 'Fixed callback and controlled repeated call did not finish safely');
    } else {
        requireTrue(sdkEvents.some(item => item.event === 'framework_created' && item.finishing === true), 'Malformed onCreate did not finish safely');
    }
    return {scenario, version: target.version, pid, result: 'finished-safely', callback: callbackNames[scenario] ?? 'onCreate',
        repeatedInvocation: Boolean(callbackNames[scenario])};
}

export function verifyManifest({badging, xml, variant, aarReceipt, sourceSha}) {
    const target = variants[variant];
    requireTrue(target && sourcePattern.test(sourceSha), 'Invalid APK identity inputs');
    requireTrue(badging.startsWith(`package: name='${target.packageName}' `), 'Wrong standalone package');
    requireTrue(badging.includes("versionCode='1'") && badging.includes("sdkVersion:'24'") && badging.includes("targetSdkVersion:'36'"), 'Unexpected native SDK/version settings');
    requireTrue(!/uses-permission/.test(badging) && !/E: uses-permission/.test(xml), 'Networkless driver must request no permissions');
    requireTrue(!/E: provider/.test(xml), 'Networkless driver must have no content providers');
    requireTrue(!/firebase|sentry|ads\.APPLICATION_ID|expo\.modules\.updates|revenuecat/i.test(xml), 'Forbidden native service in merged manifest');
    requireTrue(xml.includes('io.github.kunal26das.hsdpregression.DriverActivity') && xml.includes('io.github.kunal26das.hsdpregression.CallbackProbeActivity') && xml.includes('com.google.android.play.core.hsdp.service.HsdpShimActivity'), 'Expected real driver and SDK activities are absent');
    const shimBlock = xml.split(/(?=\s+E: activity\b)/).find(section => section.split(/\n\s+E:/)[0].includes('"com.google.android.play.core.hsdp.service.HsdpShimActivity"'));
    requireTrue(shimBlock && /android:exported[^\n]*=(?:\(type 0x12\))?0x0\b/.test(shimBlock.split(/\n\s+E:/)[0]), 'Original SDK Activity must remain non-exported');
    requireTrue(aarReceipt?.sourceSha === sourceSha && aarReceipt.hsdp === target.version && aarReceipt.aarSha256 === target.aarSha256, 'Original official AAR checksum evidence missing or mismatched');
    requireTrue(Array.isArray(aarReceipt.dependencies) && aarReceipt.dependencies.includes(`com.google.android.play:hsdp:${target.version}`), 'Resolved HSDP graph missing');
    requireTrue(!aarReceipt.dependencies.some(item => /firebase|sentry|revenuecat|play-services-(?:ads|measurement)/i.test(item)), 'Forbidden provider SDK in resolved graph');
}
