const {transformSync} = require('@babel/core');

function transpileTypeScript(source, filename) {
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

module.exports = {transpileTypeScript};
