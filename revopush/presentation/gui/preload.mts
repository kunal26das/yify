import {clipboard, contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('revopush', {
    platform: process.platform,
    info: () => ipcRenderer.invoke('meta:info'),
    checkAuth: () => ipcRenderer.invoke('auth:check'),
    cancelTask: () => ipcRenderer.invoke('task:cancel'),
    readClipboard: () => clipboard.readText(),
    openLoginPage: () => ipcRenderer.invoke('auth:openLoginPage'),
    login: (accessKey: string) => ipcRenderer.invoke('auth:login', accessKey),
    logout: () => ipcRenderer.invoke('auth:logout'),
    validateBinaries: (apkPath: string, ipaPath: string, platforms: string[]) =>
        ipcRenderer.invoke('base:validate', apkPath, ipaPath, platforms),
    baseCoverage: (version: string, platforms: string[], deployments: string[]) =>
        ipcRenderer.invoke('base:coverage', version, platforms, deployments),
    runBaseRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: string[],
        deployments: string[],
    ) =>
        ipcRenderer.invoke(
            'base:run',
            apkPath,
            ipaPath,
            version,
            platforms,
            deployments,
        ),
    runCodePush: (platforms: string[], deployments: string[], version: string) =>
        ipcRenderer.invoke('codepush:run', platforms, deployments, version),
    onLog: (cb: (line: { stream: string; text: string }) => void) => {
        const handler = (_e: unknown, line: { stream: string; text: string }) =>
            cb(line);
        ipcRenderer.on('revopush:log', handler);
        return () => ipcRenderer.removeListener('revopush:log', handler);
    },
});
