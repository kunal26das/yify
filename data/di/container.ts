import type {Dependencies} from '@/domain';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {EztvApiDataSource} from '../datasources/EztvApiDataSource';
import {TmdbApiDataSource} from '../datasources/TmdbApiDataSource';
import {FirebaseAnalyticsSink} from '../datasources/analytics/FirebaseAnalyticsSink';
import {PersistentCache} from '../datasources/storage/PersistentCache';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../repositories/ShowRepositoryImpl';
import {TmdbRepositoryImpl} from '../repositories/TmdbRepositoryImpl';
import {FirebaseAuthRepositoryImpl} from '../repositories/FirebaseAuthRepositoryImpl';
import {PreferencesRepositoryImpl} from '../repositories/PreferencesRepositoryImpl';
import {WatchlistRepositoryImpl} from '../repositories/WatchlistRepositoryImpl';
import {SearchHistoryRepositoryImpl} from '../repositories/SearchHistoryRepositoryImpl';
import {RevenueCatPurchaseRepositoryImpl} from '../repositories/RevenueCatPurchaseRepositoryImpl';
import {RemoteAppConfig} from '../services/RemoteAppConfig';
import {ExpoAppUpdates} from '../services/ExpoAppUpdates';
import {PlayStoreServices} from '../services/PlayStoreServices';
import {AccountSyncImpl} from '../services/AccountSyncImpl';
import {NewMoviesNotifierImpl} from '../services/NewMoviesNotifierImpl';
import {AccountLink} from '../services/AccountLink';

let instance: Dependencies | null = null;
let accountLink: AccountLink | null = null;

export function createDependencies(): Dependencies {
    if (instance != null) return instance;

    const analytics = new FirebaseAnalyticsSink();
    const appConfig = new RemoteAppConfig();

    const ytsApi = new YtsApiDataSource(() => appConfig.getApiBaseUrl());
    const eztvApi = new EztvApiDataSource();
    const tmdbApi = new TmdbApiDataSource(async () => {
        await appConfig.ready();
        return appConfig.getTmdbApiKey();
    });

    const auth = new FirebaseAuthRepositoryImpl();
    const preferences = new PreferencesRepositoryImpl(new PersistentCache('settings'));
    const watchlist = new WatchlistRepositoryImpl(new PersistentCache('watchlist'));
    const purchases = new RevenueCatPurchaseRepositoryImpl(
        analytics,
        new PersistentCache('purchases')
    );
    const accountSync = new AccountSyncImpl({
        store: new PersistentCache('sync'),
        auth,
        watchlist,
        preferences,
    });

    accountLink = new AccountLink({auth, purchases, accountSync, analytics});

    instance = {
        analytics,
        appConfig,
        appUpdates: new ExpoAppUpdates(),
        auth,
        movies: new MovieRepositoryImpl(ytsApi),
        shows: new ShowRepositoryImpl(eztvApi),
        tmdb: new TmdbRepositoryImpl(tmdbApi),
        searchHistory: new SearchHistoryRepositoryImpl(new PersistentCache('search')),
        preferences,
        watchlist,
        purchases,
        accountSync,
        newMovies: new NewMoviesNotifierImpl(),
        storeServices: new PlayStoreServices(),
    };

    return instance;
}

export function getAccountLink(): AccountLink | null {
    return accountLink;
}
