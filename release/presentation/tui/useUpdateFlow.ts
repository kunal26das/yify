import {useState} from 'react';
import {
    type Channel,
    currentBranch,
    type LogLine,
    type Platform,
    runUpdate,
    summarizeUpdate,
} from '../container.js';

export type UpdateStepName =
    | 'platforms'
    | 'channel'
    | 'message'
    | 'checking'
    | 'blocked'
    | 'running'
    | 'result';

export interface UpdateFlowViewModel {
    step: UpdateStepName;
    platforms: Platform[];
    channels: Channel[];
    message: string;
    lines: LogLine[];
    ok: boolean;
    blocked: string[];
    released: number;
    choosePlatforms: (p: Platform[]) => void;
    chooseChannels: (c: Channel[]) => void;
    setMessage: (m: string) => void;
    start: () => Promise<void>;
}

function defaultMessage(): string {
    return currentBranch() ?? '';
}

export function useUpdateFlow(): UpdateFlowViewModel {
    const [step, setStep] = useState<UpdateStepName>('platforms');
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [message, setMessage] = useState(defaultMessage());
    const [lines, setLines] = useState<LogLine[]>([]);
    const [ok, setOk] = useState(false);
    const [blocked, setBlocked] = useState<string[]>([]);
    const [released, setReleased] = useState(0);

    const append = (l: LogLine) => setLines((prev) => [...prev, l]);

    const choosePlatforms = (p: Platform[]) => {
        setPlatforms(p);
        setStep('channel');
    };

    const chooseChannels = (c: Channel[]) => {
        setChannels(c);
        setStep('message');
    };

    const start = async () => {
        setStep('running');
        const res = await runUpdate(platforms, channels, message.trim(), append);
        const summary = summarizeUpdate(res);
        setBlocked(summary.blocked);
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
        channels,
        message,
        lines,
        ok,
        blocked,
        released,
        choosePlatforms,
        chooseChannels,
        setMessage,
        start,
    };
}
