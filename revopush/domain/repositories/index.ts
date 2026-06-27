import type {
    Account,
    AppTarget,
    Deployment,
    OnLine,
    Platform,
    RunOptions,
    RunResult,
    Session,
} from '../entities/index.js';

export interface Workspace {
    readonly repoRoot: string;
    readonly apps: Record<Platform, AppTarget>;
    readonly deployments: Deployment[];

    currentBranch(root?: string): string | undefined;
}

export interface SessionStore {
    read(): Session | null;

    configFilePath(): string;

    clear(): void;
}

export interface ManagementApi {
    isLoggedIn(): Promise<boolean>;

    getAccount(): Promise<Account>;

    revokeSession(): Promise<{ ok: boolean; status?: number }>;

    getBaseRelease(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<unknown | null>;

    hasBaseRelease(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<boolean>;
}

export interface ReleaseCli {
    run(args: string[], onLine: OnLine, opts?: RunOptions): Promise<RunResult>;
}

export interface Installer {
    installCommand(): string;

    cleanInstall(onLine: OnLine, label?: string): Promise<RunResult>;
}

export interface BinaryInspector {
    versionFromBinary(filePath: string): Promise<string>;

    repoPackageVersion(): string;

    repoTargetVersion(): string;

    exists(filePath: string): boolean;
}

export interface UrlOpener {
    open(url: string): Promise<boolean>;
}

export interface Cancellation {
    isCancelling(): boolean;

    beginScope(): void;

    cancelActive(): number;
}
