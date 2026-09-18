import {useEffect, useSyncExternalStore} from 'react';
import {INITIAL_AVAILABILITY_ALERT_STATE} from '@/domain/services/AvailabilityAlerts';
import {useAvailabilityAlerts} from '../di/DependenciesContext';
import {useAuth} from './use-auth';
import {usePurchases} from './use-purchases';
import {usePreferences} from './use-preferences';
import {useDeviceRegion} from '../movies/components/watchRegion';
import {Analytics} from '../analytics/events';

export function useAvailabilityAlertSettings() {
    const service = useAvailabilityAlerts();
    const session = useAuth();
    const purchase = usePurchases();
    const preferences = usePreferences();
    const automatic = useDeviceRegion();
    const country = preferences.watchRegion ?? automatic;
    const state = useSyncExternalStore(listener => service?.subscribe(listener) ?? (() => {}),
        () => service?.getState() ?? INITIAL_AVAILABILITY_ALERT_STATE,
        () => INITIAL_AVAILABILITY_ALERT_STATE);
    useEffect(() => {
        if (session.ready) void service?.refresh(country);
    }, [country, service, session.ready, session.account?.uid, purchase.adsRemoved, purchase.expiresAt]);
    const toggle = async (enabled: boolean) => {
        const changed = enabled ? await service?.enable(country) : await service?.disable();
        if (changed) Analytics.subscriptionFunnel({step: 'availability_alert_changed', enabled}, country);
    };
    return {...state, toggle, retry: () => service?.refresh(country),
        hasServices: (preferences.streamingServices[country]?.length ?? 0) > 0};
}
