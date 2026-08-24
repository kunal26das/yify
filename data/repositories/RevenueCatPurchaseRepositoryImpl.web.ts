import {ErrorCode, Purchases, PurchasesError, type Package} from '@revenuecat/purchases-js';

import {
    INITIAL_PURCHASE_STATE,
    REMOVE_ADS_ENTITLEMENT,
    type Account,
    type AnalyticsSink,
    type KeyValueStore,
    type PurchaseOffer,
    type PurchaseRepository,
    type PurchaseState,
} from '@/domain';
import {createObservable} from './support/observable';

const APP_USER_ID_KEY = 'app_user_id';

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;

const ADS_REMOVED_KEY = 'ads_removed';
const LIFETIME_PACKAGE = '$rc_lifetime';

function hasRemoveAds(info: {entitlements: {active: Record<string, unknown>}}): boolean {
    return info.entitlements.active[REMOVE_ADS_ENTITLEMENT] !== undefined;
}

function purchaseFailureReason(error: unknown): string {
    if (!(error instanceof PurchasesError)) return 'unknown';
    return error.errorCode === ErrorCode.UserCancelledError ? 'cancelled' : String(error.errorCode);
}

function toOffer(pkg: Package): PurchaseOffer {
    return {
        id: pkg.identifier,
        title: pkg.webBillingProduct.title,
        priceLabel: pkg.webBillingProduct.currentPrice.formattedPrice,
    };
}

export class RevenueCatPurchaseRepositoryImpl implements PurchaseRepository {
    private readonly store = createObservable<PurchaseState>(INITIAL_PURCHASE_STATE);
    private readonly packages = new Map<string, Package>();
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
        if (this.initialized || !apiKey || typeof window === 'undefined') return;
        this.initialized = true;
        try {
            const purchases = Purchases.configure({apiKey, appUserId: this.getAppUserId()});
            this.configured = true;
            const info = await purchases.getCustomerInfo();
            this.verified = true;
            this.setState({ready: true, adsRemoved: hasRemoveAds(info)});
            await this.loadOfferings();
            if (this.pendingAccount !== undefined) {
                const account = this.pendingAccount;
                this.pendingAccount = undefined;
                await this.identify(account);
            }
        } catch {
            this.setState({ready: true});
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
            const {customerInfo} = await Purchases.getSharedInstance().purchase({rcPackage: pkg});
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
            const info = await Purchases.getSharedInstance().getCustomerInfo();
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
            return;
        }
        try {
            const purchases = Purchases.getSharedInstance();
            const info = await purchases.changeUser(
                account ? account.uid : this.getAppUserId()
            );
            this.verified = true;
            this.setState({adsRemoved: hasRemoveAds(info)});
            await this.loadOfferings();
        } catch {
        }
    }

    private getAppUserId(): string {
        const existing = this.cache.getString(APP_USER_ID_KEY);
        if (existing) return existing;
        const generated = Purchases.generateRevenueCatAnonymousAppUserId();
        this.cache.set(APP_USER_ID_KEY, generated);
        return generated;
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
            const offerings = await Purchases.getSharedInstance().getOfferings();
            const all = offerings.current?.availablePackages ?? [];
            const available = [...all].sort(
                (left, right) =>
                    Number(right.identifier === LIFETIME_PACKAGE) -
                    Number(left.identifier === LIFETIME_PACKAGE)
            );
            this.packages.clear();
            available.forEach((pkg) => this.packages.set(pkg.identifier, pkg));
            this.setState({offers: available.map(toOffer)});
        } catch {
        }
    }
}
