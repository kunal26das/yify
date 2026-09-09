const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {DESKTOP_PORT, startStaticServer} = require('../desktop/static-server');

const desktopDir = path.join(__dirname, '..', 'desktop');

function loadDesktopModule(filename, dependencies) {
    const module = {exports: {}};
    const source = fs.readFileSync(path.join(desktopDir, filename), 'utf8');
    const run = vm.runInNewContext(`(function (require, module, __dirname, process) { ${source}\n})`);
    run((name) => dependencies[name] ?? require(name), module, desktopDir, {platform: 'linux'});
    return module.exports;
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('desktop server uses the same nonzero loopback port in separate launches', async () => {
    const addresses = [];
    for (let launch = 0; launch < 2; launch++) {
        const {startStaticServer: start} = loadDesktopModule('static-server.js', {
            http: {
                createServer: () => {
                    const server = new EventEmitter();
                    server.listen = (port, host, callback) => {
                        addresses.push({port, host});
                        server.address = () => ({port});
                        callback();
                    };
                    return server;
                },
            },
        });
        await start('/unused');
    }
    assert.ok(addresses[0].port > 0);
    assert.deepEqual(addresses, [
        {port: DESKTOP_PORT, host: '127.0.0.1'},
        {port: DESKTOP_PORT, host: '127.0.0.1'},
    ]);
});

test('desktop server fails on an occupied port and can reuse it after restart', async (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-desktop-'));
    t.after(() => fs.rmSync(root, {recursive: true, force: true}));
    fs.writeFileSync(path.join(root, 'index.html'), '<h1>Yify</h1>');
    const first = await startStaticServer(root, 0);
    t.after(() => first.server.listening && closeServer(first.server));
    const origin = `http://127.0.0.1:${first.port}`;
    assert.equal(await (await fetch(`${origin}/movie/42`)).text(), '<h1>Yify</h1>');

    await assert.rejects(startStaticServer(root, first.port), {code: 'EADDRINUSE'});
    await closeServer(first.server);

    const restarted = await startStaticServer(root, first.port);
    t.after(() => closeServer(restarted.server));
    assert.equal(`http://127.0.0.1:${restarted.port}`, origin);
    assert.equal(await (await fetch(origin)).text(), '<h1>Yify</h1>');
});

function launchDesktop({ownsLock = true, startServer} = {}) {
    const app = new EventEmitter();
    const windows = [];
    const serverCalls = [];
    const errors = [];
    let quits = 0;
    let trays = 0;
    let finishReady;
    const ready = new Promise((resolve) => { finishReady = resolve; });
    app.isPackaged = false;
    app.requestSingleInstanceLock = () => ownsLock;
    app.whenReady = () => ready;
    app.quit = () => { quits++; };

    class BrowserWindow extends EventEmitter {
        constructor() {
            super();
            this.urls = [];
            this.shows = 0;
            this.focuses = 0;
            this.webContents = new EventEmitter();
            this.webContents.setWindowOpenHandler = () => {};
            windows.push(this);
        }
        async loadURL(url) { this.urls.push(url); }
        show() { this.shows++; }
        focus() { this.focuses++; }
        isMinimized() { return false; }
    }

    class Tray extends EventEmitter {
        constructor() { super(); trays++; }
        setToolTip() {}
        setContextMenu() {}
    }

    loadDesktopModule('main.js', {
        electron: {
            app,
            BrowserWindow,
            ipcMain: new EventEmitter(),
            shell: {},
            Menu: {setApplicationMenu() {}, buildFromTemplate: (items) => items},
            Tray,
            nativeImage: {createFromPath: () => ({resize: () => ({})})},
            nativeTheme: {shouldUseDarkColors: false},
            dialog: {showErrorBox: (...args) => errors.push(args)},
        },
        './static-server': {
            DESKTOP_PORT,
            startStaticServer: async (...args) => {
                serverCalls.push(args);
                return startServer ? startServer() : {server: {close() {}}, port: DESKTOP_PORT};
            },
        },
        './new-movies-notifier': {
            startNewMoviesNotifier: () => () => {},
            checkForNewMovies: async () => {},
            writeSettings() {},
        },
    });

    return {
        app, windows, serverCalls, errors, finishReady,
        get quits() { return quits; },
        get trays() { return trays; },
    };
}

test('a second desktop process quits before starting a server or opening a window', async () => {
    const desktop = launchDesktop({ownsLock: false});
    desktop.finishReady();
    await flush();
    assert.equal(desktop.quits, 1);
    assert.equal(desktop.serverCalls.length, 0);
    assert.equal(desktop.windows.length, 0);
    assert.equal(desktop.trays, 0);
});

test('second-instance requests share startup and reopening reuses the same server', async () => {
    let finishServer;
    const serverStarted = new Promise((resolve) => { finishServer = resolve; });
    const desktop = launchDesktop({startServer: () => serverStarted});
    desktop.finishReady();
    await flush();
    desktop.app.emit('second-instance');
    assert.equal(desktop.serverCalls.length, 1);
    assert.equal(desktop.serverCalls[0].length, 1, 'production uses the stable default port');

    finishServer({server: {close() {}}, port: DESKTOP_PORT});
    await flush();
    assert.equal(desktop.windows.length, 1);
    desktop.app.emit('second-instance');
    assert.equal(desktop.windows[0].focuses, 1);

    desktop.windows[0].emit('closed');
    desktop.app.emit('activate');
    await flush();
    assert.equal(desktop.windows.length, 2);
    assert.equal(desktop.serverCalls.length, 1);
    assert.equal(desktop.windows[1].urls[0], desktop.windows[0].urls[0]);
});

test('an occupied desktop port shows an actionable error and quits without a fallback origin', async () => {
    const desktop = launchDesktop({
        startServer: async () => { throw Object.assign(new Error('Address in use'), {code: 'EADDRINUSE'}); },
    });
    desktop.finishReady();
    await flush();
    assert.equal(desktop.serverCalls.length, 1);
    assert.equal(desktop.windows.length, 0);
    assert.equal(desktop.trays, 0);
    assert.equal(desktop.quits, 1);
    assert.equal(desktop.errors.length, 1);
    assert.match(desktop.errors[0][1], /already in use/);
    assert.match(desktop.errors[0][1], new RegExp(String(DESKTOP_PORT)));
});
