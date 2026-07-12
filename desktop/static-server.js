const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, type) {
    res.writeHead(status, {'Content-Type': type || 'text/plain; charset=utf-8'});
    res.end(body);
}

function startStaticServer(rootDir) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let urlPath;
            try {
                urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            } catch {
                return send(res, 400, 'Bad request');
            }

            const resolved = path.normalize(path.join(rootDir, urlPath));
            if (!resolved.startsWith(rootDir)) {
                return send(res, 403, 'Forbidden');
            }

            const tryFiles = [];
            if (urlPath === '/' || urlPath.endsWith('/')) {
                tryFiles.push(path.join(resolved, 'index.html'));
            } else {
                tryFiles.push(resolved);
                if (!path.extname(resolved)) {
                    tryFiles.push(resolved + '.html');
                }
            }
            tryFiles.push(path.join(rootDir, 'index.html'));

            for (const file of tryFiles) {
                if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
                    res.writeHead(200, {'Content-Type': type});
                    fs.createReadStream(file).pipe(res);
                    return;
                }
            }
            send(res, 404, 'Not found');
        });

        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const {port} = server.address();
            resolve({server, port});
        });
    });
}

module.exports = {startStaticServer};
