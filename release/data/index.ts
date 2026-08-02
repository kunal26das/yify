import type {
    AndroidPublisher,
    BinaryInspector,
    EasApi,
    Installer,
    ReleaseCli,
    ReleaseLedger,
    RuntimeVersions,
    SessionStore,
    UrlOpener,
    Workspace,
} from '../domain/index.js';
import {createWorkspace} from './config/workspaceFs.js';
import {createSessionStore} from './session/sessionStoreFs.js';
import {createEasApi} from './api/easApiCli.js';
import {type CancellationRegistry, createCancellation,} from './process/cancellationRegistry.js';
import {createReleaseCli} from './cli/easCliProcess.js';
import {createInstaller} from './install/installerShell.js';
import {createBinaryInspector} from './version/binaryInspectorAppInfo.js';
import {createRuntimeVersions} from './version/runtimeVersionsCli.js';
import {createReleaseLedger} from './ledger/releaseLedgerFs.js';
import {createUrlOpener} from './system/urlOpenerOs.js';
import {createAndroidPublisher} from './android/androidPublisherShell.js';

export interface DataLayer {
    workspace: Workspace;
    sessionStore: SessionStore;
    api: EasApi;
    cancellation: CancellationRegistry;
    cli: ReleaseCli;
    installer: Installer;
    binary: BinaryInspector;
    runtimeVersions: RuntimeVersions;
    ledger: ReleaseLedger;
    urlOpener: UrlOpener;
    androidPublisher: AndroidPublisher;
}

export function createDataLayer(): DataLayer {
    const workspace = createWorkspace();
    const sessionStore = createSessionStore();
    const api = createEasApi({sessionStore, workspace});
    const cancellation = createCancellation();
    const cli = createReleaseCli({workspace, sessionStore, cancellation});
    const installer = createInstaller({workspace, cancellation});
    const binary = createBinaryInspector({workspace});
    const runtimeVersions = createRuntimeVersions({workspace});
    const ledger = createReleaseLedger({workspace});
    const urlOpener = createUrlOpener();
    const androidPublisher = createAndroidPublisher({workspace, cancellation});

    return {
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
    };
}
