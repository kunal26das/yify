const assert = require('node:assert/strict');
const {mkdtemp, readFile, rm, writeFile} = require('node:fs/promises');
const {createRequire} = require('node:module');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {test} = require('node:test');
const xcode = require('xcode');

test('Xcode resolves the pinned UUID and preserves generated group references through project round trips', async t => {
    const xcodeRequire = createRequire(require.resolve('xcode/package.json'));
    assert.equal(xcodeRequire('uuid/package.json').version, require('../package.json').resolutions['**/xcode/uuid']);
    const directory = await mkdtemp(path.join(tmpdir(), 'yify-xcode-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const filename = path.join(directory, 'project.pbxproj');
    const rootGroup = 'AAAAAAAAAAAAAAAAAAAAAAAA';
    const rootProject = 'BBBBBBBBBBBBBBBBBBBBBBBB';
    const fixture = xcode.project(filename);
    fixture.hash = {project: {
        archiveVersion: 1,
        classes: {},
        objectVersion: 56,
        objects: {
            PBXGroup: {[rootGroup]: {isa: 'PBXGroup', children: [], sourceTree: '"<group>"'}},
            PBXProject: {[rootProject]: {isa: 'PBXProject', mainGroup: rootGroup, targets: []}},
        },
        rootObject: rootProject,
    }};
    await writeFile(filename, fixture.writeSync());
    const project = xcode.project(filename);
    await new Promise((resolve, reject) => project.parse(error => error ? reject(error) : resolve()));
    const ids = new Set(project.allUuids());
    const groups = Array.from({length: 32}, (_, index) => {
        const name = `Group${index}`;
        const group = project.addPbxGroup([], name, name);
        assert.match(group.uuid, /^[A-F0-9]{24}$/);
        assert.equal(ids.has(group.uuid), false);
        ids.add(group.uuid);
        project.addToPbxGroup(group.uuid, rootGroup);
        return {uuid: group.uuid, name};
    });
    await writeFile(filename, project.writeSync());
    const restored = xcode.project(filename).parseSync();
    assert.equal(restored.hash.project.rootObject, rootProject);
    assert.equal(restored.getFirstProject().firstProject.mainGroup, rootGroup);
    assert.deepEqual(restored.hash.project.objects.PBXGroup[rootGroup].children.map(child => child.value), groups.map(group => group.uuid));
    for (const group of groups) {
        assert.equal(restored.hash.project.objects.PBXGroup[group.uuid].name, group.name);
        assert.equal(restored.hash.project.objects.PBXGroup[group.uuid].path, group.name);
    }
    assert.equal(restored.writeSync(), await readFile(filename, 'utf8'));
});
