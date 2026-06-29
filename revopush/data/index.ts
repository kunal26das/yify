import type {
    AndroidPublisher,
    BinaryInspector,
    Installer,
    ManagementApi,
    ReleaseCli,
    SessionStore,
    UrlOpener,
    Workspace,
} from '../domain/index.js';
import {createWorkspace} from './config/workspaceFs.js';
import {createSessionStore} from './session/sessionStoreFs.js';
import {createManagementApi} from './api/managementApiHttp.js';
import {type CancellationRegistry, createCancellation,} from './process/cancellationRegistry.js';
import {createReleaseCli} from './cli/releaseCliProcess.js';
import {createInstaller} from './install/installerShell.js';
import {createBinaryInspector} from './version/binaryInspectorAppInfo.js';
import {createUrlOpener} from './system/urlOpenerOs.js';
import {createAndroidPublisher} from './android/androidPublisherShell.js';

export interface DataLayer {
    workspace: Workspace;
    sessionStore: SessionStore;
    api: ManagementApi;
    cancellation: CancellationRegistry;
    cli: ReleaseCli;
    installer: Installer;
    binary: BinaryInspector;
    urlOpener: UrlOpener;
    androidPublisher: AndroidPublisher;
}

export function createDataLayer(): DataLayer {
    const workspace = createWorkspace();
    const sessionStore = createSessionStore();
    const api = createManagementApi({sessionStore, workspace});
    const cancellation = createCancellation();
    const cli = createReleaseCli({workspace, cancellation});
    const installer = createInstaller({workspace, cancellation});
    const binary = createBinaryInspector({workspace});
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
        urlOpener,
        androidPublisher,
    };
}
