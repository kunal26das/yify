import {createDataLayer} from '../data/index.js';
import {
    createAuthUseCases,
    createOperationGuard,
    createStoreReleaseUseCases,
    createUpdateUseCases,
    loginPageUrl as domainLoginPageUrl,
} from '../domain/index.js';

const data = createDataLayer();
const {
    workspace,
    sessionStore,
    api,
    cancellation,
    cli,
    installer,
    binary,
    runtimeVersions,
    ledger,
    urlOpener,
    androidPublisher,
} = data;

const operation = createOperationGuard(cancellation);

const auth = createAuthUseCases({api, sessionStore});
const store = createStoreReleaseUseCases({
    ledger,
    runtimeVersions,
    installer,
    cancellation,
    operation,
    workspace,
    binary,
    androidPublisher,
});
const updates = createUpdateUseCases({
    ledger,
    runtimeVersions,
    installer,
    cli,
    cancellation,
    operation,
    workspace,
});

export const REPO_ROOT = workspace.repoRoot;
export const APPS = workspace.apps;
export const CHANNELS = workspace.channels;
export const currentBranch = (root?: string) => workspace.currentBranch(root);

export const readSession = () => sessionStore.read();
export const configFilePath = () => sessionStore.configFilePath();

export const isLoggedIn = () => api.isLoggedIn();
export const getAccount = () => api.getAccount();

export const authStatus = auth.authStatus;
export const login = auth.login;
export const logout = auth.logout;
export const loginPageUrl = () => domainLoginPageUrl();

export const openUrl = urlOpener.open;

export const versionFromBinary = binary.versionFromBinary;
export const repoPackageVersion = binary.repoPackageVersion;
export const repoTargetVersion = binary.repoTargetVersion;

export const resolveRuntimeVersion = runtimeVersions.resolve;
export const listReleases = ledger.list;
export const ledgerFilePath = ledger.filePath;

export const cleanInstall = installer.cleanInstall;
export const installCommand = installer.installCommand;

export const cancelActive = () => cancellation.cancelActive();

export const activeOperation = () => operation.activeOperation();

export const validateBinaries = store.validateBinaries;
export const findExistingReleases = store.findExistingReleases;
export const releaseCoverage = store.releaseCoverage;
export const runStoreRelease = store.runStoreRelease;

export const canPublishUpdate = updates.canPublish;
export const runUpdate = updates.runUpdate;
export const summarizeUpdate = updates.summarizeUpdate;

export {
    NotLoggedInError,
    type Account,
    type AppTarget,
    type AuthStatus,
    type BinaryValidation,
    type Channel,
    type Job,
    type LogLine,
    type OperationType,
    type Platform,
    type ReleaseCoverage,
    type ReleaseRecord,
    type RunOptions,
    type RunResult,
    type RunStoreReleaseOptions,
    type Session,
    type StoreReleaseResult,
    type StoreReleaseStep,
    type UpdateResult,
    type UpdateStep,
    type UpdateSummary,
} from '../domain/index.js';
