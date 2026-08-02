import type {AccountSync, AnalyticsSink, AuthRepository, PurchaseRepository} from '@/domain';

interface AccountLinkDeps {
    auth: AuthRepository;
    purchases: PurchaseRepository;
    accountSync: AccountSync;
    analytics: AnalyticsSink;
}

export class AccountLink {
    private readonly auth: AuthRepository;
    private readonly purchases: PurchaseRepository;
    private readonly accountSync: AccountSync;
    private readonly analytics: AnalyticsSink;

    private started = false;
    private lastUid: string | null | undefined;

    constructor({auth, purchases, accountSync, analytics}: AccountLinkDeps) {
        this.auth = auth;
        this.purchases = purchases;
        this.accountSync = accountSync;
        this.analytics = analytics;
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        const apply = () => {
            const {ready, account} = this.auth.getSession();
            if (!ready) return;
            const uid = account?.uid ?? null;
            if (uid === this.lastUid) return;
            this.lastUid = uid;
            if (uid) this.analytics.trackEvent('login', {method: 'google'});
            void this.purchases.identify(account);
            this.accountSync.setAccount(uid);
        };
        this.auth.subscribe(apply);
        apply();
    }
}
