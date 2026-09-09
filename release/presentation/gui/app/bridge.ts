import type {
    AuthCheck,
    Channel,
    Coverage,
    Info,
    LogLine,
    OkResult,
    Platform,
    ReleaseApi,
    StoreReleaseResult,
    UpdateResult,
    ValidateResult,
} from './types.js';

const api: Partial<ReleaseApi> = window.release ?? {};

export const bridge = {
    platform: api.platform,
    info: (): Promise<Info> => api.info!(),
    checkAuth: (): Promise<AuthCheck> => api.checkAuth!(),
    cancelTask: (): Promise<{ killed: number }> | undefined => api.cancelTask?.(),
    readClipboard: (): Promise<string> =>
        api.readClipboard?.() ?? Promise.resolve(''),
    openLoginPage: (): Promise<{ ok: boolean; url?: string }> =>
        api.openLoginPage!(),
    login: (token: string): Promise<OkResult> => api.login!(token),
    logout: (): Promise<OkResult> => api.logout!(),
    validateBinaries: (
        apkPath: string,
        ipaPath: string,
        platforms: Platform[],
        channels: Channel[],
    ): Promise<ValidateResult> =>
        api.validateBinaries!(apkPath, ipaPath, platforms, channels),
    releaseCoverage: (
        platforms: Platform[],
        channels: Channel[],
    ): Promise<Coverage> => api.releaseCoverage!(platforms, channels),
    runStoreRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: Platform[],
        channels: Channel[],
    ): Promise<StoreReleaseResult> =>
        api.runStoreRelease!(apkPath, ipaPath, version, platforms, channels),
    runUpdate: (
        platforms: Platform[],
        channels: Channel[],
        message: string,
    ): Promise<UpdateResult> => api.runUpdate!(platforms, channels, message),
    onLog: (cb: (line: LogLine) => void): (() => void) => api.onLog!(cb),
};
