import {useState} from 'react';
import {
    type Channel,
    type LogLine,
    type Platform,
    releaseCoverage,
    runStoreRelease,
    validateBinaries,
} from '../container.js';

export type StoreStep =
    | 'platforms'
    | 'apk'
    | 'ipa'
    | 'channels'
    | 'validating'
    | 'confirm'
    | 'running'
    | 'result';

export interface StoreFlowViewModel {
    step: StoreStep;
    apk: string;
    ipa: string;
    platforms: Platform[];
    channels: Channel[];
    version: string;
    error: string;
    existingSummary: string;
    allCovered: boolean;
    lines: LogLine[];
    ok: boolean;
    setApk: (v: string) => void;
    setIpa: (v: string) => void;
    choosePlatforms: (p: Platform[]) => void;
    submitApk: () => void;
    submitIpa: () => void;
    submitChannels: (channels: Channel[]) => Promise<void>;
    start: () => Promise<void>;
}

export function useStoreFlow(): StoreFlowViewModel {
    const [step, setStep] = useState<StoreStep>('platforms');
    const [apk, setApk] = useState('');
    const [ipa, setIpa] = useState('');
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [version, setVersion] = useState('');
    const [error, setError] = useState('');
    const [existingSummary, setExistingSummary] = useState('');
    const [allCovered, setAllCovered] = useState(false);
    const [lines, setLines] = useState<LogLine[]>([]);
    const [ok, setOk] = useState(false);

    const append = (l: LogLine) => setLines((prev) => [...prev, l]);

    const choosePlatforms = (p: Platform[]) => {
        setPlatforms(p);
        setStep(p.includes('android') ? 'apk' : 'ipa');
    };

    const submitApk = () => {
        if (apk.trim()) setStep(platforms.includes('ios') ? 'ipa' : 'channels');
    };

    const submitIpa = () => {
        if (ipa.trim()) setStep('channels');
    };

    const submitChannels = async (chosen: Channel[]) => {
        setChannels(chosen);
        setStep('validating');
        setError('');
        setExistingSummary('');
        setAllCovered(false);

        const v = await validateBinaries(apk.trim(), ipa.trim(), platforms);
        if (!v.ok) {
            setError(v.error);
            setStep('confirm');
            return;
        }
        setVersion(v.version);

        const coverage = await releaseCoverage(platforms, chosen);
        if (coverage.existing.length > 0) {
            const byChannel = new Map<string, string[]>();
            for (const e of coverage.existing) {
                byChannel.set(e.channel, [
                    ...(byChannel.get(e.channel) ?? []),
                    e.platform,
                ]);
            }
            setExistingSummary(
                Array.from(byChannel.entries())
                    .map(([channel, plats]) => `${channel} (${plats.join(', ')})`)
                    .join(', '),
            );
            setAllCovered(coverage.covered);
        }
        setStep('confirm');
    };

    const start = async () => {
        setStep('running');
        const res = await runStoreRelease(
            {
                apkPath: apk.trim(),
                ipaPath: ipa.trim(),
                version,
                platforms,
                channels,
            },
            append,
        );
        setOk(res.ok);
        setStep('result');
    };

    return {
        step,
        apk,
        ipa,
        platforms,
        channels,
        version,
        error,
        existingSummary,
        allCovered,
        lines,
        ok,
        setApk,
        setIpa,
        choosePlatforms,
        submitApk,
        submitIpa,
        submitChannels,
        start,
    };
}
