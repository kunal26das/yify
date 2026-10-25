const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const xcode = require('xcode');
const {linkGoogleSignInSpm} = require('../plugins/withGoogleSigninSpm');

const sourcePath = path.join(path.dirname(require.resolve('../package.json')), 'ios', 'Yify.xcodeproj', 'project.pbxproj');

function values(section) {
    return Object.entries(section ?? {}).filter(([id]) => !id.endsWith('_comment'));
}

function idOf(value) {
    return value.value ?? value;
}

function appParts(project) {
    const objects = project.hash.project.objects;
    const [appId, app] = values(objects.PBXNativeTarget).find(([, value]) =>
        value.productType === '"com.apple.product-type.application"');
    const phaseId = app.buildPhases.map(idOf).find((id) => objects.PBXFrameworksBuildPhase?.[id]);
    return {objects, appId, app, phase: objects.PBXFrameworksBuildPhase[phaseId]};
}

function freshProject() {
    const project = xcode.project(sourcePath).parseSync();
    const {objects, app, phase} = appParts(project);
    const packageIds = new Set(values(objects.XCRemoteSwiftPackageReference)
        .filter(([, value]) => value.repositoryURL?.includes('GoogleSignIn-iOS.git'))
        .map(([id]) => id));
    const productIds = new Set(values(objects.XCSwiftPackageProductDependency)
        .filter(([, value]) => value.productName === 'GoogleSignIn')
        .map(([id]) => id));
    const buildFileIds = new Set(values(objects.PBXBuildFile)
        .filter(([, value]) => productIds.has(value.productRef))
        .map(([id]) => id));
    for (const id of packageIds) {
        delete objects.XCRemoteSwiftPackageReference[id];
        delete objects.XCRemoteSwiftPackageReference[`${id}_comment`];
    }
    for (const id of productIds) {
        delete objects.XCSwiftPackageProductDependency[id];
        delete objects.XCSwiftPackageProductDependency[`${id}_comment`];
    }
    for (const id of buildFileIds) {
        delete objects.PBXBuildFile[id];
        delete objects.PBXBuildFile[`${id}_comment`];
    }
    const root = objects.PBXProject[project.hash.project.rootObject];
    root.packageReferences = root.packageReferences?.filter((item) => !packageIds.has(idOf(item)));
    app.packageProductDependencies = app.packageProductDependencies?.filter((item) => !productIds.has(idOf(item)));
    phase.files = phase.files.filter((item) => !buildFileIds.has(idOf(item)));
    return project;
}

function roundTrip(project) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yify-google-spm-'));
    const file = path.join(directory, 'project.pbxproj');
    try {
        fs.writeFileSync(file, project.writeSync());
        return xcode.project(file).parseSync();
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }
}

function googleGraph(project) {
    const {objects, app, phase} = appParts(project);
    const packages = values(objects.XCRemoteSwiftPackageReference)
        .filter(([, value]) => value.repositoryURL?.includes('GoogleSignIn-iOS.git'));
    const products = values(objects.XCSwiftPackageProductDependency)
        .filter(([, value]) => value.productName === 'GoogleSignIn');
    const files = values(objects.PBXBuildFile)
        .filter(([, value]) => products.some(([id]) => value.productRef === id));
    return {objects, app, phase, packages, products, files};
}

test('adds one exact GoogleSignIn package product and application Frameworks link', () => {
    const project = roundTrip(linkGoogleSignInSpm(freshProject()));
    const {objects, app, phase, packages, products, files} = googleGraph(project);
    assert.equal(packages.length, 1);
    assert.equal(packages[0][1].requirement.kind, 'exactVersion');
    assert.equal(packages[0][1].requirement.version, '10.1.0');
    assert.equal(products.length, 1);
    assert.equal(products[0][1].package, packages[0][0]);
    assert.equal(files.length, 1);
    assert.equal(files[0][1].productRef, products[0][0]);
    assert.equal(app.packageProductDependencies.filter((item) => idOf(item) === products[0][0]).length, 1);
    assert.equal(phase.files.filter((item) => idOf(item) === files[0][0]).length, 1);
    assert.equal(objects.PBXProject[project.hash.project.rootObject].packageReferences
        .filter((item) => idOf(item) === packages[0][0]).length, 1);
});

test('reuses the same linked graph on repeated parse and write', () => {
    const first = roundTrip(linkGoogleSignInSpm(freshProject()));
    const initial = first.writeSync();
    const second = roundTrip(linkGoogleSignInSpm(first));
    assert.equal(second.writeSync(), initial);
    assert.equal(googleGraph(second).files.length, 1);
});

test('repairs a declared product whose Frameworks link is missing', () => {
    const project = linkGoogleSignInSpm(freshProject());
    const {objects, phase, files} = googleGraph(project);
    phase.files = phase.files.filter((item) => idOf(item) !== files[0][0]);
    delete objects.PBXBuildFile[files[0][0]];
    delete objects.PBXBuildFile[`${files[0][0]}_comment`];
    const repaired = googleGraph(roundTrip(linkGoogleSignInSpm(project)));
    assert.equal(repaired.packages.length, 1);
    assert.equal(repaired.products.length, 1);
    assert.equal(repaired.files.length, 1);
    assert.equal(repaired.phase.files.filter((item) => idOf(item) === repaired.files[0][0]).length, 1);
});

