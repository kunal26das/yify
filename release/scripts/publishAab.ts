import {createWorkspace} from '../data/config/workspaceFs.js';
import {createCancellation} from '../data/process/cancellationRegistry.js';
import {createAndroidPublisher} from '../data/android/androidPublisherShell.js';

const aabPath = process.argv[2];
if (!aabPath) {
    console.error('usage: publishAab <path-to-aab>');
    process.exit(1);
}

const onLine = (l: {stream: string; text: string}) => {
    const out = l.stream === 'stderr' ? process.stderr : process.stdout;
    out.write(`[${l.stream}] ${l.text}\n`);
};

const workspace = createWorkspace();
const cancellation = createCancellation();
const publisher = createAndroidPublisher({workspace, cancellation});

const result = await publisher.publishProduction(aabPath, onLine);
if (!result.ok) {
    console.error('Publish failed');
    process.exit(1);
}
console.log(`Published versionCode ${result.versionCode} to production.`);
