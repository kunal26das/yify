import type {
    AuthCheck,
    BaseReleaseResult,
    CodePushResult,
    Coverage,
    Deployment,
    Info,
    LogLine,
    OkResult,
    Platform,
    RevopushApi,
    ValidateResult,
} from './types.js';

const api: Partial<RevopushApi> = window.revopush ?? {};

export const bridge = {
    platform: api.platform,
    info: (): Promise<Info> => api.info!(),
    checkAuth: (): Promise<AuthCheck> => api.checkAuth!(),
    cancelTask: (): Promise<{ killed: number }> | undefined => api.cancelTask?.(),
    readClipboard: (): string => api.readClipboard?.() ?? '',
    openLoginPage: (): Promise<{ ok: boolean; url?: string }> =>
        api.openLoginPage!(),
    login: (accessKey: string): Promise<OkResult> => api.login!(accessKey),
    logout: (): Promise<OkResult> => api.logout!(),
    validateBinaries: (
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
    ): Promise<ValidateResult> =>
        api.validateBinaries!(apkPath, ipaPath, platforms),
    baseCoverage: (
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<Coverage> => api.baseCoverage!(version, platforms, deployments),
    runBaseRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        deployments: Deployment[],
    ): Promise<BaseReleaseResult> =>
        api.runBaseRelease!(apkPath, ipaPath, version, platforms, deployments),
    runCodePush: (
        platforms: Platform[],
        deployments: Deployment[],
        version: string,
    ): Promise<CodePushResult> =>
        api.runCodePush!(platforms, deployments, version),
    onLog: (cb: (line: LogLine) => void): (() => void) => api.onLog!(cb),
};
