import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';

function command(bin, args, cwd) {
    const result = spawnSync(bin, args, {cwd, encoding: 'utf8'});
    assert.equal(result.status, 0, `${bin} failed`);
    return result.stdout;
}

test('signed AAB verifier rejects tampering, unsigned extras and wrong signers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'yify-aab-signature-test-'));
    try {
        mkdirSync(join(directory, 'content'));
        writeFileSync(join(directory, 'content', 'payload.txt'), 'original');
        writeFileSync(join(directory, 'content', 'extra.txt'), 'unsigned');
        mkdirSync(join(directory, 'changed'));
        writeFileSync(join(directory, 'changed', 'payload.txt'), 'tampered');
        for (const alias of ['expected', 'different']) {
            command('keytool', ['-genkeypair', '-keystore', `${directory}/${alias}.jks`, '-alias', alias,
                '-keyalg', 'RSA', '-keysize', '2048', '-validity', '1', '-dname', 'CN=Ephemeral test',
                '-storepass', 'test-password', '-keypass', 'test-password', '-noprompt']);
        }
        const makeSigned = (name, alias) => {
            const path = join(directory, name);
            command('zip', ['-j', path, join(directory, 'content', 'payload.txt')]);
            command('java', ['sun.security.tools.jarsigner.Main', '-keystore', `${directory}/${alias}.jks`,
                '-storepass', 'test-password', '-keypass', 'test-password', path, alias]);
            return path;
        };
        const authentic = makeSigned('authentic.jar', 'expected');
        const certificate = command('keytool', ['-printcert', '-jarfile', authentic]);
        const expected = certificate.match(/SHA256:\s*((?:[0-9A-F]{2}:){31}[0-9A-F]{2})/i)?.[1].replaceAll(':', '');
        assert.match(expected, /^[0-9A-F]{64}$/i);
        const verify = path => spawnSync('java', ['scripts/VerifySignedAab.java', path, expected], {encoding: 'utf8'});
        assert.equal(verify(authentic).status, 0);

        const altered = join(directory, 'altered.jar');
        copyFileSync(authentic, altered);
        command('zip', ['-j', altered, join(directory, 'changed', 'payload.txt')]);
        assert.notEqual(verify(altered).status, 0);

        const unsigned = join(directory, 'unsigned.jar');
        copyFileSync(authentic, unsigned);
        command('zip', ['-j', unsigned, join(directory, 'content', 'extra.txt')]);
        assert.notEqual(verify(unsigned).status, 0);

        const different = makeSigned('different.jar', 'different');
        assert.notEqual(verify(different).status, 0);
    } finally {
        rmSync(directory, {recursive: true, force: true});
    }
});
