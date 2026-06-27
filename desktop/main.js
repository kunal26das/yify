const {app, BrowserWindow, shell, Menu, Tray, nativeImage, nativeTheme} = require('electron');
const path = require('path');
const {startStaticServer} = require('./static-server');
const {startNewMoviesNotifier, checkForNewMovies} = require('./new-movies-notifier');

const isDev = !app.isPackaged;

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
// Platforms that get a translucent ("liquid glass") window: macOS vibrancy and
// Windows acrylic. Linux keeps a solid background.
const isFrosted = isMac || isWin;

// Height of the macOS title-bar / traffic-light strip. The app mirrors this as a
// top safe-area inset (DESKTOP_TOP_INSET in app/_layout.tsx) so content renders
// edge-to-edge yet still clears the traffic lights. Only macOS uses the frameless
// overlay; Windows keeps its native frame, so no inset there.
const TITLEBAR_INSET = isMac ? 44 : 0;

// Make the web layers transparent so the frosted window material shows through.
// On macOS the frameless window also needs a draggable top strip in place of the
// hidden title bar; Windows keeps its native frame, so it gets neither.
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

// In production the web build is bundled next to this file (see build config).
const DIST_DIR = isDev
    ? path.join(__dirname, '..', 'dist')
    : path.join(process.resourcesPath, 'dist');

let mainWindow = null;
let staticServer = null;
let tray = null;
let currentPort = null;
let stopNotifier = null;
// True only once the user explicitly quits; until then, closing the window hides
// it to the tray so the daily new-movies check keeps running in the background.
let isQuitting = false;

async function createWindow() {
    const {server, port} = await startStaticServer(DIST_DIR);
    staticServer = server;
    currentPort = port;

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 832,
        minWidth: 720,
        minHeight: 480,
        show: false,
        // macOS uses the dock icon (set in app.whenReady); Windows/Linux read the
        // window icon here for the taskbar in the unpackaged dev run.
        ...(isMac ? {} : {icon: path.join(__dirname, 'assets', 'icon.png')}),
        // Per-platform window chrome:
        //  - macOS: frameless inset title bar (traffic lights over content) on a
        //    full-window vibrancy "liquid glass" surface.
        //  - Windows: native frame with an acrylic frosted background.
        //  - Linux: solid background (no reliable frosted material in Electron).
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

    // Make the web layers transparent for the vibrancy material on every (re)load.
    mainWindow.webContents.on('dom-ready', () => applyDesktopChrome(mainWindow.webContents));

    // Avoid white flash; reveal once content is painted.
    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Open external links (e.g. trailers) in the system browser, not the app.
    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
            return {action: 'allow'};
        }
        void shell.openExternal(url);
        return {action: 'deny'};
    });

    await mainWindow.loadURL(`http://127.0.0.1:${port}`);

    // Closing the window hides it to the tray (so background checks continue)
    // rather than tearing it down — unless the user chose Quit.
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

function showWindow() {
    if (isMac && app.dock) void app.dock.show();
    if (!mainWindow) {
        void createWindow();
        return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

// Bring the app to the foreground and deep-link to a movie when a notification is
// clicked. `movieId` is undefined for the "N new movies" summary notification.
async function showMovie(movieId) {
    if (!mainWindow) await createWindow();
    showWindow();
    if (typeof movieId === 'number' && currentPort) {
        await mainWindow.loadURL(`http://127.0.0.1:${currentPort}/movie/${movieId}`);
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

app.whenReady().then(() => {
    // Packaged builds get their icon from electron-builder (electron-builder.yml).
    // The unpackaged `yarn desktop` run otherwise shows the default Electron dock
    // icon, so set it explicitly here for macOS dev.
    if (isMac && isDev && app.dock) {
        app.dock.setIcon(path.join(__dirname, 'assets', 'icon.png'));
    }
    Menu.setApplicationMenu(buildMenu());
    createTray();
    void createWindow();
    stopNotifier = startNewMoviesNotifier((id) => void showMovie(id));

    app.on('activate', () => {
        showWindow();
    });
});

// The tray keeps the app running after the last window closes, so the daily
// check still fires. Quitting goes through the tray's Quit item (isQuitting).
app.on('window-all-closed', () => {
    // Intentionally no-op: stay alive in the tray on every platform.
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
