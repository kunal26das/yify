import type {Dependencies} from '@/domain';
import {createCatalogRepositories} from './catalogRepositories';
import {TmdbApiDataSource} from '../datasources/TmdbApiDataSource';
import {FirebaseAnalyticsSink} from '../datasources/analytics/FirebaseAnalyticsSink';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {TmdbRepositoryImpl} from '../repositories/TmdbRepositoryImpl';
import {FirebaseAuthRepositoryImpl} from '../repositories/FirebaseAuthRepositoryImpl';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {WatchlistRepositoryImpl} from '../repositories/WatchlistRepositoryImpl';
import {WatchHistoryRepositoryImpl} from '../repositories/WatchHistoryRepositoryImpl';
import {SearchHistoryRepositoryImpl} from '../repositories/SearchHistoryRepositoryImpl';
import {RevenueCatPurchaseRepositoryImpl} from '../repositories/RevenueCatPurchaseRepositoryImpl';
import {RemoteAppConfig} from '../services/RemoteAppConfig';
import {ExpoAppUpdates} from '../services/ExpoAppUpdates';
import {PlayStoreServices} from '../services/PlayStoreServices';
import {AdMobAdGateway} from '../services/AdMobAdGateway';
import {AdSenseDisplayAds} from '../services/AdSenseDisplayAds';
import {RevenueCatAdRevenueSink} from '../services/RevenueCatAdRevenueSink';
import {SupporterNudgeImpl} from '../services/SupporterNudgeImpl';
import {AccountSyncImpl} from '../services/AccountSyncImpl';
import {ExpoNetworkMonitor} from '../services/ExpoNetworkMonitor';
import {NewMoviesNotifierImpl} from '../services/NewMoviesNotifierImpl';
import {AccountLink} from '../services/AccountLink';
import {SentryDiagnostics} from '../services/SentryDiagnostics';

let instance: Dependencies | null = null;
let accountLink: AccountLink | null = null;

export function createDependencies(): Dependencies {
    if (instance != null) return instance;

    const analytics = new FirebaseAnalyticsSink();
    const diagnostics = new SentryDiagnostics();
    const appConfig = new RemoteAppConfig(diagnostics);

    const catalog = createCatalogRepositories(appConfig, diagnostics);
    const tmdbApi = new TmdbApiDataSource(async () => {
        await appConfig.ready();
        return appConfig.getTmdbApiKey();
    }, undefined, diagnostics);

    const auth = new FirebaseAuthRepositoryImpl(diagnostics);
    const preferences = new PreferencesRepositoryImpl(new PersistentCache('settings'));
    const watchlist = new WatchlistRepositoryImpl(new PersistentCache('watchlist'));
    const watchHistory = new WatchHistoryRepositoryImpl(new PersistentCache('history'));
    const purchases = new RevenueCatPurchaseRepositoryImpl(
        analytics,
        new PersistentCache('purchases'), diagnostics,
    );
    const accountSync = new AccountSyncImpl({
        diagnostics,
        store: new PersistentCache('sync'),
        auth,
        watchlist,
        watchHistory,
        preferences,
    });

    accountLink = new AccountLink({auth, purchases, accountSync, analytics});

    const ads = new AdMobAdGateway({
        diagnostics,
        analytics,
        adRevenue: new RevenueCatAdRevenueSink(analytics, diagnostics),
        entitlement: () => purchases.getState(),
    });

    const supporterNudge = new SupporterNudgeImpl({
        analytics,
        store: new PersistentCache('nudge'),
        enabled: () => ads.supported,
        entitlement: () => purchases.getState(),
    });

    instance = {
        diagnostics,
        analytics,
        appConfig,
        appUpdates: new ExpoAppUpdates(diagnostics),
        auth,
        movies: catalog.movies,
        shows: catalog.shows,
        tmdb: new TmdbRepositoryImpl(tmdbApi),
        searchHistory: new SearchHistoryRepositoryImpl(new PersistentCache('search')),
        preferences,
        watchlist,
        watchHistory,
        purchases,
        accountSync,
        network: new ExpoNetworkMonitor(),
        newMovies: new NewMoviesNotifierImpl(diagnostics),
        storeServices: new PlayStoreServices(),
        ads,
        displayAds: new AdSenseDisplayAds(purchases),
        supporterNudge,
    };

    return instance;
}

export function getAccountLink(): AccountLink | null {
    return accountLink;
}
