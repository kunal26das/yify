import {LibraryRepositoryImpl} from '../repositories/LibraryRepositoryImpl';
import {Platform} from 'react-native';
import type {Dependencies} from '@/domain';
import {createCatalogRepositories} from './catalogRepositories';
import {TmdbApiDataSource} from '../datasources/TmdbApiDataSource';
import {FirebaseAnalyticsSink} from '../datasources/analytics/FirebaseAnalyticsSink';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {TmdbRepositoryImpl} from '../repositories/TmdbRepositoryImpl';
import {StreamingRepositoryImpl} from '../repositories/StreamingRepositoryImpl';
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
import {CountryLocationImpl} from '../services/CountryLocationImpl';
import {AvailabilityAlertsImpl} from '../services/AvailabilityAlertsImpl';
import {AvailabilityPushImpl} from '../services/AvailabilityPush';
import {FirestoreAvailabilityEnrollment} from '../datasources/AvailabilityEnrollment';
import {availabilityPilotAccess} from '../services/availabilityAccess';
import {watchForeground} from '../datasources/platform/ForegroundWatcher';
import {JournalRepositoryImpl} from '../repositories/JournalRepositoryImpl';

let instance: Dependencies | null = null;
let accountLink: AccountLink | null = null;

export function createDependencies(): Dependencies {
    if (instance != null) return instance;

    const analytics = new FirebaseAnalyticsSink();
    const diagnostics = new SentryDiagnostics();
    const appConfig = new RemoteAppConfig(diagnostics);
    const network = new ExpoNetworkMonitor();

    const tmdbApi = new TmdbApiDataSource(async () => {
        await appConfig.ready();
        return appConfig.getTmdbApiKey();
    }, undefined, diagnostics);
    const tmdb = new TmdbRepositoryImpl(tmdbApi);

    const auth = new FirebaseAuthRepositoryImpl(diagnostics);
    const preferences = new PreferencesRepositoryImpl(new PersistentCache('settings'));
    const library = new LibraryRepositoryImpl(new PersistentCache('library'));
    const watchlist = new WatchlistRepositoryImpl(new PersistentCache('watchlist'), analytics,
        () => ({platform: Platform.OS, country: preferences.getPreferences().watchRegion}));
    const watchHistory = new WatchHistoryRepositoryImpl(new PersistentCache('history'));
    const journal = new JournalRepositoryImpl({auth, store: new PersistentCache('journal'), network});
    const purchases = new RevenueCatPurchaseRepositoryImpl(
        analytics,
        new PersistentCache('purchases'), diagnostics, () => preferences.getPreferences().watchRegion,
    );
    const catalog = createCatalogRepositories(appConfig, diagnostics, auth, purchases);
    const accountSync = new AccountSyncImpl({
        diagnostics,
        store: new PersistentCache('sync'),
        auth,
        watchlist,
        library,
        journal,
        watchHistory,
        preferences,
    });

    accountLink = new AccountLink({auth, purchases, accountSync, analytics});

    const ads = new AdMobAdGateway({
        network,
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
        appUpdates: new ExpoAppUpdates(diagnostics, network),
        auth,
        movies: catalog.movies,
        shows: catalog.shows,
        anime: catalog.anime,
        subscriberAccess: catalog.subscriberAccess,
        tmdb,
        streaming: new StreamingRepositoryImpl(tmdb, new PersistentCache('streaming'), diagnostics),
        countryLocation: new CountryLocationImpl(),
        searchHistory: new SearchHistoryRepositoryImpl(new PersistentCache('search')),
        preferences,
        watchlist,
        library,
        journal,
        watchHistory,
        purchases,
        accountSync,
        network,
        newMovies: new NewMoviesNotifierImpl(diagnostics, analytics),
        storeServices: new PlayStoreServices(),
        ads,
        displayAds: new AdSenseDisplayAds(purchases),
        supporterNudge,
        availabilityAlerts: new AvailabilityAlertsImpl({
            configured: process.env.EXPO_PUBLIC_AVAILABILITY_ALERTS_PILOT === 'true',
            auth, preferences, push: new AvailabilityPushImpl(),
            enrollment: new FirestoreAvailabilityEnrollment(), store: new PersistentCache('availability-alerts'),
            access: availabilityPilotAccess,
            onRefresh: listener => {
                watchForeground(listener);
                network.subscribe(() => {if (network.isOnline()) listener();});
            },
        }),
    };

    return instance;
}

export function getAccountLink(): AccountLink | null {
    return accountLink;
}
