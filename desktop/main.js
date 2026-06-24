const {app, BrowserWindow, shell, Menu, nativeTheme} = require('electron');
const path = require('path');
const {startStaticServer} = require('./static-server');

const isDev = !app.isPackaged;

// On macOS the frameless `hiddenInset` window lets web content render under the
// traffic lights. Reserve a strip at the top so nothing overlaps them, and make
// that strip draggable so the window still moves like a native title bar.
const TITLEBAR_INSET = process.platform === 'darwin' ? 40 : 0;

function applyDesktopChrome(contents) {
    if (!TITLEBAR_INSET) return;
    void contents.insertCSS(`
        #root { padding-top: ${TITLEBAR_INSET}px !important; box-sizing: border-box !important; }
        /* The inset strip follows the system color scheme so it matches the app
           theme instead of a fixed material. */
        html, body { background: #ffffff; }
        @media (prefers-color-scheme: dark) { html, body { background: #000000; } }
        .yify-drag-region {
            position: fixed; top: 0; left: 0; right: 0; height: ${TITLEBAR_INSET}px;
            -webkit-app-region: drag; z-index: 2147483647; pointer-events: auto;
            background: transparent;
        }
    `);
    void contents.executeJavaScript(`
        if (!document.querySelector('.yify-drag-region')) {
            const d = document.createElement('div');
            d.className = 'yify-drag-region';
            document.body.appendChild(d);
        }
    `);
}

// In production the web build is bundled next to this file (see build config).
const DIST_DIR = isDev
    ? path.join(__dirname, '..', 'dist')
    : path.join(process.resourcesPath, 'dist');

let mainWindow = null;
let staticServer = null;

async function createWindow() {
    const {server, port} = await startStaticServer(DIST_DIR);
    staticServer = server;

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 832,
        minWidth: 720,
        minHeight: 480,
        show: false,
        // Native macOS chrome: traffic lights over content, inset title bar.
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: {x: 18, y: 22},
        backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Reserve the top strip for the traffic lights on every (re)load.
    mainWindow.webContents.on('dom-ready', () => applyDesktopChrome(mainWindow.webContents));

    // Keep the native window background in sync with the system theme.
    const syncTheme = () => {
        if (mainWindow) {
            mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff');
        }
    };
    nativeTheme.on('updated', syncTheme);

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

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(buildMenu());
    void createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            void createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    if (staticServer) {
        staticServer.close();
    }
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
