import {
    ErrorCode,
    ProductType,
    Purchases,
    PurchasesError,
    type CustomerInfo,
    type Offering,
    type Package,
} from '@revenuecat/purchases-js';

import {
    INITIAL_PURCHASE_STATE,
    REMOVE_ADS_ENTITLEMENT,
    type Account,
    type AnalyticsSink,
    type Diagnostics,
    type KeyValueStore,
    type PurchaseFailure,
    type PurchaseOffer,
    type PurchasePlacement,
    type PurchaseRepository,
    type PurchaseState,
} from '@/domain';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {createObservable} from './support/observable';

const APP_USER_ID_KEY = 'app_user_id';
const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY;
const SETTINGS_PLACEMENT: PurchasePlacement = 'settings_supporter';

function purchaseFailureReason(error: unknown): PurchaseFailure {
    if (!(error instanceof PurchasesError)) return 'unknown';
    switch (error.errorCode) {
        case ErrorCode.UserCancelledError:
            return 'cancelled';
        case ErrorCode.ProductAlreadyPurchasedError:
            return 'already_purchased';
        case ErrorCode.PaymentPendingError:
            return 'pending';
        default:
            return 'unknown';
    }
}

function diagnosticCode(error: unknown): string {
    try {
        if (!(error instanceof PurchasesError)) return 'unknown';
        switch (error.errorCode) {
            case ErrorCode.NetworkError: return 'network';
            case ErrorCode.StoreProblemError: return 'store_problem';
            case ErrorCode.ConfigurationError: return 'configuration';
            case ErrorCode.ProductNotAvailableForPurchaseError: return 'product_unavailable';
            case ErrorCode.PurchaseNotAllowedError: return 'purchase_not_allowed';
            case ErrorCode.InvalidCredentialsError: return 'invalid_credentials';
            case ErrorCode.UnexpectedBackendResponseError: return 'backend_response';
            default: return 'unknown';
        }
    } catch {
        return 'unknown';
    }
}

interface OfferedPackage {
    pkg: Package;
    offering: Offering;
    placement: PurchasePlacement;
}

interface PendingWork<T> {
    revision: number;
    promise: Promise<T>;
}

export class RevenueCatPurchaseRepositoryImpl implements PurchaseRepository {
    private readonly store = createObservable<PurchaseState>(INITIAL_PURCHASE_STATE);
    private readonly packages = new Map<string, OfferedPackage>();
    private readonly analytics: AnalyticsSink;
    private readonly cache: KeyValueStore;
    private sdk: Purchases | null = null;
    private account: Account | null | undefined;
    private anonymousId: string | undefined;
    private loginSourceId: string | undefined;
    private desiredUserId: string | undefined;
    private revision = 0;
    private queue: Promise<void> = Promise.resolve();
    private initializing: PendingWork<void> | null = null;
    private refreshing: PendingWork<void> | null = null;
    private restoring: PendingWork<boolean> | null = null;
    private checkout: (PendingWork<boolean> & {offerId: string}) | null = null;
    private reportedAdsRemoved: boolean | undefined;
    private observingForeground = false;

