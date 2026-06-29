import os from 'node:os';
import {createDataLayer} from '../data/index.js';
import {
    createAuthUseCases,
    createBaseReleaseUseCases,
    createCodePushUseCases,
    createOperationGuard,
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
    urlOpener,
    androidPublisher,
} = data;

const operation = createOperationGuard(cancellation);

const auth = createAuthUseCases({api, cli, sessionStore});
const base = createBaseReleaseUseCases({
    api,
    installer,
    cli,
    cancellation,
    operation,
    workspace,
    binary,
    androidPublisher,
});
const codepush = createCodePushUseCases({
    api,
    installer,
    cli,
    cancellation,
    operation,
    workspace,
});

export const REPO_ROOT = workspace.repoRoot;
export const APPS = workspace.apps;
export const DEPLOYMENTS = workspace.deployments;
export const currentBranch = (root?: string) => workspace.currentBranch(root);

export const readSession = () => sessionStore.read();
export const configFilePath = () => sessionStore.configFilePath();

export const isLoggedIn = () => api.isLoggedIn();
export const getAccount = () => api.getAccount();
export const getBaseRelease = api.getBaseRelease;
export const hasBaseRelease = api.hasBaseRelease;

export const authStatus = auth.authStatus;
export const login = auth.login;
export const logout = auth.logout;
export const loginPageUrl = (hostname: string = os.hostname()) =>
    domainLoginPageUrl(hostname);

export const openUrl = urlOpener.open;

export const versionFromBinary = binary.versionFromBinary;
export const repoPackageVersion = binary.repoPackageVersion;
export const repoTargetVersion = binary.repoTargetVersion;

export const cleanInstall = installer.cleanInstall;
export const installCommand = installer.installCommand;

export const cancelActive = () => cancellation.cancelActive();

export const activeOperation = () => operation.activeOperation();

export const validateBinaries = base.validateBinaries;
export const findExistingBases = base.findExistingBases;
export const baseCoverage = base.baseCoverage;
export const runBaseRelease = base.runBaseRelease;

export const canCodePush = codepush.canCodePush;
export const runCodePush = codepush.runCodePush;
export const summarizeCodePush = codepush.summarizeCodePush;

export {
    NotLoggedInError,
    type Account,
    type AppTarget,
    type AuthStatus,
    type BaseCoverage,
    type BaseReleaseResult,
    type BaseReleaseStep,
    type BinaryValidation,
    type CodePushResult,
    type CodePushStep,
    type CodePushSummary,
    type Deployment,
    type Job,
    type LogLine,
    type OperationType,
    type Platform,
    type RunBaseReleaseOptions,
    type RunOptions,
    type RunResult,
    type Session,
} from '../domain/index.js';
