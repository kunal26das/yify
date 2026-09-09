import {createCrashlyticsError} from './crashlytics-error';

type ErrorHandler = (error: unknown, isFatal?: boolean) => unknown;

interface ErrorUtilsLike {
    getGlobalHandler(): ErrorHandler;
    setGlobalHandler(handler: ErrorHandler): void;
}

interface CrashlyticsClient {
    readonly isCrashlyticsCollectionEnabled: boolean;
}

export function installCrashlyticsHandler<T extends CrashlyticsClient>(
    errorUtils: ErrorUtilsLike,
    createCrashlytics: () => T,
    recordNonFatal: (client: T, error: Error) => void,
): void {
    const originalHandler = errorUtils.getGlobalHandler();
    let client: T;
    try {
        client = createCrashlytics();
    } catch {
        errorUtils.setGlobalHandler(originalHandler);
        return;
    }
    const firebaseHandler = errorUtils.getGlobalHandler();
    let handlingFatal = false;

    errorUtils.setGlobalHandler(async (error, isFatal) => {
        if (!client.isCrashlyticsCollectionEnabled) return originalHandler(error, isFatal);
        if (isFatal !== true) {
            try {
                recordNonFatal(client, createCrashlyticsError(error));
            } catch {}
            return originalHandler(error, isFatal);
        }
        if (handlingFatal) return;
        handlingFatal = true;
        try {
            if (firebaseHandler !== originalHandler) {
                await firebaseHandler(createCrashlyticsError(error), true);
            }
        } catch {}
        finally {
            handlingFatal = false;
        }
        return originalHandler(error, true);
    });
}
