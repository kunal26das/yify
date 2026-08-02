import {Platform} from 'react-native';
import * as InAppUpdates from 'expo-in-app-updates';
import * as StoreReview from 'expo-store-review';
import {getCrashlytics, log} from '@react-native-firebase/crashlytics';

function breadcrumb(message: string): void {
    try {
        log(getCrashlytics(), message);
    } catch {
    }
}

export async function startPlayServices(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
        const {updateAvailable, updateInProgress, storeVersion, immediateAllowed} =
            await InAppUpdates.checkForUpdate();

        if (updateAvailable || updateInProgress) {
            breadcrumb(`in_app_update available store=${storeVersion} inProgress=${!!updateInProgress}`);
            const started = await InAppUpdates.startUpdate(immediateAllowed !== false);
            breadcrumb(`in_app_update started=${started}`);
            return;
        }

        breadcrumb('in_app_update none');
        if (await StoreReview.hasAction()) {
            await StoreReview.requestReview();
        }
    } catch (error) {
        breadcrumb(`in_app_update failed ${error instanceof Error ? error.message : String(error)}`);
    }
}
