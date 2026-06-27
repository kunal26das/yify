import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {
    CodePushResult,
    CodePushSummary,
    Deployment,
    Platform,
} from './types.js';

export class CodePushViewModel extends Emitter {
    run(
        platforms: Platform[],
        deployments: Deployment[],
        version: string,
    ): Promise<CodePushResult> {
        return bridge.runCodePush(platforms, deployments, version);
    }

    summarize(res: CodePushResult): CodePushSummary {
        if (res.summary) return res.summary;
        const blocked = res.steps
            .filter((s) => s.blocked)
            .map((s) => s.platform + '/' + s.deployment);
        const total = res.steps.length;
        const unchanged = res.steps.filter((s) => s.unchanged).length;
        const released = res.steps.filter(
            (s) => s.ok && !s.unchanged && !s.blocked,
        ).length;
        return {blocked, total, unchanged, released, ok: res.ok};
    }
}
