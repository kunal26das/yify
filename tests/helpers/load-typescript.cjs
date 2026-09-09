const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '../..');

// Exercise the real TypeScript modules while replacing native/network boundaries.
function loadTypeScript(file, mocks = {}) {
    const cache = new Map();

    function load(filename) {
        if (cache.has(filename)) return cache.get(filename).exports;
        const module = {exports: {}};
        cache.set(filename, module);
        const nativeRequire = createRequire(filename);
        const requireModule = (specifier) => {
            if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
            if (specifier.startsWith('.') || specifier.startsWith('@/')) {
                const base = specifier.startsWith('@/')
                    ? path.join(repoRoot, specifier.slice(2))
                    : path.resolve(path.dirname(filename), specifier);
                const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
                if (base.endsWith('.js')) candidates.push(base.slice(0, -3) + '.ts');
                const dependency = candidates.find((candidate) =>
                    /\.tsx?$/.test(candidate) && fs.existsSync(candidate)
                );
                if (dependency) return load(dependency);
            }
            return nativeRequire(specifier);
        };
        const {outputText} = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            fileName: filename,
            compilerOptions: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.CommonJS,
                jsx: ts.JsxEmit.ReactJSX,
                esModuleInterop: true,
            },
        });
        const execute = vm.runInThisContext(
            `(function(exports, require, module, __filename, __dirname) {\n${outputText}\n})`,
            {filename}
        );
        execute(module.exports, requireModule, module, filename, path.dirname(filename));
        return module.exports;
    }

    return load(path.resolve(repoRoot, file));
}

module.exports = {loadTypeScript};