    constructor(analytics: AnalyticsSink, cache: KeyValueStore, private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {
        this.analytics = analytics;
        this.cache = cache;
        // The old unscoped ads_removed flag cannot establish who owns a purchase.
        this.store.set({available: Boolean(apiKey)});
    }

    getState(): PurchaseState {
        return this.store.get();
    }

    subscribe(listener: () => void): () => void {
        return this.store.subscribe(listener);
    }

    async init(): Promise<void> {
        // AccountLink supplies the initial signed-in account or confirmed sign-out.
        if (!this.canStart()) return;
        this.observeForeground();
        if (this.store.get().ready) return;
        const revision = this.revision;
        if (this.initializing?.revision === revision) return this.initializing.promise;
        const promise = this.enqueue(async () => {
            try {
                await this.synchronize(revision);
            } catch {
                // An explicit refresh, restore, or repeated init can retry without reconfiguring.
            }
        });
        const work = {revision, promise};
        this.initializing = work;
        try {
            await promise;
        } finally {
            if (this.initializing === work) this.initializing = null;
        }
    }

    async identify(account: Account | null): Promise<void> {
        if (!apiKey || typeof window === 'undefined') return;
        if (this.account !== undefined && this.account?.uid === account?.uid) return this.init();
        const previousAccount = this.account;
        this.account = account;
        if (account) {
            if (!previousAccount) {
                this.loginSourceId = this.getAnonymousId();
                // The source anonymous customer may become an alias of this account.
                // Persist the next signed-out identity before linking so reloads cannot revive it.
                this.anonymousId = Purchases.generateRevenueCatAnonymousAppUserId();
                this.cache.set(APP_USER_ID_KEY, this.anonymousId);
            }
            this.desiredUserId = account.uid;
        } else {
            this.desiredUserId = this.getAnonymousId();
            this.loginSourceId = undefined;
        }
        this.revision += 1;
        this.packages.clear();
        this.reportedAdsRemoved = undefined;
        this.setState({
            ...INITIAL_PURCHASE_STATE,
            available: true,
            adsRemoved: this.readCachedGrant(this.desiredUserId),
        });
        await this.init();
    }

    async refresh(): Promise<void> {
        if (!this.canStart()) return;
        const revision = this.revision;
        if (this.refreshing?.revision === revision) return this.refreshing.promise;
        this.setState({refreshing: true});
        const promise = this.enqueue(async () => {
            try {
                await this.synchronize(revision);
            } catch {
                // Keep the current account's last verified result during transient outages.
            } finally {
                if (this.isCurrent(revision)) this.setState({refreshing: false});
            }
        });
        const work = {revision, promise};
        this.refreshing = work;
        try {
            await promise;
        } finally {
            if (this.refreshing === work) this.refreshing = null;
        }
    }

    async getOffers(placement: PurchasePlacement): Promise<PurchaseOffer[]> {
        if (!this.canStart()) return [];
        const revision = this.revision;
        return this.enqueue(async () => {
            if (!this.isCurrent(revision)) return [];
            try {
                if (!this.store.get().ready) await this.synchronize(revision);
                if (!this.isCurrent(revision) || !this.store.get().ready) return [];
                return await this.loadOffers(placement, revision);
            } catch {
                return [];
            }
        });
    }

    trackPaywallImpression(offerId: string): void {
        const offer = this.packages.get(offerId);
        const sdk = this.sdk;
        if (!offer || !sdk || !this.store.get().ready || sdk.getAppUserId() !== this.desiredUserId) return;
        try {
            sdk.trackCustomPaywallImpression({paywallId: offer.placement, offering: offer.offering});
        } catch {
            // Analytics must never prevent the customer from using the paywall.
        }
    }

    async purchase(offerId: string): Promise<boolean> {
        const revision = this.revision;
        if (this.checkout) {
            return this.checkout.revision === revision && this.checkout.offerId === offerId
                ? this.checkout.promise : false;
        }
        if (this.restoring || !this.store.get().ready) {
            this.diagnostics.event('purchases.purchase', {outcome: this.restoring ? 'skipped' : 'unavailable'});
            return false;
        }
        const offer = this.packages.get(offerId);
        if (!offer) {
            this.setState({failure: 'offer_unavailable'});
            this.analytics.trackEvent('remove_ads_purchase_failed', {
                package_id: offerId, reason: 'offer_unavailable',
            });
            this.diagnostics.event('purchases.purchase', {outcome: 'unavailable'});
            return false;
        }
        this.setState({purchasing: offerId, failure: null});
        const promise = this.enqueue(async () => {
            const span = this.diagnostics.start('purchases.purchase', {provider: 'revenuecat'});
            if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
            if (!this.packages.has(offerId)) {
                this.setState({purchasing: null, failure: 'offer_unavailable'});
                span.finish('unavailable');
                return false;
            }
            this.analytics.trackEvent('remove_ads_purchase_start', {package_id: offerId});
            try {
                const {customerInfo} = await this.sdk!.purchase({rcPackage: offer.pkg});
                if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
                const purchased = this.applyCustomerInfo(customerInfo);
                this.setState({purchasing: null, failure: purchased ? null : 'not_granted'});
                this.analytics.trackEvent('remove_ads_purchase_done', {package_id: offerId, granted: purchased});
                span.finish(purchased ? 'ok' : 'empty');
                return purchased;
            } catch (error) {
                if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
                const reason = purchaseFailureReason(error);
                if (reason === 'unknown') span.fail(error, {error_code: diagnosticCode(error)});
                else span.finish(reason === 'cancelled' ? 'cancelled' : reason === 'pending' ? 'pending' : 'skipped', {error_code: reason});
                this.setState({purchasing: null, failure: reason});
                this.analytics.trackEvent('remove_ads_purchase_failed', {package_id: offerId, reason});
                return false;
            }
        });
        const work = {revision, offerId, promise};
        this.checkout = work;
        try {
            return await promise;
        } finally {
            if (this.checkout === work) this.checkout = null;
        }
    }

    async restore(): Promise<boolean> {
        if (!this.canStart() || this.checkout) {
            this.diagnostics.event('purchases.restore', {outcome: this.checkout ? 'skipped' : 'unavailable'});
            return false;
        }
        const revision = this.revision;
        if (this.restoring?.revision === revision) return this.restoring.promise;
        this.setState({restoring: true, failure: null});
        const promise = this.enqueue(async () => {
            const span = this.diagnostics.start('purchases.restore', {provider: 'revenuecat'});
            if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
            try {
                // Web purchases belong to the RevenueCat customer; there is no store restore API.
                const restored = await this.synchronize(revision);
                if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
                this.setState({failure: null});
                this.analytics.trackEvent('remove_ads_restore', {result: restored ? 'restored' : 'none'});
                span.finish(restored ? 'ok' : 'empty');
                return restored;
            } catch {
                if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
                span.finish('error', {stage: 'sync'});
                this.setState({failure: 'restore_failed'});
                this.analytics.trackEvent('remove_ads_restore', {result: 'error'});
                return false;
            } finally {
                if (this.isCurrent(revision)) this.setState({restoring: false});
            }
        });
        const work = {revision, promise};
        this.restoring = work;
        try {
            return await promise;
        } finally {
            if (this.restoring === work) this.restoring = null;
        }
    }

    private canStart(): boolean {
        return Boolean(apiKey) && typeof window !== 'undefined' && this.account !== undefined;
    }

    private observeForeground(): void {
        if (this.observingForeground) return;
        this.observingForeground = true;
        const refreshWhenVisible = () => {
            if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.refresh();
        };
        window.addEventListener('focus', refreshWhenVisible);
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refreshWhenVisible);
    }

