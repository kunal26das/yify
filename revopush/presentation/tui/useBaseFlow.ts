import {useState} from 'react';
import {
    baseCoverage,
    type Deployment,
    type LogLine,
    type Platform,
    runBaseRelease,
    validateBinaries,
} from '../container.js';

export type BaseStep =
    | 'platforms'
    | 'apk'
    | 'ipa'
    | 'deployments'
    | 'validating'
    | 'confirm'
    | 'running'
    | 'result';

export interface BaseFlowViewModel {
    step: BaseStep;
    apk: string;
    ipa: string;
    platforms: Platform[];
    deployments: Deployment[];
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
    submitDeployments: (deps: Deployment[]) => Promise<void>;
    start: () => Promise<void>;
}

export function useBaseFlow(): BaseFlowViewModel {
    const [step, setStep] = useState<BaseStep>('platforms');
    const [apk, setApk] = useState('');
    const [ipa, setIpa] = useState('');
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
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
        if (apk.trim()) setStep(platforms.includes('ios') ? 'ipa' : 'deployments');
    };

    const submitIpa = () => {
        if (ipa.trim()) setStep('deployments');
    };

    const submitDeployments = async (deps: Deployment[]) => {
        setDeployments(deps);
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

        const coverage = await baseCoverage(v.version, platforms, deps);
        if (coverage.existing.length > 0) {
            const byDep = new Map<string, string[]>();
            for (const e of coverage.existing) {
                byDep.set(e.deployment, [
                    ...(byDep.get(e.deployment) ?? []),
                    e.platform,
                ]);
            }
            setExistingSummary(
                Array.from(byDep.entries())
                    .map(([dep, plats]) => `${dep} (${plats.join(', ')})`)
                    .join(', '),
            );
            setAllCovered(coverage.covered);
        }
        setStep('confirm');
    };

    const start = async () => {
        setStep('running');
        const res = await runBaseRelease(
            {
                apkPath: apk.trim(),
                ipaPath: ipa.trim(),
                version,
                platforms,
                deployments,
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
        deployments,
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
        submitDeployments,
        start,
    };
}
