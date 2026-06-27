export type Platform = 'android' | 'ios';

export type Deployment = 'Staging' | 'Production';

export interface AppTarget {
    name: string;
    platform: Platform;
}

export const ALL_PLATFORMS: Platform[] = ['android', 'ios'];

export interface Session {
    accessKey: string;
    serverUrl: string;
}

export interface Account {
    email: string;
}

export interface AuthStatus {
    loggedIn: boolean;
    email: string;
}

export interface LogLine {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    label?: string;
}

export type OnLine = (line: LogLine) => void;

export interface Job {
    platform: Platform;
    deployment: Deployment;
}

export interface RunResult {
    code: number;
    ok: boolean;
    unchanged?: boolean;
}

export interface RunOptions {
    label?: string;
    retries?: number;
}

export type BinaryValidation =
    | { ok: true; version: string; apkPath: string; ipaPath: string }
    | { ok: false; error: string };

export interface BaseCoverage {
    have: number;
    total: number;
    covered: boolean;
    existing: Array<{ platform: Platform; deployment: Deployment }>;
}

export interface RunBaseReleaseOptions {
    apkPath: string;
    ipaPath: string;
    version: string;
    platforms: Platform[];
    deployments: Deployment[];
}

export interface BaseReleaseStep {
    platform: Platform;
    deployment: Deployment;
    ok: boolean;
    skipped?: boolean;
}

export interface BaseReleaseResult {
    ok: boolean;
    steps: BaseReleaseStep[];
}

export interface CodePushStep {
    platform: Platform;
    deployment: Deployment;
    ok: boolean;
    blocked?: boolean;
    unchanged?: boolean;
}

export interface CodePushResult {
    ok: boolean;
    steps: CodePushStep[];
}

export interface CodePushSummary {
    ok: boolean;
    total: number;
    blocked: string[];
    unchanged: number;
    released: number;
}

export type OperationType = 'base' | 'codepush';

export class NotLoggedInError extends Error {
    constructor() {
        super('Not logged in to RevoPush. Run `revopush login` first.');
        this.name = 'NotLoggedInError';
    }
}
