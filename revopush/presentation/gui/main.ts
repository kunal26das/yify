import {
    app,
    BrowserWindow,
    ipcMain,
    nativeImage,
    nativeTheme,
    shell,
} from 'electron';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    authStatus,
    baseCoverage,
    cancelActive,
    currentBranch,
    type Deployment,
    login as coreLogin,
    loginPageUrl,
    type LogLine,
    logout as coreLogout,
    type Platform,
    REPO_ROOT,
    repoPackageVersion,
    repoTargetVersion,
    runBaseRelease,
    runCodePush,
    summarizeCodePush,
    validateBinaries,
} from '../container.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const appIcon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));

function createWindow() {
    const isMac = process.platform === 'darwin';
    nativeTheme.themeSource = 'system';
    if (isMac && !appIcon.isEmpty()) app.dock?.setIcon(appIcon);
    const win = new BrowserWindow({
        width: 920,
        height: 760,
        title: 'RevoPush Release Console',
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
        if (!win.isDestroyed()) win.webContents.send("revopush:log", line);
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
        const url = loginPageUrl(os.hostname());
        await shell.openExternal(url);
        return {ok: true, url};
    });

    ipcMain.handle('auth:login', async (_e, accessKey: string) => {
        return coreLogin(accessKey, onLine);
    });

    ipcMain.handle('auth:logout', async () => {
        return coreLogout(onLine);
    });

    ipcMain.handle(
        'base:validate',
        async (_e, apkPath: string, ipaPath: string, platforms: Platform[]) => {
            return validateBinaries(apkPath, ipaPath, platforms);
        },
    );

    ipcMain.handle(
        'base:coverage',
        async (
            _e,
            version: string,
            platforms: Platform[],
            deployments: Deployment[],
        ) => {
            const {have, total, covered} = await baseCoverage(
                version,
                platforms,
                deployments,
            );
            return {have, total, covered};
        },
    );

    ipcMain.handle(
        'base:run',
        async (
            _e,
            apkPath: string,
            ipaPath: string,
            version: string,
            platforms: Platform[],
            deployments: Deployment[],
        ) => {
            return runBaseRelease(
                {apkPath, ipaPath, version, platforms, deployments},
                onLine,
            );
        },
    );

    ipcMain.handle(
        'codepush:run',
        async (
            _e,
            platforms: Platform[],
            deployments: Deployment[],
            version: string,
        ) => {
            const res = await runCodePush(platforms, deployments, version, onLine);
            return {...res, summary: summarizeCodePush(res)};
        },
    );

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    app.quit();
});
