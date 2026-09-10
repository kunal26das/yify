const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const checker = path.join(root, 'scripts/check-web-export.mjs');
const markers = ['movies-api.accel.li', 'eztvx.to', 'list_movies.json', 'get-torrents', 'magnet:?', 'xt=urn:btih'];

function fixture(t, server = false) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-web-export-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const client = server ? path.join(directory, 'client') : directory;
    const serverDirectory = path.join(directory, 'server');
    const htmlDirectory = server ? serverDirectory : client;
    const write = (name, contents, base = client) => {
        const file = path.join(base, name);
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, contents);
    };
    for (const [file, title] of [
        ['index.html', 'Yify'], ['movies.html', 'Browse Movies'], ['shows.html', 'Shows'],
        ['watchlist.html', 'Watchlist'], ['history.html', 'History'], ['preferences.html', 'Preferences'],
    ]) {
        write(file, `<html><head><title>${title}</title><style>@font-face {}</style></head><body>${'Content '.repeat(600)}</body></html>`, htmlDirectory);
    }
    for (const asset of ['manifest.json', 'robots.txt', 'sitemap.xml', 'og-card.png', '.well-known/assetlinks.json', 'legal.css']) write(asset, '');
    for (const file of ['delete-account.html', 'delete-account/index.html']) write(file, '<body>Delete account</body>');
    for (const [name, title] of [['privacy', 'Privacy Policy'], ['terms', 'Terms &amp; Conditions']]) {
        for (const file of [`${name}.html`, `${name}/index.html`]) write(file, `<h1>${title}</h1><a href="mailto:kunal26das@gmail.com">Contact</a>`);
    }
    write('_expo/static/js/web/entry-app.js', 'console.log("metadata catalog");');
    if (server) {
        write('_expo/routes.json', JSON.stringify({apiRoutes: [{page: '/api/catalog/[operation]', file: '_expo/functions/api/catalog/[operation]+api.js'}]}), serverDirectory);
        write('_expo/functions/api/catalog/[operation]+api.js', `const upstream = ${JSON.stringify(markers)};`, serverDirectory);
    }
    const check = (flag = server ? '--server' : '--static') => {
        const result = spawnSync(process.execPath, [checker, directory, flag], {encoding: 'utf8'});
        return {status: result.status, output: result.stdout + result.stderr};
    };
    return {directory, client, serverDirectory, htmlDirectory, write, check};
}

test('static export contains only safe client code and may retain private maps before upload', (t) => {
    const f = fixture(t);
    f.write('_expo/static/js/web/entry-app.js.map', JSON.stringify({sourcesContent: markers}));
    const result = f.check();
    assert.equal(result.status, 0, result.output);
});

test('Hosting export checks prerendered server HTML and public client assets separately', (t) => {
    const f = fixture(t, true);
    assert.ok(fs.existsSync(path.join(f.serverDirectory, 'index.html')));
    assert.equal(fs.existsSync(path.join(f.client, 'index.html')), false);
    assert.ok(fs.existsSync(path.join(f.client, 'privacy/index.html')));
    const result = f.check();
    assert.equal(result.status, 0, result.output);
});

test('Hosting gate rejects missing server HTML even when a client copy exists', (t) => {
    const f = fixture(t, true);
    fs.renameSync(path.join(f.serverDirectory, 'index.html'), path.join(f.client, 'index.html'));
    const result = f.check();
    assert.equal(result.status, 1);
    assert.match(result.output, /index\.html: missing from the export/);
});

for (const server of [false, true]) {
    test(`${server ? 'Hosting' : 'Pages'} export rejects forbidden browser catalog markers`, (t) => {
        const f = fixture(t, server);
        for (const marker of markers) {
            f.write('_expo/static/js/web/entry-app.js', `const value = ${JSON.stringify(marker)};`);
            const result = f.check();
            assert.equal(result.status, 1);
            assert.ok(result.output.includes(`forbidden browser catalog data marker ${marker}`));
        }
    });
}

test('Pages gate rejects Hosting output and accidental server artifacts', (t) => {
    const hosting = fixture(t, true);
    assert.match(hosting.check('--static').output, /server output must not be published as a static site/);
    const f = fixture(t);
    f.write('_expo/functions/catalog.js', 'server implementation');
    const result = f.check();
    assert.equal(result.status, 1);
    assert.match(result.output, /server output must not be published as a static site/);
});

test('Hosting gate rejects absent or invalid catalog route bundles', (t) => {
    const f = fixture(t, true);
    fs.unlinkSync(path.join(f.serverDirectory, '_expo/functions/api/catalog/[operation]+api.js'));
    assert.equal(f.check().status, 1);
    for (const manifest of [{apiRoutes: []}, {apiRoutes: [{page: '/api/catalog/[operation]', file: '../client/index.html'}]}, null]) {
        f.write('_expo/routes.json', JSON.stringify(manifest), f.serverDirectory);
        const result = f.check();
        assert.equal(result.status, 1);
        assert.match(result.output, /server catalog API:/);
    }
});

for (const server of [false, true]) {
    test(`${server ? 'Hosting' : 'Pages'} gate retains rendering and legal-page checks`, (t) => {
        const f = fixture(t, server);
        f.write('index.html', '<html><head><title>Yify</title></head><body></body></html>', f.htmlDirectory);
        f.write('privacy.html', '<h1>Privacy Policy</h1><script>console.log("unexpected");</script>');
        f.write('_sitemap.html', 'Unexpected development route', f.htmlDirectory);
        const result = f.check();
        assert.equal(result.status, 1);
        assert.match(result.output, /static rendering produced an empty shell/);
        assert.match(result.output, /legal pages must remain readable without app scripts/);
        assert.match(result.output, /expo-router dev route leaked into the export/);
    });
}

test('only the explicit Hosting export selects server output', () => {
    for (const [output, baseUrl, expected] of [[undefined, '', 'static'], ['static', '/yify', 'static'], ['server', '', 'server']]) {
        const env = {...process.env, EXPO_WEB_BASE_URL: baseUrl};
        if (output === undefined) delete env.EXPO_WEB_OUTPUT;
        else env.EXPO_WEB_OUTPUT = output;
        const result = spawnSync(process.execPath, ['-e', 'const {expo}=require("./app.config.js"); console.log(JSON.stringify({output:expo.web.output,baseUrl:expo.experiments.baseUrl}));'], {cwd: root, env, encoding: 'utf8'});
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout), {output: expected, baseUrl});
    }
});
