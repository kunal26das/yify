import {useCallback, useSyncExternalStore} from 'react';
import {DEFAULT_PRIVACY_CHOICES} from '@/domain';
import {usePrivacyPreferences} from '../di/DependenciesContext';

export function usePrivacyChoices() {
    const privacy = usePrivacyPreferences();
    return useSyncExternalStore(
        useCallback(listener => privacy.subscribe(listener), [privacy]),
        useCallback(() => privacy.getChoices(), [privacy]),
        () => DEFAULT_PRIVACY_CHOICES,
    );
}
