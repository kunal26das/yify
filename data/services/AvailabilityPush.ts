import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import type {AvailabilityPush} from '@/domain';

function projectId(): string | undefined {
    const value = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    return typeof value === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value) ? value : undefined;
}

function granted(permission: Notifications.NotificationPermissionsStatus): boolean {
    return permission.granted || permission.status === 'granted'
        || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
        || permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL;
}

export class AvailabilityPushImpl implements AvailabilityPush {
    private pending: Promise<unknown> = Promise.resolve();
    private revocationPending = false;

    async supported(): Promise<boolean> {
        return ['android', 'ios'].includes(Platform.OS) && Constants.executionEnvironment !== 'storeClient' && !!projectId();
    }

    private sequence<T>(action: () => Promise<T>): Promise<T> {
        const result = this.pending.catch(() => {}).then(action);
        this.pending = result;
        return result;
    }

    private async revoke(): Promise<void> {
        this.revocationPending = true;
        let failure = false;
        try { await Notifications.setAutoServerRegistrationEnabledAsync(false); } catch { failure = true; }
        try { await Notifications.unregisterForNotificationsAsync(); } catch { failure = true; }
        if (failure) throw new Error('Availability notifications could not be disabled.');
        this.revocationPending = false;
    }

    register(): Promise<{kind: 'expo'; token: string}> {
        return this.sequence(async () => {
            if (!await this.supported()) throw new Error('Availability notifications are not supported on this device.');
            if (this.revocationPending) await this.revoke();
            let permission: Notifications.NotificationPermissionsStatus;
            try {
                if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('availability-alerts', {
                    name: 'Streaming availability', importance: Notifications.AndroidImportance.DEFAULT,
                    sound: null, enableVibrate: false,
                });
                permission = await Notifications.getPermissionsAsync();
                if (!granted(permission) && permission.canAskAgain) {
                    permission = await Notifications.requestPermissionsAsync({ios: {allowAlert: true, allowBadge: false, allowSound: false}});
                }
            } catch { throw new Error('Notification permission could not be checked.'); }
            if (!granted(permission)) throw new Error('Allow notifications in your device settings to receive availability alerts.');
            try {
                const result = await Notifications.getExpoPushTokenAsync({projectId: projectId()!});
                if (!/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z\d_-]{1,200}\]$/.test(result.data)) throw new Error();
                await Notifications.setAutoServerRegistrationEnabledAsync(true);
                return {kind: 'expo', token: result.data};
            } catch {
                await this.revoke().catch(() => {});
                throw new Error('Availability notifications could not be registered.');
            }
        });
    }

    unregister(): Promise<void> {
        return this.sequence(async () => {
            if (['android', 'ios'].includes(Platform.OS)) await this.revoke();
        });
    }
}
