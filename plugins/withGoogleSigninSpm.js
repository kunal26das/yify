const crypto = require('node:crypto');
const {withXcodeProject} = require('@expo/config-plugins');

const REPOSITORY_URL = 'https://github.com/google/GoogleSignIn-iOS.git';
const PACKAGE_COMMENT = 'XCRemoteSwiftPackageReference "GoogleSignIn-iOS"';
const PRODUCT_NAME = 'GoogleSignIn';
const WRAPPER_VERSION = '16.1.5';
const SDK_VERSION = '10.1.0';

function fail(message) {
    throw new Error(`withGoogleSigninSpm: ${message}`);
}

function checkVersionPolicy() {
    const policy = require('../scripts/firebase-compatibility.json');
    const wrapper = require('../node_modules/@react-native-google-signin/google-signin/package.json');
    if (policy.googleSignInWrapper !== WRAPPER_VERSION ||
        policy.googleSignInAppleSdk !== SDK_VERSION ||
        wrapper.version !== WRAPPER_VERSION ||
        wrapper.GoogleSignInPodVersion !== SDK_VERSION) {
        fail(`expected reviewed wrapper ${WRAPPER_VERSION} and Apple SDK ${SDK_VERSION}`);
    }
}

function entries(section) {
    return Object.entries(section ?? {}).filter(([key]) => !key.endsWith('_comment'));
}

function refIds(values) {
    return (values ?? []).map((value) => value.value ?? value);
}

function unquote(value) {
    return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value;
}

function one(values, description) {
    if (values.length !== 1) fail(`expected one ${description}, found ${values.length}`);
    return values[0];
}

function newUuid(objects) {
    let uuid;
    do {
        uuid = crypto.randomBytes(12).toString('hex').toUpperCase();
    } while (Object.values(objects).some((section) => section && Object.hasOwn(section, uuid)));
    return uuid;
}

