import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [aar, androidJar, asmJar, asmTreeJar] = process.argv.slice(2).map(value => path.resolve(value));
if (!aar || !androidJar || !asmJar || !asmTreeJar) throw new Error('Usage: node scripts/check-ump-metrics.mjs UMP_4_AAR ANDROID_JAR ASM_9_9_JAR ASM_TREE_9_9_JAR (requires Java 17+)');
const hash = createHash('sha256').update(readFileSync(aar)).digest('hex');
if (hash !== '429889c7108caf88207d5d078e8fa7655a0ec6aca718399f27455bebe5978621') throw new Error('The regression must use the exact official UMP 4.0.0 AAR');
const temporary = mkdtempSync(path.join(tmpdir(), 'yify-ump-regression-'));
const java = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name) : name;
const run = (command, args) => execFileSync(command, args, {stdio: 'inherit'});
const javaSources = directory => readdirSync(directory, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? javaSources(path.join(directory, entry.name)) : entry.name.endsWith('.java') ? [path.join(directory, entry.name)] : []);
try {
    const jar = path.join(temporary, 'ump.jar');
    writeFileSync(jar, execFileSync('unzip', ['-p', aar, 'classes.jar'], {maxBuffer: 16 * 1024 * 1024}));
    const sdkClass = 'com/google/android/gms/internal/consent_sdk/zzcr.class';
    const original = path.join(temporary, 'original.class');
    writeFileSync(original, execFileSync('unzip', ['-p', jar, sdkClass]));
    const classes = path.join(temporary, 'classes');
    const transformed = path.join(temporary, 'transformed');
    const output = path.join(transformed, sdkClass);
    mkdirSync(classes, {recursive: true});
    mkdirSync(path.dirname(output), {recursive: true});
    const dependencies = [asmJar, asmTreeJar, jar, androidJar];
    const classpath = [classes, ...dependencies].join(path.delimiter);
    run(java('javac'), ['--release', '17', '-cp', dependencies.join(path.delimiter), '-d', classes, path.join(root, 'plugins/ump/UmpMetricsVisitor.java'), ...javaSources(path.join(root, 'tests/fixtures/ump'))]);
    run(java('java'), ['-Xverify:all', '-cp', classpath, 'Transform', original, output]);
    run(java('java'), ['-Xverify:all', '-cp', classpath, 'UmpMetricsRepro', 'false']);
    run(java('java'), ['-Xverify:all', '-cp', [transformed, classpath].join(path.delimiter), 'UmpMetricsRepro', 'true']);
    console.log('Passed: 26 real-SDK response/failure cases and five incompatible-bytecode guards. No network requests were made.');
} finally {
    rmSync(temporary, {recursive: true, force: true});
}