test('rejects conflicting SDK versions and foreign products without mutation', () => {
    const wrongVersion = linkGoogleSignInSpm(freshProject());
    googleGraph(wrongVersion).packages[0][1].requirement.version = '9.2.0';
    const beforeVersion = wrongVersion.writeSync();
    assert.throws(() => linkGoogleSignInSpm(wrongVersion), /conflicting GoogleSignIn package requirement/);
    assert.equal(wrongVersion.writeSync(), beforeVersion);

    const foreign = linkGoogleSignInSpm(freshProject());
    googleGraph(foreign).products[0][1].package = 'FFFFFFFFFFFFFFFFFFFFFFFF';
    const beforeForeign = foreign.writeSync();
    assert.throws(() => linkGoogleSignInSpm(foreign), /foreign package/);
    assert.equal(foreign.writeSync(), beforeForeign);
});

test('rejects an ambiguous application target and duplicate product', () => {
    const ambiguous = freshProject();
    const {objects, app} = appParts(ambiguous);
    objects.PBXNativeTarget.AAAAAAAAAAAAAAAAAAAAAAAA = {...app, name: 'OtherApp'};
    assert.throws(() => linkGoogleSignInSpm(ambiguous), /expected one application target/);

    const duplicate = linkGoogleSignInSpm(freshProject());
    const graph = googleGraph(duplicate);
    graph.objects.XCSwiftPackageProductDependency.BBBBBBBBBBBBBBBBBBBBBBBB = {
        ...graph.products[0][1],
    };
    assert.throws(() => linkGoogleSignInSpm(duplicate), /duplicate GoogleSignIn product dependencies/);
});

test('preserves an unrelated Swift package product and framework link', () => {
    const project = freshProject();
    const {objects, app, phase} = appParts(project);
    const packageId = 'CCCCCCCCCCCCCCCCCCCCCCCC';
    const productId = 'DDDDDDDDDDDDDDDDDDDDDDDD';
    const buildFileId = 'EEEEEEEEEEEEEEEEEEEEEEEE';
    objects.XCRemoteSwiftPackageReference ??= {};
    objects.XCRemoteSwiftPackageReference[packageId] = {
        isa: 'XCRemoteSwiftPackageReference',
        repositoryURL: '"https://github.com/firebase/firebase-ios-sdk.git"',
        requirement: {kind: 'exactVersion', version: '13.0.0'},
    };
    objects.XCSwiftPackageProductDependency ??= {};
    objects.XCSwiftPackageProductDependency[productId] = {
        isa: 'XCSwiftPackageProductDependency', package: packageId, productName: 'FirebaseCore',
    };
    objects.PBXBuildFile[buildFileId] = {
        isa: 'PBXBuildFile', productRef: productId,
    };
    objects.PBXProject[project.hash.project.rootObject].packageReferences ??= [];
    objects.PBXProject[project.hash.project.rootObject].packageReferences.push({value: packageId});
    app.packageProductDependencies ??= [];
    app.packageProductDependencies.push({value: productId});
    phase.files.push({value: buildFileId});

    const linked = roundTrip(linkGoogleSignInSpm(project));
    const linkedParts = appParts(linked);
    assert.equal(linkedParts.objects.XCRemoteSwiftPackageReference[packageId].requirement.version, '13.0.0');
    assert.equal(linkedParts.objects.XCSwiftPackageProductDependency[productId].productName, 'FirebaseCore');
    assert.ok(linkedParts.app.packageProductDependencies.some((item) => idOf(item) === productId));
    assert.ok(linkedParts.phase.files.some((item) => idOf(item) === buildFileId));
});

test('rejects unreviewed wrapper metadata without mutating the project', () => {
    const project = freshProject();
    const original = project.writeSync();
    const moduleId = require.resolve('../node_modules/@react-native-google-signin/google-signin/package.json');
    const moduleRecord = require.cache[moduleId];
    const originalMetadata = moduleRecord.exports;
    try {
        moduleRecord.exports = {...originalMetadata, GoogleSignInPodVersion: '11.0.0'};
        assert.throws(() => linkGoogleSignInSpm(project), /expected reviewed wrapper/);
        assert.equal(project.writeSync(), original);
    } finally {
        moduleRecord.exports = originalMetadata;
    }
});

test('rejects a repeated Frameworks build file ID without mutating the parsed project', () => {
    const project = roundTrip(linkGoogleSignInSpm(freshProject()));
    const {phase, files} = googleGraph(project);
    phase.files.push({value: files[0][0], comment: 'GoogleSignIn in Frameworks'});
    const parsed = roundTrip(project);
    const original = parsed.writeSync();
    assert.throws(() => linkGoogleSignInSpm(parsed), /duplicate build file reference/);
    assert.equal(parsed.writeSync(), original);
});

test('rejects a dangling Swift package product in Frameworks without mutating the parsed project', () => {
    const project = linkGoogleSignInSpm(freshProject());
    const {objects, phase} = appParts(project);
    const fileId = 'FFFFFFFFFFFFFFFFFFFFFFFF';
    objects.PBXBuildFile[fileId] = {
        isa: 'PBXBuildFile', productRef: 'EEEEEEEEEEEEEEEEEEEEEEEE',
    };
    phase.files.push({value: fileId, comment: 'Dangling in Frameworks'});
    const parsed = roundTrip(project);
    const original = parsed.writeSync();
    assert.throws(() => linkGoogleSignInSpm(parsed), /dangling package product reference/);
    assert.equal(parsed.writeSync(), original);
});
