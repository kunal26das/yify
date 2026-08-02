import {useSyncExternalStore} from 'react';
import {INITIAL_PURCHASE_STATE, type PurchaseState} from '@/domain';
import {usePurchaseRepository} from '../di/DependenciesContext';

export function usePurchases(): PurchaseState {
    const purchases = usePurchaseRepository();
    return useSyncExternalStore(
        (listener) => purchases.subscribe(listener),
        () => purchases.getState(),
        () => INITIAL_PURCHASE_STATE
    );
}

export function useAdsRemoved(): boolean {
    return usePurchases().adsRemoved;
}
