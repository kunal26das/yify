import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(directory, 'maven-artifacts.json'), 'utf8'));
const options = {modes: [], unsafe: new Set(), deadlock: new Set(), main: 'MainKt', timeout: 25000};
const args = process.argv.slice(2);
while (args.length) {
  const flag = args.shift();
  const value = args.shift();
  if (!value) throw new Error(`Missing value for ${flag}`);
  if (flag === '--mode') options.modes.push(value);
  else if (flag === '--expect-unsafe') options.unsafe.add(value);
  else if (flag === '--expect-deadlock') options.deadlock.add(value);
  else if (flag === '--sources') options.sources = path.resolve(value);
  else if (flag === '--output') options.output = path.resolve(value);
  else if (flag === '--cache') options.cache = path.resolve(value);
  else if (flag === '--main') options.main = value;
  else throw new Error(`Unknown option ${flag}`);
}
if (!options.sources || !options.output) throw new Error('Usage: node run.mjs --sources SOURCE_DIR --output OUTPUT_DIR [--cache CACHE_DIR] [--mode CASE] [--expect-unsafe CASE] [--expect-deadlock CASE]');
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('This JNI fixture supports macOS and Linux');
if (options.sources === options.output) throw new Error('Sources and build output must be separate directories');
const cache = options.cache ?? path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache'), 'yify', 'kotlin-fixture', manifest.compilerVersion);
await Promise.all([mkdir(cache, {recursive: true}), mkdir(options.output, {recursive: true})]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = {platform: process.platform, arch: process.arch, compilerVersion: manifest.compilerVersion, artifacts: [], sources: {}, results: []};
const command = (executable, argv, timeout = 120000, env = process.env) => {
  const result = spawnSync(executable, argv, {encoding: 'utf8', timeout, env, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  return {status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout ?? '', stderr: result.stderr ?? ''};
};
const requireSuccess = (result, label) => {
  if (result.status !== 0 || result.error) throw new Error(`${label} failed: ${result.error ?? ''}\n${result.stdout}${result.stderr}`);
  return result;
};
async function artifact(entry) {
  const filename = `${entry.artifact}-${entry.version}.jar`;
  const target = path.join(cache, filename);
  try {
    if (digest(await readFile(target)) === entry.sha256) {
      receipt.artifacts.push({...entry, cacheHit: true});
      return target;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const url = `${manifest.repository}/${entry.group.replaceAll('.', '/')}/${entry.artifact}/${entry.version}/${filename}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const partial = `${target}.${process.pid}.part`;
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(120000), redirect: 'follow'});
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${filename}`);
      if (new URL(response.url).protocol !== 'https:') throw new Error(`Insecure artifact redirect for ${filename}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (digest(bytes) !== entry.sha256) throw new Error(`Checksum mismatch for ${filename}`);
      await writeFile(partial, bytes, {flag: 'wx'});
      await rename(partial, target);
      receipt.artifacts.push({...entry, cacheHit: false});
      return target;
    } catch (error) {
      lastError = error;
    } finally {
      await rm(partial, {force: true});
    }
  }
  throw lastError;
}
async function files(root) {
  const entries = await readdir(root, {withFileTypes: true});
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]));
  return nested.flat().sort();
}
try {
  let javaHome = process.env.JAVA_HOME ?? process.env.JAVA_HOME_17_X64 ?? process.env.JAVA_HOME_17_ARM64;
  if (!javaHome && process.platform === 'darwin') javaHome = requireSuccess(command('/usr/libexec/java_home', ['-v', '17']), 'Locate JDK 17').stdout.trim();
  if (!javaHome) {
    const properties = requireSuccess(command('java', ['-XshowSettings:properties', '-version']), 'Locate Java');
    javaHome = /java\.home\s*=\s*(.+)/.exec(properties.stderr)?.[1]?.trim();
  }
  if (!javaHome) throw new Error('Set JAVA_HOME to a Java 17 JDK');
  const java = path.join(javaHome, 'bin', 'java');
  const javaVersion = requireSuccess(command(java, ['-version']), 'Java version').stderr;
  if (!/version "17[.\"]/.test(javaVersion)) throw new Error(`Java 17 is required; received ${javaVersion.trim()}`);
  receipt.java = javaVersion.trim();
  const compiler = process.env.CXX ?? 'clang++';
  receipt.nativeCompiler = requireSuccess(command(compiler, ['--version']), 'C++ compiler').stdout.trim();
  const jars = [];
  for (const entry of manifest.artifacts) jars.push(await artifact(entry));
  const stdlib = jars[manifest.artifacts.findIndex(entry => entry.artifact === 'kotlin-stdlib')];
  const annotations = jars[manifest.artifacts.findIndex(entry => entry.artifact === 'annotations')];
  const sourceFiles = await files(options.sources);
  for (const file of sourceFiles) receipt.sources[path.relative(options.sources, file)] = digest(await readFile(file));
  const kotlin = sourceFiles.filter(file => file.endsWith('.kt'));
  if (!kotlin.length) throw new Error('No Kotlin sources found');
  const classes = path.join(options.output, 'classes');
  await rm(classes, {recursive: true, force: true});
  await mkdir(classes);
  const compiled = command(java, ['-cp', jars.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', [stdlib, annotations].join(path.delimiter), '-d', classes, ...kotlin]);
  await writeFile(path.join(options.output, 'compile.log'), compiled.stdout + compiled.stderr);
  requireSuccess(compiled, 'Kotlin compilation');
  const library = path.join(options.output, process.platform === 'darwin' ? 'libprobe.dylib' : 'libprobe.so');
  const nativeArgs = ['-std=c++20', '-g', '-O1', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-fPIC', '-shared'];
  if (process.platform === 'linux') nativeArgs.push('-shared-libsan');
  nativeArgs.push(`-I${path.join(javaHome, 'include')}`, `-I${path.join(javaHome, 'include', process.platform)}`, path.join(options.sources, 'probe.cpp'), '-o', library);
  const native = command(compiler, nativeArgs);
  await writeFile(path.join(options.output, 'native-compile.log'), native.stdout + native.stderr);
  requireSuccess(native, 'JNI compilation');
  const env = {...process.env};
  if (process.platform === 'linux') {
    const runtime = requireSuccess(command(compiler, ['--print-runtime-dir']), 'Clang sanitizer runtime').stdout.trim();
    env.LD_LIBRARY_PATH = [runtime, env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter);
    receipt.sanitizerRuntime = runtime;
  }
  for (const mode of options.modes) {
    const result = command(java, [`-Dprobe.library=${library}`, '-cp', [classes, stdlib, annotations].join(path.delimiter), options.main, mode], options.timeout, env);
    await writeFile(path.join(options.output, `${mode}.log`), result.stdout + result.stderr);
    const expectedUnsafe = options.unsafe.has(mode);
    const expectedDeadlock = options.deadlock.has(mode);
    const matched = !result.error && (expectedUnsafe
      ? result.status !== 0 && /member call on null pointer/.test(result.stderr)
      : result.status === 0 && (/DEADLOCK/.test(result.stdout) === expectedDeadlock));
    const row = {mode, expectedUnsafe, expectedDeadlock, matched, ...result};
    receipt.results.push(row);
    console.log(`${matched ? 'PASS' : 'FAIL'} ${mode}: ${result.stdout.trim()}`);
    if (!matched) {
      if (result.error) console.error(result.error);
      if (result.stderr) console.error(result.stderr.trim());
    }
  }
  receipt.passed = receipt.results.every(result => result.matched);
  if (!receipt.passed) process.exitCode = 1;
} catch (error) {
  receipt.passed = false;
  receipt.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(options.output, 'toolchain-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}
