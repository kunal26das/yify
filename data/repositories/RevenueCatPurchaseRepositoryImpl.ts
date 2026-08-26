import {Platform} from 'react-native';
import Purchases, {
    LOG_LEVEL,
    PRODUCT_CATEGORY,
    type CustomerInfo,
    type PurchasesPackage,
} from 'react-native-purchases';

import {
    INITIAL_PURCHASE_STATE,
    REMOVE_ADS_ENTITLEMENT,
    type Account,
    type AnalyticsSink,
    type KeyValueStore,
    type PurchaseFailure,
    type PurchaseOffer,
    type PurchaseRepository,
    type PurchaseState,
} from '@/domain';
import {getAnalyticsInstanceId} from '../datasources/analytics/FirebaseAnalyticsSink';
import {createObservable} from './support/observable';

const apiKey =
    Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

const ADS_REMOVED_KEY = 'ads_removed';

function hasRemoveAds(info: CustomerInfo): boolean {
    return info.entitlements.active[REMOVE_ADS_ENTITLEMENT] !== undefined;
}

function purchaseFailureReason(error: unknown): PurchaseFailure {
    const {userCancelled, code} = (error ?? {}) as {userCancelled?: boolean | null; code?: string};
    if (userCancelled) return 'cancelled';
    switch (code) {
        case Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
            return 'cancelled';
        case Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
            return 'already_purchased';
        case Purchases.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
            return 'pending';
        default:
            return 'unknown';
    }
}

function toOffer(pkg: PurchasesPackage): PurchaseOffer {
    return {
        id: pkg.identifier,
        title: pkg.product.title,
        priceLabel: pkg.product.priceString,
        recurring: pkg.product.productCategory === PRODUCT_CATEGORY.SUBSCRIPTION,
    };
}

export class RevenueCatPurchaseRepositoryImpl implements PurchaseRepository {
    private readonly store = createObservable<PurchaseState>(INITIAL_PURCHASE_STATE);
    private readonly packages = new Map<string, PurchasesPackage>();
    private readonly analytics: AnalyticsSink;
    private readonly cache: KeyValueStore;

    private initialized = false;
    private configured = false;
    private pendingAccount: Account | null | undefined;
    private reportedAdsRemoved: boolean | undefined;
    private verified = false;

    constructor(analytics: AnalyticsSink, cache: KeyValueStore) {
        this.analytics = analytics;
        this.cache = cache;
        this.store.set({
            available: Boolean(apiKey),
            adsRemoved: cache.getString(ADS_REMOVED_KEY) === 'true',
        });
    }

    getState(): PurchaseState {
        return this.store.get();
    }

    subscribe(listener: () => void): () => void {
        return this.store.subscribe(listener);
    }

    async init(): Promise<void> {
        if (this.initialized || !apiKey) return;
        this.initialized = true;
        try {
            Purchases.setLogLevel(LOG_LEVEL.WARN);
            await Purchases.configure({apiKey});
            await this.linkFirebaseAnalytics();
            Purchases.addCustomerInfoUpdateListener((info) => {
                this.verified = true;
                this.setState({adsRemoved: hasRemoveAds(info)});
            });
            const info = await Purchases.getCustomerInfo();
            this.configured = true;
            this.verified = true;
            this.setState({ready: true, adsRemoved: hasRemoveAds(info)});
            await this.loadOfferings();
            if (this.pendingAccount !== undefined) {
                const account = this.pendingAccount;
                this.pendingAccount = undefined;
                await this.identify(account);
            }
        } catch {
            this.initialized = false;
        }
    }

    async purchase(offerId: string): Promise<boolean> {
        const pkg = this.packages.get(offerId);
        if (pkg == null) {
            this.setState({failure: 'offer_unavailable'});
            this.analytics.trackEvent('remove_ads_purchase_failed', {
                package_id: offerId,
                reason: 'offer_unavailable',
            });
            return false;
        }
        this.setState({purchasing: offerId, failure: null});
        this.analytics.trackEvent('remove_ads_purchase_start', {package_id: offerId});
        try {
            const {customerInfo} = await Purchases.purchasePackage(pkg);
            const purchased = hasRemoveAds(customerInfo);
            this.verified = true;
            this.setState({
                adsRemoved: purchased,
                purchasing: null,
                failure: purchased ? null : 'not_granted',
            });
            this.analytics.trackEvent('remove_ads_purchase_done', {
                package_id: offerId,
                granted: purchased,
            });
            return purchased;
        } catch (error) {
            const reason = purchaseFailureReason(error);
            this.setState({purchasing: null, failure: reason});
            this.analytics.trackEvent('remove_ads_purchase_failed', {
                package_id: offerId,
                reason,
            });
            return false;
        }
    }

    async restore(): Promise<boolean> {
        try {
            const info = await Purchases.restorePurchases();
            const restored = hasRemoveAds(info);
            this.verified = true;
            this.setState({adsRemoved: restored, failure: null});
            this.analytics.trackEvent('remove_ads_restore', {
                result: restored ? 'restored' : 'none',
            });
            return restored;
        } catch {
            this.setState({failure: 'restore_failed'});
            this.analytics.trackEvent('remove_ads_restore', {result: 'error'});
            return false;
        }
    }

    async identify(account: Account | null): Promise<void> {
        if (!apiKey) return;
        if (!this.configured) {
            this.pendingAccount = account;
            void this.init();
            return;
        }
        try {
            const info = account
                ? (await Purchases.logIn(account.uid)).customerInfo
                : await Purchases.logOut();
            this.verified = true;
            this.setState({adsRemoved: hasRemoveAds(info)});
            await this.linkFirebaseAnalytics();
            if (account) {
                await Purchases.setEmail(account.email);
                await Purchases.setDisplayName(account.name);
                if (!hasRemoveAds(info)) await this.restore();
            }
            await this.loadOfferings();
        } catch {
        }
    }

    private setState(next: Partial<PurchaseState>): void {
        this.store.set(next);
        const state = this.store.get();
        if (state.ready && this.reportedAdsRemoved !== state.adsRemoved) {
            this.reportedAdsRemoved = state.adsRemoved;
            if (this.verified) this.cache.set(ADS_REMOVED_KEY, state.adsRemoved ? 'true' : 'false');
            this.analytics.setUserProperty('remove_ads', state.adsRemoved ? 'true' : 'false');
        }
    }

    private async loadOfferings(): Promise<void> {
        try {
            const offerings = await Purchases.getOfferings();
            const available = offerings.current?.availablePackages ?? [];
            this.packages.clear();
            available.forEach((pkg) => this.packages.set(pkg.identifier, pkg));
            this.setState({offers: available.map(toOffer)});
        } catch {
        }
    }

    private async linkFirebaseAnalytics(): Promise<void> {
        try {
            const instanceId = await getAnalyticsInstanceId();
            if (instanceId) await Purchases.setFirebaseAppInstanceID(instanceId);
        } catch {
        }
    }
}
