// One-shot driver: launches the desktop app exactly like main.js, waits for the
// expo-router app to hydrate, optionally navigates, screenshots, reports state.
const {app, BrowserWindow, nativeTheme} = require('electron');
const path = require('path');
const {execFileSync} = require('child_process');
const {startStaticServer} = require('./static-server');

// Window placement so a native screen capture can grab the exact region — this is
// the only way to see the vibrancy ("liquid glass") behind the transparent web layer.
const WIN = {x: 80, y: 90, width: 1280, height: 832};

const isMac = process.platform === 'darwin';
const TITLEBAR_INSET = isMac ? 44 : 0;

function applyDesktopChrome(contents) {
    if (!isMac) return;
    void contents.insertCSS(`
        html, body, #root { background: transparent !important; }
        .yify-drag-region { position: fixed; top: 0; left: 0; right: 0; height: ${TITLEBAR_INSET}px; -webkit-app-region: drag; z-index: 2147483647; background: transparent; }
    `);
    void contents.executeJavaScript(`
        if (!document.querySelector('.yify-drag-region')) {
            const d = document.createElement('div');
            d.className = 'yify-drag-region';
            document.body.appendChild(d);
        }
    `);
}

const SHOT = process.env.SHOT_PATH || '/tmp/yify-desktop.png';
const NAV = process.env.NAV; // optional: 'movie' to click first poster

app.whenReady().then(async () => {
    const {server, port} = await startStaticServer(path.join(__dirname, '..', 'dist'));

    const win = new BrowserWindow({
        ...WIN,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: {x: 18, y: 22},
        ...(isMac
            ? {vibrancy: 'under-window', visualEffectState: 'active', backgroundColor: '#00000000'}
            : {backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ffffff'}),
        webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true},
    });

    win.webContents.on('did-fail-load', (_e, code, desc) => {
        console.log('FAIL_LOAD', code, desc);
        server.close();
        app.quit();
    });

    win.webContents.on('dom-ready', () => applyDesktopChrome(win.webContents));

    await win.loadURL(`http://127.0.0.1:${port}`);

    const waitForRender = async () => {
        const deadline = Date.now() + 20000;
        let info = {};
        while (Date.now() < deadline) {
            info = await win.webContents.executeJavaScript(`(() => {
                const root = document.getElementById('root');
                return {
                    url: location.pathname,
                    rootChildren: root ? root.childElementCount : -1,
                    bodyTextLen: document.body.innerText.trim().length,
                    imgCount: document.querySelectorAll('img').length,
                };
            })()`);
            if (info.rootChildren > 0 && info.bodyTextLen > 0) break;
            await new Promise(r => setTimeout(r, 500));
        }
        return info;
    };

    let info = await waitForRender();
    await new Promise(r => setTimeout(r, 2000));

    if (NAV === 'movie') {
        // Click the first movie link/poster to trigger client-side navigation.
        const clicked = await win.webContents.executeJavaScript(`(() => {
            const link = document.querySelector('a[href*="/movie/"]');
            if (link) { link.click(); return 'link:' + link.getAttribute('href'); }
            const img = document.querySelector('img');
            if (img) {
                let el = img;
                while (el && el !== document.body) {
                    if (el.getAttribute && (el.getAttribute('role') === 'button' || el.onclick)) { el.click(); return 'parent-click'; }
                    el = el.parentElement;
                }
                img.click(); return 'img-click';
            }
            return 'NO_TARGET';
        })()`);
        console.log('NAV_CLICK', clicked);
        await new Promise(r => setTimeout(r, 4000));
        info = await win.webContents.executeJavaScript(`(() => ({
            url: location.pathname,
            bodyTextLen: document.body.innerText.trim().length,
            imgCount: document.querySelectorAll('img').length,
        }))()`);
    }

    // Native capture of the window region so the vibrancy material is included.
    win.setBounds(WIN);
    win.show();
    win.focus();
    await new Promise(r => setTimeout(r, 1500));
    execFileSync('screencapture', [
        '-x', '-o',
        '-R', `${WIN.x},${WIN.y},${WIN.width},${WIN.height}`,
        SHOT,
    ]);
    console.log('DOM_STATE', JSON.stringify(info));
    console.log('SCREENSHOT', SHOT);

    server.close();
    app.quit();
});
