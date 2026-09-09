const {app, BrowserWindow, ipcMain, shell, Menu, Tray, nativeImage, nativeTheme, dialog} = require('electron');
const path = require('path');
const {startStaticServer, DESKTOP_PORT} = require('./static-server');
const {startNewMoviesNotifier, checkForNewMovies, writeSettings} = require('./new-movies-notifier');

const isDev = !app.isPackaged;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isFrosted = isMac || isWin;

const TITLEBAR_INSET = isMac ? 44 : 0;

function applyDesktopChrome(contents) {
    if (!isFrosted) return;
    const dragRegion = isMac
        ? `.yify-drag-region {
               position: fixed; top: 0; left: 0; right: 0; height: ${TITLEBAR_INSET}px;
               -webkit-app-region: drag; z-index: 2147483647; background: transparent;
           }`
        : '';
    void contents.insertCSS(`
        html, body, #root { background: transparent !important; }
        ${dragRegion}
    `);
    if (isMac) {
        void contents.executeJavaScript(`
            if (!document.querySelector('.yify-drag-region')) {
                const d = document.createElement('div');
                d.className = 'yify-drag-region';
                document.body.appendChild(d);
            }
        `);
    }
}

const DIST_DIR = isDev
    ? path.join(__dirname, '..', 'dist')
    : path.join(process.resourcesPath, 'dist');

let mainWindow = null;
let staticServer = null;
let tray = null;
let currentPort = null;
let stopNotifier = null;
let isQuitting = false;
let creatingWindow = null;

function createWindow() {
    if (mainWindow) return Promise.resolve();
    if (!creatingWindow) {
        creatingWindow = openWindow().finally(() => {
            creatingWindow = null;
        });
    }
    return creatingWindow;
}

async function openWindow() {
    if (!staticServer) {
        const {server, port} = await startStaticServer(DIST_DIR);
        staticServer = server;
        currentPort = port;
    }

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 832,
        minWidth: 720,
        minHeight: 480,
        show: false,
        ...(isMac ? {} : {icon: path.join(__dirname, 'assets', 'icon.png')}),
        ...(isMac ? {titleBarStyle: 'hiddenInset', trafficLightPosition: {x: 18, y: 22}} : {}),
        ...(isMac
            ? {vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: '#00000000'}
            : isWin
                ? {backgroundMaterial: 'acrylic', backgroundColor: '#00000000'}
                : {backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff'}),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.webContents.on('dom-ready', () => applyDesktopChrome(mainWindow.webContents));

    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
            return {action: 'allow'};
        }
        void shell.openExternal(url);
        return {action: 'deny'};
    });

    await mainWindow.loadURL(`http://127.0.0.1:${currentPort}`);

    mainWindow.on('close', (event) => {
        if (isQuitting) return;
        event.preventDefault();
        mainWindow.hide();
        if (isMac && app.dock) app.dock.hide();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function handleWindowError(error) {
    const message = error?.code === 'EADDRINUSE'
        ? `Yify's local port (${DESKTOP_PORT}) is already in use. Close the application using it and try again. Yify must use the same port to keep your saved data accessible.`
        : `Yify could not open its window. ${error instanceof Error ? error.message : String(error)}`;
    dialog.showErrorBox('Unable to start Yify', message);
    app.quit();
}

function showWindow() {
    if (isMac && app.dock) void app.dock.show();
    if (!mainWindow) {
        void createWindow().catch(handleWindowError);
        return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

async function showMovie(movieId) {
    try {
        if (!mainWindow) await createWindow();
        showWindow();
        if (typeof movieId === 'number' && currentPort) {
            await mainWindow.loadURL(`http://127.0.0.1:${currentPort}/movie/${movieId}`);
        }
    } catch (error) {
        handleWindowError(error);
    }
}

function createTray() {
    const icon = nativeImage
        .createFromPath(path.join(__dirname, 'assets', 'icon.png'))
        .resize({width: 18, height: 18});
    tray = new Tray(icon);
    tray.setToolTip('Yify');
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {label: 'Open Yify', click: () => showWindow()},
            {
                label: 'Check for new movies now',
                click: () => {
                    checkForNewMovies((id) => void showMovie(id), true).catch((e) =>
                        console.warn('[new-movies] manual check failed', e),
                    );
                },
            },
            {type: 'separator'},
            {
                label: 'Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                },
            },
        ]),
    );
    tray.on('click', () => showWindow());
}

ipcMain.on('yify:notification-settings', (_event, value) => {
    writeSettings(value);
});

app.on('second-instance', () => {
    showWindow();
});

app.whenReady().then(async () => {
    if (!hasSingleInstanceLock) return;
    if (isMac && isDev && app.dock) {
        app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
    }
    Menu.setApplicationMenu(buildMenu());
    await createWindow();
    createTray();
    stopNotifier = startNewMoviesNotifier((id) => void showMovie(id));

    app.on('activate', () => {
        showWindow();
    });
}).catch(handleWindowError);

app.on('window-all-closed', () => {
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('quit', () => {
    if (stopNotifier) stopNotifier();
    if (staticServer) staticServer.close();
});

function buildMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac
            ? [{
                label: app.name,
                submenu: [
                    {role: 'about'},
                    {type: 'separator'},
                    {role: 'hide'},
                    {role: 'hideOthers'},
                    {role: 'unhide'},
                    {type: 'separator'},
                    {role: 'quit'},
                ],
            }]
            : []),
        {role: 'editMenu'},
        {
            label: 'View',
            submenu: [
                {role: 'reload'},
                {role: 'forceReload'},
                {role: 'toggleDevTools'},
                {type: 'separator'},
                {role: 'resetZoom'},
                {role: 'zoomIn'},
                {role: 'zoomOut'},
                {type: 'separator'},
                {role: 'togglefullscreen'},
            ],
        },
        {role: 'windowMenu'},
    ];
    return Menu.buildFromTemplate(template);
}
