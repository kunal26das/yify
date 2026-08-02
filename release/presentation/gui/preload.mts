import {clipboard, contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('release', {
    platform: process.platform,
    info: () => ipcRenderer.invoke('meta:info'),
    checkAuth: () => ipcRenderer.invoke('auth:check'),
    cancelTask: () => ipcRenderer.invoke('task:cancel'),
    readClipboard: () => clipboard.readText(),
    openLoginPage: () => ipcRenderer.invoke('auth:openLoginPage'),
    login: (token: string) => ipcRenderer.invoke('auth:login', token),
    logout: () => ipcRenderer.invoke('auth:logout'),
    validateBinaries: (
        apkPath: string,
        ipaPath: string,
        platforms: string[],
    ) => ipcRenderer.invoke('store:validate', apkPath, ipaPath, platforms),
    releaseCoverage: (platforms: string[], channels: string[]) =>
        ipcRenderer.invoke('store:coverage', platforms, channels),
    runStoreRelease: (
        apkPath: string,
        ipaPath: string,
        version: string,
        platforms: string[],
        channels: string[],
    ) =>
        ipcRenderer.invoke(
            'store:run',
            apkPath,
            ipaPath,
            version,
            platforms,
            channels,
        ),
    runUpdate: (platforms: string[], channels: string[], message: string) =>
        ipcRenderer.invoke('update:run', platforms, channels, message),
    onLog: (cb: (line: { stream: string; text: string }) => void) => {
        const handler = (_e: unknown, line: { stream: string; text: string }) =>
            cb(line);
        ipcRenderer.on('release:log', handler);
        return () => ipcRenderer.removeListener('release:log', handler);
    },
});
