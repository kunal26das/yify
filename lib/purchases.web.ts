import {Purchases, type Package} from '@revenuecat/purchases-js';

import {createKeyValueStore} from './storage/create-key-value-store';
import type {KeyValueStore} from './storage/key-value-store';

export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

export type PurchasesPackage = Package;

export interface AccountUser {
    uid: string;
    email: string | null;
    name: string | null;
}

export type PurchasesState = {
    ready: boolean;
    adsRemoved: boolean;
    packages: PurchasesPackage[];
};

const STORE_ID = 'purchases';
const APP_USER_ID_KEY = 'app_user_id';

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;

let state: PurchasesState = {ready: false, adsRemoved: false, packages: []};
const listeners = new Set<() => void>();
let initialized = false;
let configured = false;
let pendingUser: AccountUser | null | undefined;
let store: KeyValueStore | null = null;

function getStore(): KeyValueStore {
    if (!store) store = createKeyValueStore(STORE_ID);
    return store;
}

function getAppUserId(): string {
    const existing = getStore().getString(APP_USER_ID_KEY);
    if (existing) return existing;
    const generated = Purchases.generateRevenueCatAnonymousAppUserId();
    getStore().set(APP_USER_ID_KEY, generated);
    return generated;
}

function setState(next: Partial<PurchasesState>) {
    state = {...state, ...next};
    listeners.forEach((listener) => listener());
}

function hasRemoveAds(info: {entitlements: {active: Record<string, unknown>}}): boolean {
    return info.entitlements.active[REMOVE_ADS_ENTITLEMENT] !== undefined;
}

export async function initPurchases(): Promise<void> {
    if (initialized || !apiKey || typeof window === 'undefined') return;
    initialized = true;
    try {
        const purchases = Purchases.configure({apiKey, appUserId: getAppUserId()});
        configured = true;
        const info = await purchases.getCustomerInfo();
        setState({ready: true, adsRemoved: hasRemoveAds(info)});
        const offerings = await purchases.getOfferings();
        setState({packages: offerings.current?.availablePackages ?? []});
        if (pendingUser !== undefined) {
            const user = pendingUser;
            pendingUser = undefined;
            await identifyPurchasesUser(user);
        }
    } catch {
        setState({ready: true});
    }
}

export function subscribePurchases(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getPurchasesState(): PurchasesState {
    return state;
}

export async function purchaseRemoveAds(pkg: PurchasesPackage): Promise<boolean> {
    try {
        const {customerInfo} = await Purchases.getSharedInstance().purchase({rcPackage: pkg});
        const purchased = hasRemoveAds(customerInfo);
        setState({adsRemoved: purchased});
        return purchased;
    } catch {
        return false;
    }
}

export async function identifyPurchasesUser(user: AccountUser | null): Promise<void> {
    if (!apiKey) return;
    if (!configured) {
        pendingUser = user;
        return;
    }
    try {
        const purchases = Purchases.getSharedInstance();
        const info = await purchases.changeUser(user ? user.uid : getAppUserId());
        setState({adsRemoved: hasRemoveAds(info)});
        const offerings = await purchases.getOfferings();
        setState({packages: offerings.current?.availablePackages ?? []});
    } catch {
    }
}

export async function restorePurchases(): Promise<boolean> {
    try {
        const info = await Purchases.getSharedInstance().getCustomerInfo();
        const restored = hasRemoveAds(info);
        setState({adsRemoved: restored});
        return restored;
    } catch {
        return false;
    }
}
