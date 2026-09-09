import {getCrashlytics, recordError, setAttributes} from '@react-native-firebase/crashlytics';
import * as Updates from 'expo-updates';
import {installCrashlyticsHandler} from './crashlytics-handler';

if (!__DEV__) {
    installCrashlyticsHandler(ErrorUtils, () => {
        const client = getCrashlytics();
        try {
            void setAttributes(client, {
                react_native_runtime: Updates.runtimeVersion || 'unknown',
                expo_update_id: Updates.updateId || 'embedded',
                expo_update_channel: Updates.channel || 'unknown',
            }).catch(() => {});
        } catch {}
        return client;
    }, recordError);
}
