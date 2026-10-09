import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {verifyManifest} from './evidence.mjs';
import {normalizeBadging, normalizeManifest} from './aapt-format.mjs';
import {verifyComponents} from './component-manifest.mjs';
import {variants, sourcePattern} from './policy.mjs';
const [project, aapt2, sourceSha, evidence] = process.argv.slice(2);
if (!evidence || !sourcePattern.test(sourceSha ?? '')) throw new Error('Expected project, aapt2, source SHA, new evidence directory');
mkdirSync(evidence, {recursive: true});
for (const [variant, target] of Object.entries(variants)) {
    const apk = path.join(project, `app/build/outputs/apk/${variant}/debug/app-${variant}-debug.apk`);
    execFileSync(path.join(path.dirname(aapt2), 'apksigner'), ['verify', '--verbose', apk]);
    const badging = execFileSync(aapt2, ['dump', 'badging', apk], {encoding: 'utf8'});
    const xml = execFileSync(aapt2, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], {encoding: 'utf8'});
    const aarReceipt = JSON.parse(readFileSync(path.join(project, `app/build/evidence/${variant}-aar.json`), 'utf8'));
    verifyManifest({badging: normalizeBadging(badging), xml: normalizeManifest(xml), variant, aarReceipt, sourceSha});
    verifyComponents(normalizeManifest(xml));
    const entries = execFileSync('unzip', ['-Z1', apk], {encoding: 'utf8'}).trim().split('\n');
    const dex = entries.filter(name => /^classes\d*\.dex$/.test(name)).map(name =>
        execFileSync('unzip', ['-p', apk, name], {maxBuffer: 32 * 1024 * 1024}));
    for (const required of ['com/google/android/play/core/hsdp/service/HsdpShimActivity',
        ...['DriverActivity', 'CallbackProbeActivity', 'ProbeApplication', 'IdentityEvidence'].map(name => `io/github/kunal26das/hsdpregression/${name}`)]) {
        if (!dex.some(bytes => bytes.includes(Buffer.from(`L${required};`)))) throw new Error(`Required class is absent from the APK: ${required}`);
    }
    writeFileSync(path.join(evidence, `${variant}-manifest.txt`), xml);
    writeFileSync(path.join(evidence, `${variant}-badging.txt`), badging);
    writeFileSync(path.join(evidence, `${variant}-artifact.json`), JSON.stringify({sourceSha, ...target,
        apkSha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
        dependencies: aarReceipt.dependencies, requestedPermissions: [], contentProviders: [],
        artifactVerified: true, deviceTested: false,
    }, null, 2), {flag: 'wx'});
}
