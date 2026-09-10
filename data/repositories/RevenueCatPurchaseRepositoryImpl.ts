import {Platform} from 'react-native';
import Purchases, {
    LOG_LEVEL,
    PRODUCT_CATEGORY,
    type CustomerInfo,
    type PurchasesPackage,
    type PurchasesOffering,
} from 'react-native-purchases';

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
import {getAnalyticsInstanceId} from '../datasources/analytics/FirebaseAnalyticsSink';
import {watchForeground} from '../datasources/platform/ForegroundWatcher';
import {NOOP_DIAGNOSTICS} from '../services/NoopDiagnostics';
import {createObservable} from './support/observable';

const apiKey =
    Platform.OS === 'ios'
        ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
        : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

const ADS_REMOVED_KEY = 'ads_removed:v2:';
const INIT_BACKOFF_MS = [5000, 15000, 60000, 300000];

function hasRemoveAds(info: CustomerInfo): boolean {
    return info.entitlements.active[REMOVE_ADS_ENTITLEMENT] !== undefined;
}

function customerState(info: CustomerInfo): Pick<PurchaseState,
    'adsRemoved' | 'managementURL' | 'expiresAt' | 'willRenew' | 'billingIssue'> {
    const entitlement = info.entitlements.active[REMOVE_ADS_ENTITLEMENT] ??
        info.entitlements.all?.[REMOVE_ADS_ENTITLEMENT];
    return {
        adsRemoved: hasRemoveAds(info),
        managementURL: info.managementURL ?? null,
        expiresAt: entitlement?.expirationDate ?? null,
        willRenew: entitlement?.willRenew ?? false,
        billingIssue: entitlement?.billingIssueDetectedAt != null,
    };
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

function diagnosticCode(error: unknown): string {
    try {
        const code = (error as {code?: unknown} | null)?.code;
        if (typeof code !== 'string') return 'unknown';
        switch (code) {
            case Purchases.PURCHASES_ERROR_CODE.NETWORK_ERROR: return 'network';
            case Purchases.PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR: return 'offline';
            case Purchases.PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR: return 'store_problem';
            case Purchases.PURCHASES_ERROR_CODE.CONFIGURATION_ERROR: return 'configuration';
            case Purchases.PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: return 'product_unavailable';
            case Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR: return 'purchase_not_allowed';
            case Purchases.PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR: return 'invalid_credentials';
            case Purchases.PURCHASES_ERROR_CODE.UNEXPECTED_BACKEND_RESPONSE_ERROR: return 'backend_response';
            case Purchases.PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR: return 'timeout';
            default: return 'unknown';
        }
    } catch {
        return 'unknown';
    }
}

function toOffer(
    pkg: PurchasesPackage, offering: PurchasesOffering, placement: PurchasePlacement, revision: number
): PurchaseOffer {
    const recurring = pkg.product.productCategory === PRODUCT_CATEGORY.SUBSCRIPTION;
    const option = Platform.OS === 'android' ? pkg.product.defaultOption : null;
    const fullPricePhase = option?.fullPricePhase;
    return {
        id: [String(revision), placement, offering.identifier, pkg.identifier].map(encodeURIComponent).join(':'),
        title: pkg.product.title,
        priceLabel: fullPricePhase?.price.formatted ?? pkg.product.priceString,
        recurring,
        autoRenewing: recurring && option?.isPrepaid !== true,
        billingPeriod: fullPricePhase?.billingPeriod.iso8601 ?? pkg.product.subscriptionPeriod,
        offeringId: offering.identifier,
        placement,
    };
}

export class RevenueCatPurchaseRepositoryImpl implements PurchaseRepository {
    private readonly store = createObservable<PurchaseState>(INITIAL_PURCHASE_STATE);
    private readonly packages = new Map<string, {
        pkg: PurchasesPackage; offering: PurchasesOffering; offer: PurchaseOffer; revision: number;
    }>();
    private readonly pendingOfferings = new Map<PurchasePlacement, Promise<PurchaseOffer[]>>();
    private readonly analytics: AnalyticsSink;
    private readonly cache: KeyValueStore;

    private configured = false;
    private observing = false;
    private desiredUid: string | null | undefined;
    private activeSdkUid: string | null = null;
    private revision = 0;
    private syncedRevision = -1;
    private queue: Promise<unknown> = Promise.resolve();
    private refreshPromise: Promise<void> | null = null;
    private forceRefresh = false;
    private customerUpdatePending = false;
    private customerSignature: string | null = null;
    private mutation: {kind: string; promise: Promise<boolean>} | null = null;
    private reportedEntitlement: string | undefined;
    private syncFailures = 0;
    private linkedRevision = -1;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(analytics: AnalyticsSink, cache: KeyValueStore, private readonly diagnostics: Diagnostics = NOOP_DIAGNOSTICS) {
        this.analytics = analytics;
        this.cache = cache;
        // The legacy unscoped cache cannot identify which customer owned the entitlement.
        this.store.set({available: Boolean(apiKey)});
    }

    getState(): PurchaseState {
        return this.store.get();
    }

    subscribe(listener: () => void): () => void {
        return this.store.subscribe(listener);
    }

    init(): Promise<void> {
        if (!apiKey || (this.configured && this.store.get().ready)) return Promise.resolve();
        return this.requestSync();
    }

    refresh(): Promise<void> {
        return this.requestSync(true);
    }

    identify(account: Account | null): Promise<void> {
        if (!apiKey) return Promise.resolve();
        const uid = account?.uid ?? null;
        if (uid !== this.desiredUid) {
            this.desiredUid = uid;
            this.revision += 1;
            this.packages.clear();
            this.pendingOfferings.clear();
            this.clearRetry();
            this.syncFailures = 0;
            this.setState({
                ready: false,
                adsRemoved: uid != null && this.cachedAdsRemoved(uid),
                offers: [],
                purchasing: null,
                restoring: false,
                failure: null,
                managementURL: null,
                expiresAt: null,
                willRenew: false,
                billingIssue: false,
            });
        } else if (this.syncedRevision === this.revision && this.store.get().ready) {
            return this.refreshPromise ?? Promise.resolve();
        }
        return this.requestSync();
    }

    getOffers(placement: PurchasePlacement): Promise<PurchaseOffer[]> {
        if (!this.store.get().ready) return Promise.resolve([]);
        const pending = this.pendingOfferings.get(placement);
        if (pending) return pending;
        const revision = this.revision;
        const promise = this.enqueue(async () => {
            if (revision !== this.revision || !this.store.get().ready) return [];
            try {
                return await this.fetchOffers(placement, revision);
            } catch {
                this.analytics.trackEvent('revenuecat_sync_failed', {phase: 'offerings'});
                return [];
            }
        }).finally(() => {
            if (this.pendingOfferings.get(placement) === promise) this.pendingOfferings.delete(placement);
        });
        this.pendingOfferings.set(placement, promise);
        return promise;
    }

    trackPaywallImpression(offerId: string): void {
        const entry = this.packages.get(offerId);
        if (!entry || !this.isCurrent(entry.revision, this.activeSdkUid)) return;
        void this.enqueue(async () => {
            if (!this.isCurrent(entry.revision, this.activeSdkUid)) return;
            try {
                await Purchases.trackCustomPaywallImpression({offering: entry.offering, paywallId: entry.offer.placement});
            } catch {
                this.analytics.trackEvent('revenuecat_sync_failed', {phase: 'paywall_impression'});
            }
        });
    }

    purchase(offerId: string): Promise<boolean> {
        const kind = `purchase:${offerId}`;
        if (this.mutation) {
            return this.mutation.kind === kind ? this.mutation.promise : Promise.resolve(false);
        }
        const entry = this.packages.get(offerId);
        if (!this.store.get().ready || entry == null || entry.revision !== this.revision) {
            this.setState({failure: 'offer_unavailable'});
            this.analytics.trackEvent('remove_ads_purchase_failed', {
                package_id: offerId,
                reason: 'offer_unavailable',
            });
            this.diagnostics.event('purchases.purchase', {outcome: 'unavailable'});
            return Promise.resolve(false);
        }
        const revision = this.revision;
        const uid = this.activeSdkUid;
        this.setState({purchasing: offerId, failure: null});
        return this.runMutation(kind, async () => {
            const span = this.diagnostics.start('purchases.purchase', {provider: 'revenuecat'});
            if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
            if (!this.packages.has(offerId)) {
                this.setState({failure: 'offer_unavailable'});
                span.finish('unavailable');
                return false;
            }
            this.analytics.trackEvent('remove_ads_purchase_start', {package_id: offerId});
            try {
                const {customerInfo} = await Purchases.purchasePackage(entry.pkg);
                if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
                const purchased = hasRemoveAds(customerInfo);
                this.applyCustomerInfo(customerInfo, uid!);
                this.setState({failure: purchased ? null : 'not_granted'});
                this.analytics.trackEvent('remove_ads_purchase_done', {
                    package_id: offerId,
                    granted: purchased,
                });
                span.finish(purchased ? 'ok' : 'empty');
                return purchased;
            } catch (error) {
                if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
                const reason = purchaseFailureReason(error);
                if (reason === 'unknown') span.fail(error, {error_code: diagnosticCode(error)});
                else span.finish(reason === 'cancelled' ? 'cancelled' : reason === 'pending' ? 'pending' : 'skipped', {error_code: reason});
                this.setState({failure: reason});
                this.analytics.trackEvent('remove_ads_purchase_failed', {package_id: offerId, reason});
                return false;
            }
        });
    }

    restore(): Promise<boolean> {
        if (this.mutation) {
            return this.mutation.kind === 'restore' ? this.mutation.promise : Promise.resolve(false);
        }
        if (!this.store.get().ready) {
            this.setState({failure: 'restore_failed'});
            this.diagnostics.event('purchases.restore', {outcome: 'unavailable'});
            return Promise.resolve(false);
        }
        const revision = this.revision;
        const uid = this.activeSdkUid;
        this.setState({restoring: true, failure: null});
        return this.runMutation('restore', async () => {
            const span = this.diagnostics.start('purchases.restore', {provider: 'revenuecat'});
            if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
            try {
                const info = await Purchases.restorePurchases();
                if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
                const restored = hasRemoveAds(info);
                this.applyCustomerInfo(info, uid!);
                this.setState({failure: null});
                this.analytics.trackEvent('remove_ads_restore', {result: restored ? 'restored' : 'none'});
                span.finish(restored ? 'ok' : 'empty');
                return restored;
            } catch (error) {
                if (!this.isCurrent(revision, uid)) { span.finish('skipped'); return false; }
                const reason = purchaseFailureReason(error);
                if (reason === 'unknown') span.fail(error, {error_code: diagnosticCode(error)});
                else span.finish(reason === 'cancelled' ? 'cancelled' : reason === 'pending' ? 'pending' : 'skipped', {error_code: reason});
                this.setState({failure: 'restore_failed'});
                this.analytics.trackEvent('remove_ads_restore', {result: 'error'});
                return false;
            }
        });
    }

    private enqueue<T>(work: () => Promise<T>): Promise<T> {
        const result = this.queue.then(work);
        this.queue = result.catch(() => {});
        return result;
    }

    private runMutation(kind: string, work: () => Promise<boolean>): Promise<boolean> {
        const promise = this.enqueue(work).finally(() => {
            this.mutation = null;
            this.setState({purchasing: null, restoring: false});
        });
        this.mutation = {kind, promise};
        return promise;
    }

    private requestSync(force = false): Promise<void> {
        if (!apiKey) return Promise.resolve();
        this.forceRefresh ||= force;
        if (this.refreshPromise) return this.refreshPromise;
        this.setState({refreshing: true});
        const promise = this.enqueue(() => this.synchronize()).finally(() => {
            this.refreshPromise = null;
            this.setState({refreshing: false});
        });
        this.refreshPromise = promise;
        return promise;
    }

    private async configure(): Promise<void> {
        if (!this.configured) {
            Purchases.setLogLevel(LOG_LEVEL.WARN);
            await Purchases.configure({apiKey: apiKey!});
            this.configured = true;
        }
        if (!this.observing) {
            Purchases.addCustomerInfoUpdateListener((info) => {
                // Listener payloads have no reliable current-user ID. Read through the serialized SDK identity.
                if (JSON.stringify(customerState(info)) === this.customerSignature) return;
                this.customerUpdatePending = true;
                void this.requestSync();
            });
            watchForeground(() => { void this.requestSync(); });
            this.observing = true;
        }
    }

    private async synchronize(): Promise<void> {
        const span = this.diagnostics.start('purchases.sync', {
            provider: 'revenuecat', attempt: Math.min(this.syncFailures + 1, INIT_BACKOFF_MS.length),
        });
        try {
            await this.configure();
        } catch (error) {
            span.fail(error, {stage: 'configure', error_code: diagnosticCode(error)});
            this.scheduleRetry('configure');
            return;
        }
        // Configure early for ad tracking, but wait for Firebase's initial account before exposing entitlements.
        while (this.desiredUid !== undefined) {
            const revision = this.revision;
            const desiredUid = this.desiredUid;
            this.customerUpdatePending = false;
            try {
                let info: CustomerInfo | undefined;
                const previousUid = await Purchases.getAppUserID();
                if (revision !== this.revision) continue;
                if (desiredUid != null && previousUid !== desiredUid) {
                    info = (await Purchases.logIn(desiredUid)).customerInfo;
                } else if (desiredUid == null) {
                    const anonymous = await Purchases.isAnonymous();
                    if (revision !== this.revision) continue;
                    if (!anonymous) info = await Purchases.logOut();
                }
                const sdkUid = await Purchases.getAppUserID();
                if (revision !== this.revision) continue;
                if (desiredUid != null && sdkUid !== desiredUid) throw new Error('identity_mismatch');
                if (!this.store.get().ready) {
                    this.setState({adsRemoved: this.cachedAdsRemoved(sdkUid)});
                }
                if (this.forceRefresh) {
                    this.forceRefresh = false;
                    await Purchases.invalidateCustomerInfoCache();
                    info = undefined;
                }
                info ??= await Purchases.getCustomerInfo();
                if (revision !== this.revision) continue;
                this.activeSdkUid = sdkUid;
                this.syncedRevision = revision;
                this.applyCustomerInfo(info, sdkUid);
                if (this.linkedRevision !== revision && await this.linkFirebaseAnalytics()) {
                    this.linkedRevision = revision;
                }
                if (revision !== this.revision) continue;
                const offersLoaded = await this.loadOfferings(revision);
                if (revision !== this.revision || this.forceRefresh || this.customerUpdatePending) continue;
                if (offersLoaded) {
                    this.clearRetry();
                    this.syncFailures = 0;
                }
                span.finish(offersLoaded ? 'ok' : 'error', {stage: offersLoaded ? 'customer' : 'offerings'});
                return;
            } catch (error) {
                if (revision !== this.revision) continue;
                span.fail(error, {stage: 'customer', error_code: diagnosticCode(error)});
                this.scheduleRetry('customer');
                return;
            }
        }
        span.finish('skipped');
    }

    private isCurrent(revision: number, uid: string | null): boolean {
        return uid != null && revision === this.revision && this.syncedRevision === revision &&
            this.activeSdkUid === uid && this.store.get().ready;
    }

    private cacheKey(uid: string): string {
        return ADS_REMOVED_KEY + encodeURIComponent(uid);
    }

    private cachedAdsRemoved(uid: string): boolean {
        try {
            const cached: unknown = JSON.parse(this.cache.getString(this.cacheKey(uid)) ?? 'null');
            if (cached == null || typeof cached !== 'object') return false;
            const {adsRemoved, expiresAt} = cached as {adsRemoved?: unknown; expiresAt?: unknown};
            if (adsRemoved !== true) return false;
            if (expiresAt === null) return true;
            return typeof expiresAt === 'string' && Date.parse(expiresAt) > Date.now();
        } catch {
            return false;
        }
    }

    private applyCustomerInfo(info: CustomerInfo, uid: string): void {
        const adsRemoved = hasRemoveAds(info);
        const next = customerState(info);
        this.customerSignature = JSON.stringify(next);
        this.cache.set(this.cacheKey(uid), JSON.stringify({adsRemoved, expiresAt: next.expiresAt}));
        this.setState({ready: true, ...next});
        const reported = `${uid}:${adsRemoved}`;
        if (this.reportedEntitlement !== reported) {
            this.reportedEntitlement = reported;
            this.analytics.setUserProperty('remove_ads', adsRemoved ? 'true' : 'false');
        }
    }

    private setState(next: Partial<PurchaseState>): void {
        this.store.set(next);
    }

    private async fetchOffers(placement: PurchasePlacement, revision: number): Promise<PurchaseOffer[]> {
        const span = this.diagnostics.start('purchases.offerings', {provider: 'revenuecat'});
        try {
            const offering = await Purchases.getCurrentOfferingForPlacement(placement);
            if (revision !== this.revision) { span.finish('skipped'); return []; }
            for (const [id, entry] of this.packages) {
                if (entry.offer.placement === placement) this.packages.delete(id);
            }
            const offers = (offering?.availablePackages ?? []).map((pkg) => {
                const offer = toOffer(pkg, offering!, placement, revision);
                this.packages.set(offer.id, {pkg, offering: offering!, offer, revision});
                return offer;
            });
            if (placement === 'settings_supporter') this.setState({offers});
            span.finish(offers.length ? 'ok' : 'empty');
            return offers;
        } catch (error) {
            span.fail(error, {error_code: diagnosticCode(error)});
            throw error;
        }
    }

    private async loadOfferings(revision: number): Promise<boolean> {
        try {
            await this.fetchOffers('settings_supporter', revision);
            return true;
        } catch {
            if (revision === this.revision) this.scheduleRetry('offerings');
            return false;
        }
    }

    private scheduleRetry(phase: string): void {
        this.analytics.trackEvent('revenuecat_sync_failed', {phase});
        if (this.retryTimer != null) return;
        const delay = INIT_BACKOFF_MS[Math.min(this.syncFailures, INIT_BACKOFF_MS.length - 1)];
        this.syncFailures += 1;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            void this.requestSync();
        }, delay);
    }

    private clearRetry(): void {
        if (this.retryTimer == null) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
    }

    private async linkFirebaseAnalytics(): Promise<boolean> {
        try {
            const instanceId = await getAnalyticsInstanceId();
            if (!instanceId) return false;
            await Purchases.setFirebaseAppInstanceID(instanceId);
            return true;
        } catch (error) {
            this.diagnostics.capture(error, 'purchases.analytics_link', {provider: 'revenuecat'});
            return false;
        }
    }
}
