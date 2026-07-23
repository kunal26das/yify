// One-shot CLI driver: build signed AAB and publish to Play production.
import {createWorkspace} from '../data/config/workspaceFs.js';
import {createCancellation} from '../data/process/cancellationRegistry.js';
import {createAndroidPublisher} from '../data/android/androidPublisherShell.js';

const onLine = (l: {stream: string; text: string}) => {
    const out = l.stream === 'stderr' ? process.stderr : process.stdout;
    out.write(`[${l.stream}] ${l.text}\n`);
};

const workspace = createWorkspace();
const cancellation = createCancellation();
const publisher = createAndroidPublisher({workspace, cancellation});

const built = await publisher.build(onLine);
if (!built.ok || !built.artifacts?.aabPath) {
    console.error('Build failed');
    process.exit(1);
}
console.log(`AAB: ${built.artifacts.aabPath}`);
const result = await publisher.publishProduction(built.artifacts.aabPath, onLine);
if (!result.ok) {
    console.error('Publish failed');
    process.exit(1);
}
console.log(`Published versionCode ${result.versionCode} to production.`);
