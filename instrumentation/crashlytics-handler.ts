import {createCrashlyticsError} from './crashlytics-error';

type ErrorHandler = (error: unknown, isFatal?: boolean) => unknown;

interface ErrorUtilsLike {
    getGlobalHandler(): ErrorHandler;
    setGlobalHandler(handler: ErrorHandler): void;
}

interface CrashlyticsClient {
    readonly isCrashlyticsCollectionEnabled: boolean;
}

export interface ExceptionsManagerLike {
    handleException(error: unknown, isFatal: boolean): unknown;
}

export function installCrashlyticsHandler<T extends CrashlyticsClient>(
    errorUtils: ErrorUtilsLike,
    createCrashlytics: () => T,
    recordNonFatal: (client: T, error: Error) => void,
    exceptionsManager?: ExceptionsManagerLike,
): void {
    const originalHandler = errorUtils.getGlobalHandler();
    let forwardingToOriginal = 0;
    const forwardToOriginal: ErrorHandler = (error, isFatal) => {
        forwardingToOriginal += 1;
        try {
            return originalHandler(error, isFatal);
        } finally {
            forwardingToOriginal -= 1;
        }
    };
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
        if (!client.isCrashlyticsCollectionEnabled) return forwardToOriginal(error, isFatal);
        if (isFatal !== true) {
            try {
                recordNonFatal(client, createCrashlyticsError(error));
            } catch {}
            return forwardToOriginal(error, isFatal);
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
        return forwardToOriginal(error, true);
    });

    if (exceptionsManager) {
        const handleException = exceptionsManager.handleException.bind(exceptionsManager);
        exceptionsManager.handleException = (error, isFatal) => {
            if (isFatal !== true || forwardingToOriginal > 0) return handleException(error, isFatal);
            try {
                return Promise.resolve(errorUtils.getGlobalHandler()(error, true))
                    .catch(() => handleException(error, true));
            } catch {
                return handleException(error, true);
            }
        };
    }
}
