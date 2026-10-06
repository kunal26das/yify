import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const options = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!['--repo', '--output', '--variant'].includes(key) || !value) {
    throw new Error('Usage: node prepare.mjs --repo <repository> --output <fixture source directory> [--variant installed|baseline]');
  }
  options.set(key, value);
}
const repo = resolve(options.get('--repo') ?? process.cwd());
if (!options.has('--output')) throw new Error('--output is required');
const output = resolve(options.get('--output'));
const variant = options.get('--variant') ?? 'installed';
if (!['installed', 'baseline'].includes(variant)) throw new Error('Unknown fixture variant');
const templates = join(dirname(fileURLToPath(import.meta.url)), 'templates');
const sources = {};
const reanimated = 'node_modules/react-native-reanimated';
const react = 'node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react';
const nativeKotlin = `${reanimated}/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt`;
const nativeCpp = `${reanimated}/android/src/main/cpp/reanimated/android/NativeProxy.cpp`;
const moduleCpp = `${reanimated}/Common/cpp/reanimated/NativeModules/ReanimatedModuleProxy.cpp`;
const compatibility = await import(pathToFileURL(join(repo, 'scripts/expo-native-compat.mjs')).href);
await compatibility.applyCompatibility({ root: repo, check: true });
const manifest = JSON.parse(await readFile(join(repo, 'patches/expo-native/manifest.json'), 'utf8'));
const nodesEntry = manifest.files.find((entry) => entry.package === 'react-native-reanimated' && entry.file.endsWith('/NodesManager.kt'));
if (!nodesEntry) throw new Error('NodesManager lifecycle source guard is missing');

async function source(path) {
  const value = await readFile(join(repo, path));
  sources[path] = createHash('sha256').update(value).digest('hex');
  return value.toString('utf8');
}

async function method(path, signature) {
  const text = await source(path);
  const start = text.indexOf(signature);
  if (start < 0 || text.indexOf(signature, start + 1) >= 0) {
    throw new Error(`Expected one source method ${signature} in ${path}`);
  }
  const brace = text.indexOf('{', start);
  let depth = 1;
  let end = brace + 1;
  while (depth > 0 && end < text.length) {
    if (text[end] === '{') depth += 1;
    if (text[end] === '}') depth -= 1;
    end += 1;
  }
  if (brace < 0 || depth !== 0) throw new Error(`Unbalanced source method ${signature}`);
  return text.slice(start, end);
}

await mkdir(output, { recursive: true });
for (const name of await readdir(templates)) {
  let value = await readFile(join(templates, name), 'utf8');
  for (const [token, path, signature] of [
    ['__NATIVE_INVALIDATE__', nativeKotlin, 'fun invalidate()'],
    ['__NATIVE_GUARD__', nativeKotlin, 'private inline fun <T> ifNotInvalidated('],
    ['__NATIVE_KOTLIN_PERFORM__', nativeKotlin, 'fun performOperations()'],
    ['__NATIVE_KOTLIN_NON_LAYOUT__', nativeKotlin, 'fun performNonLayoutOperations()'],
    ['__NATIVE_KOTLIN_QUERY__', nativeKotlin, 'fun isAnyHandlerWaitingForEvent('],
    ['__NATIVE_RENDER__', nativeKotlin, 'fun requestRender('],
    ['__NATIVE_PERFORM__', nativeCpp, 'void NativeProxy::performOperations()'],
    ['__NATIVE_NON_LAYOUT__', nativeCpp, 'void NativeProxy::performNonLayoutOperations()'],
    ['__NATIVE_QUERY__', nativeCpp, 'bool NativeProxy::isAnyHandlerWaitingForEvent('],
    ['__NATIVE_INVALIDATE_CPP__', nativeCpp, 'void NativeProxy::invalidateCpp()'],
    ['__MODULE_EXECUTE_LAYOUT__', moduleCpp, 'void ReanimatedModuleProxy::executeLayoutAnimationsRequests()'],
  ]) {
    if (value.includes(token)) value = value.replace(token, await method(path, signature));
  }
  if (/__[A-Z_]+__/.test(value)) throw new Error(`Unresolved source placeholder in ${name}`);
  await writeFile(join(output, name), value);
}
await writeFile(join(output, 'FixtureVariant.kt'), `object FixtureVariant { const val baseline = ${variant === 'baseline'} }\n`);

let fixtureNodesSha256;
for (const [name, path] of [
  ['NodesManager.kt', `${reanimated}/android/src/main/java/com/swmansion/reanimated/NodesManager.kt`],
  ['AnimationFrameQueue.kt', 'node_modules/react-native-worklets/android/src/main/java/com/swmansion/worklets/runloop/AnimationFrameQueue.kt'],
  ['ReactChoreographer.kt', `${react}/modules/core/ReactChoreographer.kt`],
  ['ChoreographerProvider.kt', `${react}/internal/ChoreographerProvider.kt`],
]) {
  let value = await source(path);
  if (name === 'NodesManager.kt') {
    if (variant === 'baseline') {
      const patch = await readFile(join(repo, 'patches/expo-native', nodesEntry.patch), 'utf8');
      const reversed = patch.split('\n').map((line, index, lines) => {
        if (index === 0) return `--- ${lines[1].slice(4)}`;
        if (index === 1) return `+++ ${lines[0].slice(4)}`;
        if (line.startsWith('@@ ')) return line.replace(/^@@ -(\d+(?:,\d+)?) \+(\d+(?:,\d+)?) @@/, '@@ -$2 +$1 @@');
        if (line.startsWith('+')) return `-${line.slice(1)}`;
        if (line.startsWith('-')) return `+${line.slice(1)}`;
        return line;
      }).join('\n');
      value = compatibility.applyUnifiedPatch(value, reversed);
    }
    fixtureNodesSha256 = createHash('sha256').update(value).digest('hex');
    if (fixtureNodesSha256 !== nodesEntry[variant === 'baseline' ? 'before' : 'after']) {
      throw new Error(`Unexpected ${variant} NodesManager source hash`);
    }
  }
  await writeFile(join(output, name), value);
}

await writeFile(join(output, 'source-hashes.json'), `${JSON.stringify({ variant, sources, fixtureNodesSha256 }, null, 2)}\n`);
console.log(`Prepared ${variant} Reanimated/Worklets/React Native lifecycle sources in ${output}`);
