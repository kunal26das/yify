const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {createRoutesManifest} = require('@expo/router-server/build/routes-manifest');

const root = path.dirname(require.resolve('../package.json'));
const checker = path.join(root, 'scripts/check-web-export.mjs');
const markers = ['movies-api.accel.li', 'eztvx.to', 'list_movies.json', 'get-torrents', 'magnet:?', 'xt=urn:btih'];
const subscriberMarkers = ['YIFY_SUBSCRIBER_FIREBASE_PROJECT_ID', 'YIFY_SUBSCRIBER_REVENUECAT_API_KEY',
    'YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS', 'https://api.revenuecat.com/v2/projects/',
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'];
const apiRoutes = ['catalog', 'subscriber-catalog'].map(name => ({
    page: `/api/${name}/[operation]`, file: `_expo/functions/api/${name}/[operation]+api.js`,
}));

function expoConfig(output, baseUrl = '') {
    const env = {...process.env, EXPO_WEB_BASE_URL: baseUrl};
    if (output === undefined) delete env.EXPO_WEB_OUTPUT;
    else env.EXPO_WEB_OUTPUT = output;
    const result = spawnSync(process.execPath, ['-e', 'console.log(JSON.stringify(require("./app.config.js").expo));'], {
        cwd: root, env, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}

const routerOptions = expoConfig('server').plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-router')[1];
const legalRedirects = createRoutesManifest(['./_layout.tsx', './index.tsx'], routerOptions).redirects;

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
    write('_expo/static/js/web/entry-app.js', 'const endpoints = ["/api/catalog/movies", "/api/subscriber-catalog/movies"];');
    if (server) {
        write('_expo/routes.json', JSON.stringify({apiRoutes, redirects: legalRedirects}), serverDirectory);
        for (const route of apiRoutes) {
            write(route.file, `const privateConfiguration = ${JSON.stringify([...markers, ...subscriberMarkers])};`, serverDirectory);
        }
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

test('Hosting gate rejects legal directory copies without server redirects', (t) => {
    const f = fixture(t, true);
    f.write('_expo/routes.json', JSON.stringify({apiRoutes}), f.serverDirectory);
    const result = f.check();
    assert.equal(result.status, 1);
    for (const name of ['privacy', 'terms', 'delete-account']) {
        for (const source of [`/${name}`, `/${name}/`]) {
            assert.ok(result.output.includes(`${source}: missing permanent Hosting redirect`));
        }
    }
});

test('Hosting gate requires trailing-slash matching, standalone targets and both page request methods', (t) => {
    const f = fixture(t, true);
    for (const replacement of [
        {namedRegex: '^/privacy$'}, {namedRegex: '['}, {page: 'https://yify.expo.app/'},
        {permanent: false}, {methods: ['POST']}, {methods: ['GET']},
    ]) {
        const redirects = legalRedirects.map(route => route.page.endsWith('/privacy.html') ? {...route, ...replacement} : route);
        f.write('_expo/routes.json', JSON.stringify({apiRoutes, redirects}), f.serverDirectory);
        const result = f.check();
        assert.equal(result.status, 1);
        assert.match(result.output, /\/privacy\/: missing permanent Hosting redirect/);
    }
});

test('Expo generates narrow Hosting redirects for both forms of each legal URL', () => {
    assert.equal(legalRedirects.length, 3);
    for (const name of ['privacy', 'terms', 'delete-account']) {
        for (const source of [`/${name}`, `/${name}/`]) {
            const redirect = legalRedirects.find(route => new RegExp(route.namedRegex).test(source));
            assert.equal(redirect?.page, `https://yify.expo.app/${name}.html`);
            assert.equal(redirect.permanent, true);
            assert.equal(redirect.methods, undefined);
        }
        for (const source of [`/${name}.html`, `/${name}/other`, `/${name}-other`]) {
            assert.equal(legalRedirects.some(route => new RegExp(route.namedRegex).test(source)), false);
        }
    }
});

test('Hosting redirects preserve the native configuration and existing router settings', () => {
    const native = expoConfig();
    const staticWeb = expoConfig('static', '/yify');
    const hosting = expoConfig('server');
    assert.deepEqual(native.plugins, require('../app.json').expo.plugins);
    assert.deepEqual(staticWeb.plugins, native.plugins);
    const {plugins: hostingPlugins, web: hostingWeb, ...hostingRest} = hosting;
    const {plugins: nativePlugins, web: nativeWeb, ...nativeRest} = native;
    assert.deepEqual(hostingRest, nativeRest);
    assert.deepEqual(hostingWeb, {...nativeWeb, output: 'server'});
    assert.deepEqual(hostingPlugins.map(plugin => {
        if (!Array.isArray(plugin) || plugin[0] !== 'expo-router') return plugin;
        const {redirects, ...options} = plugin[1];
        assert.equal(redirects.length, 3);
        return [plugin[0], options];
    }), nativePlugins);
});

test('Hosting gate rejects missing server HTML even when a client copy exists', (t) => {
    const f = fixture(t, true);
    fs.renameSync(path.join(f.serverDirectory, 'index.html'), path.join(f.client, 'index.html'));
    const result = f.check();
    assert.equal(result.status, 1);
    assert.match(result.output, /index\.html: missing from the export/);
});

for (const server of [false, true]) {
    test(`${server ? 'Hosting' : 'Pages'} export permits public torrent statistics and subscriber parser field names`, (t) => {
        const f = fixture(t, server);
        const metadata = {
            torrents: [{
                quality: '1080p', type: 'web', videoCodec: 'x265', bitDepth: '10', audioChannels: '5.1',
                seeds: 12, peers: 3, size: '1.2 GB', sizeBytes: 1_200_000_000, uploadedAt: '2026-09-11T00:00:00.000Z',
            }],
        };
        f.write('_expo/static/js/web/entry-app.js', `
            const endpoint = "/api/catalog/movie?id=1&v=2";
            const metadata = ${JSON.stringify(metadata)};
            const subscriberEndpoint = "/api/subscriber-catalog/movie?id=1";
            const subscriberFields = ["torrents", "hash", "url", "magnetUrl"];
            function parseSubscriberTorrent(value) {
                return {hash: value.hash, url: value.url, magnetUrl: value.magnetUrl};
            }
        `);
        const result = f.check();
        assert.equal(result.status, 0, result.output);
    });
    test(`${server ? 'Hosting' : 'Pages'} export rejects forbidden browser catalog markers`, (t) => {
        const f = fixture(t, server);
        for (const marker of markers) {
            f.write('_expo/static/js/web/entry-app.js', `const value = ${JSON.stringify(marker)};`);
            const result = f.check();
            assert.equal(result.status, 1);
            assert.ok(result.output.includes(`forbidden browser catalog data marker ${marker}`));
        }
    });
    test(`${server ? 'Hosting' : 'Pages'} export rejects server-only subscriber verification code in browser bundles`, (t) => {
        const f = fixture(t, server);
        for (const marker of subscriberMarkers) {
            f.write('_expo/static/js/web/entry-app.js', `const value = ${JSON.stringify(marker)};`);
            const result = f.check();
            assert.equal(result.status, 1);
            assert.ok(result.output.includes(`server-only subscriber verification marker ${marker}`));
        }
    });
    test(`${server ? 'Hosting' : 'Pages'} export excludes subscriber server artifacts from public assets`, (t) => {
        const f = fixture(t, server);
        for (const file of ['_expo/functions/api/subscriber-catalog/[operation]+api.js', '_expo/routes.json',
            'api/subscriber-catalog/[operation]+api.js']) {
            f.write(file, 'server implementation');
            const result = f.check();
            assert.equal(result.status, 1);
            assert.match(result.output, /server output must not be published as/);
            fs.rmSync(path.join(f.client, file.split('/')[0]), {recursive: true, force: true});
            f.write('_expo/static/js/web/entry-app.js', 'const endpoint = "/api/subscriber-catalog/movies";');
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

for (const route of apiRoutes) {
    test(`Hosting gate requires the ${route.page} bundle and rejects invalid manifest paths`, (t) => {
        const f = fixture(t, true);
        fs.unlinkSync(path.join(f.serverDirectory, route.file));
        assert.equal(f.check().status, 1);
        f.write(route.file, 'server implementation', f.serverDirectory);
        for (const replacement of [undefined, {page: route.page}, {page: route.page, file: '../client/privacy.html'},
            {page: route.page, file: path.join(f.client, 'privacy.html')}]) {
            const routes = apiRoutes.filter(entry => entry.page !== route.page);
            if (replacement) routes.push(replacement);
            f.write('_expo/routes.json', JSON.stringify({apiRoutes: routes}), f.serverDirectory);
            const result = f.check();
            assert.equal(result.status, 1);
            assert.match(result.output, /server catalog API:/);
            assert.ok(result.output.includes(route.page));
        }
    });
}

test('Hosting gate rejects an invalid API route manifest', (t) => {
    const f = fixture(t, true);
    f.write('_expo/routes.json', 'null', f.serverDirectory);
    assert.match(f.check().output, /server catalog API:/);
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
