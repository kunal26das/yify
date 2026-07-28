import {useSyncExternalStore} from 'react';
import {getPurchasesState, subscribePurchases, type PurchasesState} from '@/lib/purchases';

const SERVER_SNAPSHOT: PurchasesState = {ready: false, adsRemoved: false, packages: []};

export function usePurchases(): PurchasesState {
    return useSyncExternalStore(subscribePurchases, getPurchasesState, () => SERVER_SNAPSHOT);
}

export function useAdsRemoved(): boolean {
    return usePurchases().adsRemoved;
}