function linkGoogleSignInSpm(project) {
    checkVersionPolicy();
    const source = project.hash?.project;
    if (!source?.objects || !source.rootObject) fail('invalid Xcode project');
    const data = structuredClone(source);
    const objects = data.objects;
    const root = objects.PBXProject?.[data.rootObject];
    if (root?.isa !== 'PBXProject') fail('missing root PBXProject');

    const [targetId, target] = one(
        entries(objects.PBXNativeTarget).filter(([, value]) =>
            unquote(value.productType) === 'com.apple.product-type.application'),
        'application target'
    );
    const [phaseId, phase] = one(
        refIds(target.buildPhases).map((id) => [id, objects.PBXFrameworksBuildPhase?.[id]])
            .filter(([, value]) => value?.isa === 'PBXFrameworksBuildPhase'),
        `Frameworks build phase for ${target.name ?? targetId}`
    );

    const packages = entries(objects.XCRemoteSwiftPackageReference);
    const googlePackages = packages.filter(([, value]) =>
        unquote(value.repositoryURL) === REPOSITORY_URL);
    if (googlePackages.length > 1) fail('duplicate GoogleSignIn package references');
    if (googlePackages.length === 1) {
        const [id, value] = googlePackages[0];
        if (value.requirement?.kind !== 'exactVersion' ||
            unquote(value.requirement.version) !== SDK_VERSION) {
            fail('conflicting GoogleSignIn package requirement');
        }
        if (refIds(root.packageReferences).filter((reference) => reference === id).length !== 1) {
            fail('GoogleSignIn package reference is missing or duplicated on the project');
        }
    }

    const products = entries(objects.XCSwiftPackageProductDependency)
        .filter(([, value]) => unquote(value.productName) === PRODUCT_NAME);
    if (products.length > 1) fail('duplicate GoogleSignIn product dependencies');
    if (products.length === 1 &&
        (!googlePackages.length || products[0][1].package !== googlePackages[0][0])) {
        fail('GoogleSignIn product belongs to a foreign package');
    }

    const targetProducts = refIds(target.packageProductDependencies);
    const googleTargetProducts = targetProducts.filter((id) =>
        unquote(objects.XCSwiftPackageProductDependency?.[id]?.productName) === PRODUCT_NAME);
    if (googleTargetProducts.length > 1) fail('duplicate GoogleSignIn product on application target');
    if (products.length && googleTargetProducts.length && googleTargetProducts[0] !== products[0][0]) {
        fail('conflicting GoogleSignIn product on application target');
    }

    const productId = products[0]?.[0];
    const buildFiles = entries(objects.PBXBuildFile).filter(([, value]) =>
        value.productRef === productId && productId);
    const phaseFiles = refIds(phase.files);
    if (new Set(phaseFiles).size !== phaseFiles.length) {
        fail(`Frameworks phase ${phaseId} has a duplicate build file reference`);
    }
    const linkedFiles = buildFiles.filter(([id]) => phaseFiles.includes(id));
    if (buildFiles.length > 1) fail('duplicate GoogleSignIn build files');
    if (linkedFiles.length === 0 && buildFiles.length === 1 &&
        entries(objects.PBXFrameworksBuildPhase).some(([id, value]) =>
            id !== phaseId && refIds(value.files).includes(buildFiles[0][0]))) {
        fail('GoogleSignIn build file belongs to another Frameworks phase');
    }
    for (const id of phaseFiles) {
        const buildFile = objects.PBXBuildFile?.[id];
        if (!buildFile) fail(`Frameworks phase ${phaseId} has a missing build file`);
        if (buildFile.productRef && !objects.XCSwiftPackageProductDependency?.[buildFile.productRef]) {
            fail(`Frameworks phase ${phaseId} has a dangling package product reference`);
        }
    }
    for (const id of targetProducts) {
        if (!objects.XCSwiftPackageProductDependency?.[id]) fail('application target has a missing package product');
    }
    let packageId = googlePackages[0]?.[0];
    if (!packageId) {
        packageId = newUuid(objects);
        objects.XCRemoteSwiftPackageReference ??= {};
        objects.XCRemoteSwiftPackageReference[packageId] = {
            isa: 'XCRemoteSwiftPackageReference',
            repositoryURL: `"${REPOSITORY_URL}"`,
            requirement: {kind: 'exactVersion', version: SDK_VERSION},
        };
        objects.XCRemoteSwiftPackageReference[`${packageId}_comment`] = PACKAGE_COMMENT;
        root.packageReferences ??= [];
        root.packageReferences.push({value: packageId, comment: PACKAGE_COMMENT});
    }

    let currentProductId = productId;
    if (!currentProductId) {
        currentProductId = newUuid(objects);
        objects.XCSwiftPackageProductDependency ??= {};
        objects.XCSwiftPackageProductDependency[currentProductId] = {
            isa: 'XCSwiftPackageProductDependency',
            package: packageId,
            package_comment: PACKAGE_COMMENT,
            productName: PRODUCT_NAME,
        };
        objects.XCSwiftPackageProductDependency[`${currentProductId}_comment`] = PRODUCT_NAME;
    }
    if (!googleTargetProducts.length) {
        target.packageProductDependencies ??= [];
        target.packageProductDependencies.push({value: currentProductId, comment: PRODUCT_NAME});
    }
    if (!linkedFiles.length) {
        const buildFileId = buildFiles[0]?.[0] ?? newUuid(objects);
        if (!buildFiles.length) {
            objects.PBXBuildFile ??= {};
            objects.PBXBuildFile[buildFileId] = {
                isa: 'PBXBuildFile',
                productRef: currentProductId,
                productRef_comment: PRODUCT_NAME,
            };
            objects.PBXBuildFile[`${buildFileId}_comment`] = `${PRODUCT_NAME} in Frameworks`;
        }
        phase.files ??= [];
        phase.files.push({value: buildFileId, comment: `${PRODUCT_NAME} in Frameworks`});
    }
    project.hash.project = data;
    return project;
}

function withGoogleSigninSpm(config) {
    return withXcodeProject(config, (result) => {
        result.modResults = linkGoogleSignInSpm(result.modResults);
        return result;
    });
}

module.exports = withGoogleSigninSpm;
module.exports.linkGoogleSignInSpm = linkGoogleSignInSpm;
