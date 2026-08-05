import type {
    Account,
    AppTarget,
    Channel,
    OnLine,
    Platform,
    ReleaseRecord,
    RunOptions,
    RunResult,
    Session,
} from '../entities/index.js';

export interface Workspace {
    readonly repoRoot: string;
    readonly apps: Record<Platform, AppTarget>;
    readonly channels: Channel[];

    channelName(channel: Channel): string;

    currentBranch(root?: string): string | undefined;
}

export interface SessionStore {
    read(): Session | null;

    save(token: string): void;

    configFilePath(): string;

    clear(): void;
}

export interface EasApi {
    isLoggedIn(): Promise<boolean>;

    getAccount(): Promise<Account>;
}

export interface RuntimeVersions {
    resolve(platform: Platform, channel?: string): Promise<string>;

    embeddedChannel(channel?: string): Promise<string | null>;
}

export interface ReleaseLedger {
    list(): ReleaseRecord[];

    find(
        platform: Platform,
        channel: Channel,
        runtimeVersion: string,
    ): ReleaseRecord | null;

    record(entry: ReleaseRecord): void;

    filePath(): string;
}

export interface ReleaseCli {
    run(args: string[], onLine: OnLine, opts?: RunOptions): Promise<RunResult>;
}

export interface AndroidArtifacts {
    apkPath: string;
    aabPath: string;
}

export interface AndroidPublisher {
    build(
        onLine: OnLine,
        label?: string,
        channel?: string,
    ): Promise<{ ok: boolean; artifacts?: AndroidArtifacts }>;

    publishProduction(
        aabPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean; versionCode?: number }>;

    distributeToFirebase(
        apkPath: string,
        onLine: OnLine,
        label?: string,
    ): Promise<{ ok: boolean; release?: string }>;
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
