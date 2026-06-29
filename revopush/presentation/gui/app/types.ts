export type Platform = 'android' | 'ios';
export type Deployment = 'Staging' | 'Production';
export type OperationType = 'base' | 'codepush';
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
    email: string;
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

export interface BaseReleaseResult {
    ok: boolean;
}

export interface CodePushStep {
    platform: string;
    deployment: string;
    ok: boolean;
    unchanged?: boolean;
    blocked?: boolean;
}

export interface CodePushSummary {
    blocked: string[];
    total: number;
    unchanged: number;
    released: number;
    ok: boolean;
}

export interface CodePushResult {
    ok: boolean;
    steps: CodePushStep[];
    summary?: CodePushSummary;
}

export interface RevopushApi {
    platform: string;
    info: () => Promise<Info>;
    checkAuth: () => Promise<AuthCheck>;
    cancelTask?: () => Promise<{ killed: number }>;
    readClipboard: () => string;
    openLoginPage: () => Promise<{ ok: boolean; url?: string }>;
    login: (accessKey: string) => Promise<OkResult>;
    logout: () => Promise<OkResult>;
    validateBinaries: (
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
        deployments: Deployment[],
    ) => Promise<ValidateResult>;
    baseCoverage: (
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ) => Promise<Coverage>;
    runBaseRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ) => Promise<BaseReleaseResult>;
    runCodePush: (
        platforms: Platform[],
        deployments: Deployment[],
        version: string,
    ) => Promise<CodePushResult>;
    onLog: (cb: (line: LogLine) => void) => () => void;
}

declare global {
    interface Window {
        revopush?: RevopushApi;
    }
}
