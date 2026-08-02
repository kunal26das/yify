import {Platform} from 'react-native';
import Purchases, {
    LOG_LEVEL,
    type CustomerInfo,
    type PurchasesPackage,
} from 'react-native-purchases';

export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';

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

const apiKey =
    Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let state: PurchasesState = {ready: false, adsRemoved: false, packages: []};
const listeners = new Set<() => void>();
let initialized = false;
let configured = false;
let pendingUser: AccountUser | null | undefined;

function setState(next: Partial<PurchasesState>) {
    state = {...state, ...next};
    listeners.forEach((listener) => listener());
}

function hasRemoveAds(info: CustomerInfo): boolean {
    return info.entitlements.active[REMOVE_ADS_ENTITLEMENT] !== undefined;
}

async function loadOfferings(): Promise<void> {
    try {
        const offerings = await Purchases.getOfferings();
        setState({packages: offerings.current?.availablePackages ?? []});
    } catch {
    }
}

export async function initPurchases(): Promise<void> {
    if (initialized || !apiKey) return;
    initialized = true;
    try {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        await Purchases.configure({apiKey});
        Purchases.addCustomerInfoUpdateListener((info) => {
            setState({adsRemoved: hasRemoveAds(info)});
        });
        configured = true;
        const info = await Purchases.getCustomerInfo();
        setState({ready: true, adsRemoved: hasRemoveAds(info)});
        await loadOfferings();
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
        const {customerInfo} = await Purchases.purchasePackage(pkg);
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
        const info = user
            ? (await Purchases.logIn(user.uid)).customerInfo
            : await Purchases.logOut();
        setState({adsRemoved: hasRemoveAds(info)});
        if (user) {
            await Purchases.setEmail(user.email);
            await Purchases.setDisplayName(user.name);
        }
        await loadOfferings();
    } catch {
    }
}

export async function restorePurchases(): Promise<boolean> {
    try {
        const info = await Purchases.restorePurchases();
        const restored = hasRemoveAds(info);
        setState({adsRemoved: restored});
        return restored;
    } catch {
        return false;
    }
}
