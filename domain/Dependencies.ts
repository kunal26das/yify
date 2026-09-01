import type {AuthRepository} from './repositories/AuthRepository';
import type {MovieRepository} from './repositories/MovieRepository';
import type {PreferencesRepository} from './repositories/PreferencesRepository';
import type {PurchaseRepository} from './repositories/PurchaseRepository';
import type {SearchHistoryRepository} from './repositories/SearchHistoryRepository';
import type {ShowRepository} from './repositories/ShowRepository';
import type {TmdbRepository} from './repositories/TmdbRepository';
import type {WatchHistoryRepository} from './repositories/WatchHistoryRepository';
import type {WatchlistRepository} from './repositories/WatchlistRepository';
import type {AccountSync} from './services/AccountSync';
import type {AdGateway} from './services/AdGateway';
import type {SupporterNudge} from './services/SupporterNudge';
import type {AnalyticsSink} from './services/AnalyticsSink';
import type {AppConfig} from './services/AppConfig';
import type {AppUpdates} from './services/AppUpdates';
import type {NewMoviesNotifier} from './services/NewMoviesNotifier';
import type {StoreServices} from './services/StoreServices';

export interface Dependencies {
    analytics: AnalyticsSink;
    appConfig: AppConfig;
    appUpdates: AppUpdates;
    auth: AuthRepository;
    movies: MovieRepository;
    shows: ShowRepository;
    tmdb: TmdbRepository;
    searchHistory: SearchHistoryRepository;
    preferences: PreferencesRepository;
    watchlist: WatchlistRepository;
    watchHistory: WatchHistoryRepository;
    purchases: PurchaseRepository;
    accountSync: AccountSync;
    newMovies: NewMoviesNotifier;
    storeServices: StoreServices;
    ads: AdGateway;
    supporterNudge: SupporterNudge;
}
