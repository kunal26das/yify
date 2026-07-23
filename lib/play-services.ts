import {Platform} from 'react-native';
import * as InAppUpdates from 'expo-in-app-updates';
import * as StoreReview from 'expo-store-review';

export async function startPlayServices(): Promise<void> {
    if (Platform.OS === 'android') try {
        const {updateAvailable, updateInProgress} = await InAppUpdates.checkForUpdate();
        if (updateAvailable || updateInProgress) {
            await InAppUpdates.startUpdate(false);
            return;
        }
        if (await StoreReview.hasAction()) {
            await StoreReview.requestReview();
        }
    } catch {
    }
}
