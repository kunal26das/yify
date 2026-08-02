export type Platform = 'android' | 'ios';

export type Channel = 'Staging' | 'Production';

export interface AppTarget {
    name: string;
    platform: Platform;
}

export const ALL_PLATFORMS: Platform[] = ['android', 'ios'];

export interface Session {
    token: string;
}

export interface Account {
    name: string;
}

export interface AuthStatus {
    loggedIn: boolean;
    name: string;
}

export interface LogLine {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    label?: string;
}

export type OnLine = (line: LogLine) => void;

export interface Job {
    platform: Platform;
    channel: Channel;
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

export interface ReleaseRecord {
    platform: Platform;
    channel: Channel;
    version: string;
    runtimeVersion: string;
    releasedAt: string;
}

export interface ReleaseCoverage {
    have: number;
    total: number;
    covered: boolean;
    existing: Array<{ platform: Platform; channel: Channel }>;
}

export interface RunStoreReleaseOptions {
    apkPath: string;
    ipaPath: string;
    version: string;
    platforms: Platform[];
    channels: Channel[];
}

export interface StoreReleaseStep {
    platform: Platform;
    channel: Channel;
    ok: boolean;
    skipped?: boolean;
}

export interface StoreReleaseResult {
    ok: boolean;
    steps: StoreReleaseStep[];
}

export interface UpdateStep {
    platform: Platform;
    channel: Channel;
    ok: boolean;
    blocked?: boolean;
}

export interface UpdateResult {
    ok: boolean;
    steps: UpdateStep[];
}

export interface UpdateSummary {
    ok: boolean;
    total: number;
    blocked: string[];
    released: number;
}

export type OperationType = 'store' | 'update';

export class NotLoggedInError extends Error {
    constructor() {
        super('Not logged in to Expo. Add an EAS access token first.');
        this.name = 'NotLoggedInError';
    }
}
