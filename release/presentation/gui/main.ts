import {app, BrowserWindow, ipcMain, nativeImage, nativeTheme, shell,} from 'electron';
import dns from 'node:dns';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    authStatus,
    cancelActive,
    type Channel,
    currentBranch,
    login as coreLogin,
    loginPageUrl,
    type LogLine,
    logout as coreLogout,
    type Platform,
    releaseCoverage,
    REPO_ROOT,
    repoPackageVersion,
    repoTargetVersion,
    runStoreRelease,
    runUpdate,
    summarizeUpdate,
    validateBinaries,
} from '../container.js';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily?.(true);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const appIcon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));

function createWindow() {
    const isMac = process.platform === 'darwin';
    nativeTheme.themeSource = 'system';
    if (isMac && !appIcon.isEmpty()) app.dock?.setIcon(appIcon);
    const win = new BrowserWindow({
        width: 920,
        height: 760,
        title: 'Yify Release Console',
        icon: appIcon,
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        trafficLightPosition: isMac ? {x: 18, y: 22} : undefined,
        frame: isMac ? undefined : false,
        transparent: true,
        backgroundColor: '#00000000',
        vibrancy: isMac ? 'under-window' : undefined,
        visualEffectState: 'active',
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false,
        },
    });

    win.loadFile(path.join(__dirname, 'index.html'));
    win.maximize();
    return win;
}

function forwardLogs(win: BrowserWindow) {
    return (line: LogLine) => {
        if (!win.isDestroyed()) win.webContents.send('release:log', line);
    };
}

app.whenReady().then(() => {
    const win = createWindow();
    const onLine = forwardLogs(win);

    ipcMain.handle('task:cancel', async () => {
        return {killed: cancelActive()};
    });

    ipcMain.handle('meta:info', async () => {
        let version = '';
        let packageVersion = '';
        try {
            version = repoTargetVersion();
            packageVersion = repoPackageVersion();
        } catch {
        }
        return {
            repoRoot: REPO_ROOT,
            version,
            packageVersion,
            branch: currentBranch() ?? '',
        };
    });

    ipcMain.handle('auth:check', async () => {
        return authStatus();
    });

    ipcMain.handle('auth:openLoginPage', async () => {
        const url = loginPageUrl();
        await shell.openExternal(url);
        return {ok: true, url};
    });

    ipcMain.handle('auth:login', async (_e, token: string) => {
        return coreLogin(token, onLine);
    });

    ipcMain.handle('auth:logout', async () => {
        return coreLogout(onLine);
    });

    ipcMain.handle(
        'store:validate',
        async (_e, apkPath: string, ipaPath: string, platforms: Platform[]) => {
            return validateBinaries(apkPath, ipaPath, platforms);
        },
    );

    ipcMain.handle(
        'store:coverage',
        async (_e, platforms: Platform[], channels: Channel[]) => {
            const {have, total, covered} = await releaseCoverage(
                platforms,
                channels,
            );
            return {have, total, covered};
        },
    );

    ipcMain.handle(
        'store:run',
        async (
            _e,
            apkPath: string,
            ipaPath: string,
            version: string,
            platforms: Platform[],
            channels: Channel[],
        ) => {
            return runStoreRelease(
                {apkPath, ipaPath, version, platforms, channels},
                onLine,
            );
        },
    );

    ipcMain.handle(
        'update:run',
        async (
            _e,
            platforms: Platform[],
            channels: Channel[],
            message: string,
        ) => {
            const res = await runUpdate(platforms, channels, message, onLine);
            return {...res, summary: summarizeUpdate(res)};
        },
    );

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    app.quit();
});