    private isCurrent(revision: number): boolean {
        return revision === this.revision;
    }

    private enqueue<T>(run: () => Promise<T>): Promise<T> {
        const result = this.queue.then(run);
        this.queue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async synchronize(revision: number): Promise<boolean> {
        if (!this.isCurrent(revision)) return false;
        const span = this.diagnostics.start('purchases.sync', {provider: 'revenuecat'});
        let stage = 'configure';
        try {
            const userId = this.desiredUserId!;
            if (!this.sdk) {
                this.sdk = Purchases.configure({apiKey: apiKey!, appUserId: this.loginSourceId ?? userId});
            }
            stage = 'customer';
            let info: CustomerInfo;
            if (this.sdk.getAppUserId() === userId) {
                info = await this.sdk.getCustomerInfo();
            } else if (this.account && this.sdk.isAnonymous()) {
                info = (await this.sdk.identifyUser(userId)).customerInfo;
            } else {
                info = await this.sdk.changeUser(userId);
            }
            if (!this.isCurrent(revision)) { span.finish('skipped'); return false; }
            if (this.sdk.getAppUserId() !== userId) throw new Error('identity_mismatch');
            const granted = this.applyCustomerInfo(info);
            await this.loadOffers(SETTINGS_PLACEMENT, revision);
            span.finish('ok');
            return granted;
        } catch (error) {
            span.fail(error, {stage, error_code: diagnosticCode(error)});
            throw error;
        }
    }

    private applyCustomerInfo(info: CustomerInfo): boolean {
        const active = info.entitlements.active[REMOVE_ADS_ENTITLEMENT];
        const entitlement = active ?? info.entitlements.all?.[REMOVE_ADS_ENTITLEMENT];
        const adsRemoved = active !== undefined;
        const expiresAt = entitlement?.expirationDate?.toISOString() ?? null;
        // Persist every verified result, including a revocation after a cached true value.
        this.cache.set(this.cacheKey(this.desiredUserId!), JSON.stringify({adsRemoved, expiresAt}));
        this.setState({
            ready: true,
            adsRemoved,
            managementURL: info.managementURL ?? null,
            expiresAt,
            willRenew: entitlement?.willRenew ?? false,
            billingIssue: entitlement?.billingIssueDetectedAt != null,
        });
        return adsRemoved;
    }

    private cacheKey(userId: string): string {
        return `ads_removed:v2:${encodeURIComponent(userId)}`;
    }

    private readCachedGrant(userId: string): boolean {
        try {
            const cached = JSON.parse(this.cache.getString(this.cacheKey(userId)) ?? 'null');
            return cached?.adsRemoved === true && (cached.expiresAt === null ||
                (typeof cached.expiresAt === 'string' && Date.parse(cached.expiresAt) > Date.now()));
        } catch {
            return false;
        }
    }

    private getAnonymousId(): string {
        if (this.anonymousId) return this.anonymousId;
        const existing = this.cache.getString(APP_USER_ID_KEY);
        if (existing) return this.anonymousId = existing;
        const generated = Purchases.generateRevenueCatAnonymousAppUserId();
        this.cache.set(APP_USER_ID_KEY, generated);
        return this.anonymousId = generated;
    }

    private setState(next: Partial<PurchaseState>): void {
        this.store.set(next);
        const state = this.store.get();
        if (state.ready && this.reportedAdsRemoved !== state.adsRemoved) {
            this.reportedAdsRemoved = state.adsRemoved;
            this.analytics.setUserProperty('remove_ads', state.adsRemoved ? 'true' : 'false');
        }
    }

    private async loadOffers(placement: PurchasePlacement, revision: number): Promise<PurchaseOffer[]> {
        if (!this.isCurrent(revision)) return [];
        const span = this.diagnostics.start('purchases.offerings', {provider: 'revenuecat'});
        try {
            const offering = await this.sdk!.getCurrentOfferingForPlacement(placement);
            if (!this.isCurrent(revision)) { span.finish('skipped'); return []; }
            for (const [id, entry] of this.packages) {
                if (entry.placement === placement) this.packages.delete(id);
            }
            const offers = (offering?.availablePackages ?? []).map((pkg): PurchaseOffer => {
                const id = JSON.stringify([offering!.identifier, pkg.identifier, placement, revision]);
                this.packages.set(id, {pkg, offering: offering!, placement});
                return {
                    id,
                    title: pkg.webBillingProduct.title,
                    priceLabel: pkg.webBillingProduct.currentPrice.formattedPrice,
                    recurring: pkg.webBillingProduct.productType === ProductType.Subscription,
                    autoRenewing: pkg.webBillingProduct.productType === ProductType.Subscription,
                    billingPeriod: pkg.webBillingProduct.normalPeriodDuration,
                    offeringId: offering!.identifier,
                    placement,
                };
            });
            if (placement === SETTINGS_PLACEMENT) this.setState({offers});
            span.finish(offers.length ? 'ok' : 'empty');
            return offers;
        } catch (error) {
            span.fail(error, {error_code: diagnosticCode(error)});
            return [];
        }
    }
}
