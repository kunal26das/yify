export type Platform = 'android' | 'ios';
export type Channel = 'Staging' | 'Production';
export type OperationType = 'store' | 'update';
export type LogStream = 'stdout' | 'stderr' | 'system';

export interface LogLine {
    stream: LogStream;
    text: string;
    label?: string;
}

export interface Info {
    repoRoot: string;
    version: string;
    packageVersion: string;
    branch: string;
}

export interface AuthCheck {
    loggedIn: boolean;
    name: string;
}

export interface OkResult {
    ok: boolean;
    error?: string;
}

export interface ValidateResult {
    ok: boolean;
    version: string;
    error?: string;
}

export interface Coverage {
    have: number;
    total: number;
    covered: boolean;
}

export interface StoreReleaseResult {
    ok: boolean;
}

export interface UpdateStep {
    platform: string;
    channel: string;
    ok: boolean;
    blocked?: boolean;
}

export interface UpdateSummary {
    blocked: string[];
    total: number;
    released: number;
    ok: boolean;
}

export interface UpdateResult {
    ok: boolean;
    steps: UpdateStep[];
    summary?: UpdateSummary;
}

export interface ReleaseApi {
    platform: string;
    info: () => Promise<Info>;
    checkAuth: () => Promise<AuthCheck>;
    cancelTask?: () => Promise<{ killed: number }>;
    readClipboard: () => string;
    openLoginPage: () => Promise<{ ok: boolean; url?: string }>;
    login: (token: string) => Promise<OkResult>;
    logout: () => Promise<OkResult>;
    validateBinaries: (
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
    ) => Promise<ValidateResult>;
    releaseCoverage: (
        platforms: Platform[],
        channels: Channel[],
    ) => Promise<Coverage>;
    runStoreRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        channels: Channel[],
    ) => Promise<StoreReleaseResult>;
    runUpdate: (
        platforms: Platform[],
        channels: Channel[],
        message: string,
    ) => Promise<UpdateResult>;
    onLog: (cb: (line: LogLine) => void) => () => void;
}

declare global {
    interface Window {
        release?: ReleaseApi;
    }
}
