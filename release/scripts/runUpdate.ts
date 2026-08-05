import {runUpdate, summarizeUpdate} from '../presentation/container.js';
import type {Channel, Platform} from '../domain/index.js';

const platforms = (process.env.UPDATE_PLATFORMS ?? 'android').split(',') as Platform[];
const channels = (process.env.UPDATE_CHANNELS ?? 'Production').split(',') as Channel[];
const message = process.env.UPDATE_MESSAGE ?? 'main';

const result = await runUpdate(platforms, channels, message, (line) => {
    const prefix = line.label ? `[${line.label}] ` : '';
    process.stdout.write(`${prefix}${line.text}\n`);
});

const summary = summarizeUpdate(result);
process.stdout.write(`\nSUMMARY ok=${summary.ok} released=${summary.released}/${summary.total} blocked=${summary.blocked.join(',') || 'none'}\n`);
process.exit(summary.ok ? 0 : 1);
