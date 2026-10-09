import assert from 'node:assert/strict';
export function verifyComponents(xml) {
    assert(!/android:sharedUserId|E: (?:provider|service|receiver|activity-alias|uses-permission)\b/.test(xml), 'Unexpected permission, shared UID or external component');
    const application = xml.split(/E: application\b/);
    assert.equal(application.length, 2, 'Missing or ambiguous Application');
    const names = [...application[1].split(/\n\s+E:/)[0].matchAll(/android:name[^\n]*="([^"]+)"/g)];
    assert.equal(names.length, 1, 'Missing or ambiguous Application name');
    assert.equal(names[0][1], 'io.github.kunal26das.hsdpregression.ProbeApplication', 'Unexpected Application identity gate');
    const expected = new Map([
        ['io.github.kunal26das.hsdpregression.DriverActivity', true],
        ['io.github.kunal26das.hsdpregression.CallbackProbeActivity', false],
        ['com.google.android.play.core.hsdp.service.HsdpShimActivity', false],
    ]);
    const lines = xml.split('\n');
    const seen = new Set();
    for (let index = 0; index < lines.length; index++) {
        const element = lines[index].match(/^(\s*)E: activity\b/);
        if (!element) continue;
        let end = index + 1;
        while (end < lines.length && (lines[end].trim() === '' || lines[end].search(/\S/) > element[1].length)) end++;
        const body = lines.slice(index + 1, end).filter(line => !/E:/.test(line)).join('\n');
        const names = [...body.matchAll(/android:name[^\n]*="([^"]+)"/g)];
        assert.equal(names.length, 1, 'Missing or ambiguous Activity name');
        const name = names[0][1];
        assert(expected.has(name) && !seen.has(name), 'Unexpected or duplicate Activity');
        assert.equal(body.split('\n').filter(line => /android:exported/.test(line)).length, 1, 'Missing or ambiguous Activity exported attribute');
        const exported = body.match(/android:exported[^\n]*=(?:\(type 0x12\))?(0x[0-9a-f]+)/i)?.[1];
        assert(exported === (expected.get(name) ? '0xffffffff' : '0x0'), 'Unexpected Activity export boundary');
        seen.add(name);
    }
    assert.equal(seen.size, expected.size, 'Missing required Activity');
}
