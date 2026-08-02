import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {
    Channel,
    Platform,
    UpdateResult,
    UpdateSummary,
} from './types.js';

export class UpdateViewModel extends Emitter {
    run(
        platforms: Platform[],
        channels: Channel[],
        message: string,
    ): Promise<UpdateResult> {
        return bridge.runUpdate(platforms, channels, message);
    }

    summarize(res: UpdateResult): UpdateSummary {
        if (res.summary) return res.summary;
        const blocked = res.steps
            .filter((s) => s.blocked)
            .map((s) => s.platform + '/' + s.channel);
        const total = res.steps.length;
        const released = res.steps.filter((s) => s.ok && !s.blocked).length;
        return {blocked, total, released, ok: res.ok};
    }
}
