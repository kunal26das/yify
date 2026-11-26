const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {transformSync} = require('@babel/core');

const root = path.resolve(__dirname, '../..');
const rootRequire = createRequire(path.join(root, 'package.json'));
const sourceExtensions = ['.ts', '.tsx'];

function packageRequire(filename) {
    const nativeRequire = createRequire(filename);
    const resolveFrom = (specifier) => {
        try {
            return nativeRequire.resolve(specifier);
        } catch (error) {
            if (error.code !== 'MODULE_NOT_FOUND') throw error;
            return rootRequire.resolve(specifier);
        }
    };
    return {resolve: resolveFrom, load: (specifier) => nativeRequire(resolveFrom(specifier))};
}

function transpileTs(source, filename) {
    const result = transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        presets: [
            require.resolve('@babel/preset-typescript'),
            ...(/\.tsx$/i.test(filename) ? [[require.resolve('@babel/preset-react'), {runtime: 'automatic'}]] : []),
        ],
        plugins: [
            require.resolve('@babel/plugin-transform-dynamic-import'),
            require.resolve('@babel/plugin-transform-modules-commonjs'),
        ],
    });
    if (!result?.code) throw new Error(`TypeScript test transform produced no code: ${filename}`);
    return result.code;
}

function localBase(specifier, filename) {
    if (specifier.startsWith('@/')) return path.join(root, 'src', specifier.slice(2));
    if (specifier.startsWith('@assets/')) return path.join(root, 'assets', specifier.slice(8));
    if (specifier.startsWith('./') || specifier.startsWith('../')) return path.resolve(path.dirname(filename), specifier);
    return null;
}

function isFile(candidate) {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
}

function findLocal(base) {
    if (sourceExtensions.includes(path.extname(base)) && isFile(base)) return base;
    for (const extension of sourceExtensions) {
        if (isFile(base + extension)) return base + extension;
    }
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
        for (const extension of sourceExtensions) {
            const index = path.join(base, `index${extension}`);
            if (isFile(index)) return index;
        }
    }
    if (isFile(base)) return base;
    return null;
}

function loadTs(file, mocks = {}) {
    const cache = new Map();

    function load(filename) {
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = {exports: {}};
        cache.set(filename, module);
        const packages = packageRequire(filename);
        const requireModule = (specifier) => {
            if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
            const base = localBase(specifier, filename);
            if (base) {
                const local = findLocal(base);
                if (!local) throw new Error(`Cannot resolve ${specifier} from ${path.relative(root, filename)}`);
                if (sourceExtensions.includes(path.extname(local))) return load(local);
                if (/^\.(?:json|[cm]?js)$/.test(path.extname(local))) return packages.load(local);
                return path.relative(root, local);
            }
            const dependency = packages.resolve(specifier);
            if (sourceExtensions.includes(path.extname(dependency))) return load(dependency);
            return packages.load(specifier);
        };
        const code = transpileTs(fs.readFileSync(filename, 'utf8'), filename);
        const execute = vm.runInThisContext(`(function(exports, require, module, __filename, __dirname) {\n${code}\n})`, {filename});
        execute(module.exports, requireModule, module, filename, path.dirname(filename));
        return module.exports;
    }

    return load(path.resolve(root, file));
}

module.exports = {loadTs, transpileTs};
