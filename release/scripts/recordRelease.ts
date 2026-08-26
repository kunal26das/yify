import {ALL_PLATFORMS, type Channel, type Platform} from '../domain/index.js';
import {createWorkspace} from '../data/config/workspaceFs.js';
import {createReleaseLedger} from '../data/ledger/releaseLedgerFs.js';

const [platformArg, channelArg, version, runtimeArg] = process.argv.slice(2);

const workspace = createWorkspace();

function fail(message: string): never {
    console.error(message);
    process.exit(1);
}

if (!platformArg || !channelArg || !version) {
    fail('usage: recordRelease <platform> <channel> <version> [runtimeVersion]');
}

if (!ALL_PLATFORMS.includes(platformArg as Platform)) {
    fail(`unknown platform "${platformArg}" — expected one of ${ALL_PLATFORMS.join(', ')}`);
}

if (!workspace.channels.includes(channelArg as Channel)) {
    fail(`unknown channel "${channelArg}" — expected one of ${workspace.channels.join(', ')}`);
}

const platform = platformArg as Platform;
const channel = channelArg as Channel;
const runtimeVersion = runtimeArg || version;

const ledger = createReleaseLedger({workspace});

if (ledger.find(platform, channel, runtimeVersion)) {
    console.log(`Already recorded: ${platform} ${channel} runtime ${runtimeVersion}.`);
    process.exit(0);
}

ledger.record({
    platform,
    channel,
    version,
    runtimeVersion,
    releasedAt: new Date().toISOString(),
});

console.log(`Recorded ${platform} v${version} runtime ${runtimeVersion} on ${channel}.`);
