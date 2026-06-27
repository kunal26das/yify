import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const guiDir = path.join(root, 'presentation', 'gui');
const outDir = path.join(root, 'dist', 'presentation', 'gui');

const files = ['index.html', 'icon.png', 'icon.ico'];
const dirs = ['fonts'];

fs.mkdirSync(outDir, {recursive: true});

for (const file of files) {
    const src = path.join(guiDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(outDir, file));
        console.log(`copied ${file}`);
    }
}

for (const dir of dirs) {
    const src = path.join(guiDir, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(outDir, dir), {recursive: true});
        console.log(`copied ${dir}/`);
    }
}
