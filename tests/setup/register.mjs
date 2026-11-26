import {registerHooks} from 'node:module';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceExtensions = ['.ts', '.tsx'];

function findSource(base) {
  if (extname(base) && existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of sourceExtensions) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of sourceExtensions) {
      const index = join(base, `index${extension}`);
      if (existsSync(index)) return index;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith('@/')) base = join(root, 'src', specifier.slice(2));
    else if (specifier.startsWith('@assets/')) base = join(root, 'assets', specifier.slice(8));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parent = fileURLToPath(context.parentURL);
      if (sourceExtensions.includes(extname(parent)) && !extname(specifier)) base = resolve(dirname(parent), specifier);
    }
    if (base) {
      const file = findSource(base);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      const text = readFileSync(fileURLToPath(url), 'utf8');
      return {format: 'module', source: `export default ${text};`, shortCircuit: true};
    }
    return nextLoad(url, context);
  },
});
