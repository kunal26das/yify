import {useState} from 'react';
import {
    type Deployment,
    type LogLine,
    type Platform,
    repoTargetVersion,
    runCodePush,
    summarizeCodePush,
} from '../container.js';

export type CpStep =
    | 'platforms'
    | 'deployment'
    | 'version'
    | 'checking'
    | 'blocked'
    | 'running'
    | 'result';

export interface CodePushFlowViewModel {
    step: CpStep;
    platforms: Platform[];
    deployments: Deployment[];
    version: string;
    lines: LogLine[];
    ok: boolean;
    blocked: string[];
    unchanged: number;
    released: number;
    choosePlatforms: (p: Platform[]) => void;
    chooseDeployments: (d: Deployment[]) => void;
    setVersion: (v: string) => void;
    start: () => Promise<void>;
}

function safeRepoVersion(): string {
    try {
        return repoTargetVersion();
    } catch {
        return '';
    }
}

export function useCodePushFlow(): CodePushFlowViewModel {
    const [step, setStep] = useState<CpStep>('platforms');
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [version, setVersion] = useState(safeRepoVersion());
    const [lines, setLines] = useState<LogLine[]>([]);
    const [ok, setOk] = useState(false);
    const [blocked, setBlocked] = useState<string[]>([]);
    const [unchanged, setUnchanged] = useState(0);
    const [released, setReleased] = useState(0);

    const append = (l: LogLine) => setLines((prev) => [...prev, l]);

    const choosePlatforms = (p: Platform[]) => {
        setPlatforms(p);
        setStep('deployment');
    };

    const chooseDeployments = (d: Deployment[]) => {
        setDeployments(d);
        setStep('version');
    };

    const start = async () => {
        setStep('running');
        const res = await runCodePush(
            platforms,
            deployments,
            version.trim(),
            append,
        );
        const summary = summarizeCodePush(res);
        setBlocked(summary.blocked);
        setUnchanged(summary.unchanged);
        setReleased(summary.released);
        setOk(summary.ok);
        setStep(
            summary.blocked.length > 0 && res.steps.every((s) => s.blocked)
                ? 'blocked'
                : 'result',
        );
    };

    return {
        step,
        platforms,
        deployments,
        version,
        lines,
        ok,
        blocked,
        unchanged,
        released,
        choosePlatforms,
        chooseDeployments,
        setVersion,
        start,
    };
}
