export { Quality, SortBy, OrderBy, Genre } from './entities/MovieQuery';
export type { Movie } from './entities/Movie';
export type {Show, ShowEpisode} from './entities/Show';
export type {WatchProvider, WatchAvailability, WatchOffer} from './entities/WatchProvider';
export type {Torrent} from './entities/Torrent';
export type {CastMember} from './entities/CastMember';
export type {MovieDetails} from './entities/MovieDetails';
export type {HistoryEntry, HistoryKind} from './entities/HistoryEntry';
export type {ParentalGuide} from './entities/ParentalGuide';

export type {Account, AuthSession} from './entities/Account';
export {INITIAL_AUTH_SESSION} from './entities/Account';
export type {
  ThemePreference,
  BrowseDefaults,
  Preferences,
  SyncedPreferences,
} from './entities/Preferences';
export {DEFAULT_BROWSE_DEFAULTS, DEFAULT_PREFERENCES} from './entities/Preferences';
export type {PlaybackPreferences} from './entities/PlaybackPreferences';
export {DEFAULT_PLAYBACK_PREFERENCES} from './entities/PlaybackPreferences';
export type {NotificationPreferences} from './entities/NotificationPreferences';
export {DEFAULT_NOTIFICATION_PREFERENCES} from './entities/NotificationPreferences';
export type {PurchaseOffer, PurchaseState, PurchaseFailure} from './entities/Entitlement';
export {REMOVE_ADS_ENTITLEMENT, INITIAL_PURCHASE_STATE} from './entities/Entitlement';
export type {UpdateState, UpdateStatus} from './entities/UpdateStatus';
export {IDLE_UPDATE_STATUS} from './entities/UpdateStatus';
export type {SyncState, SyncFailure, SyncStatus} from './entities/SyncStatus';
export {IDLE_SYNC_STATUS} from './entities/SyncStatus';

export type {
  MovieRepository,
  ListMoviesParams,
  ListMoviesResult,
} from './repositories/MovieRepository';
export type {
  ShowRepository,
  ListShowsParams,
  ListShowsResult,
} from './repositories/ShowRepository';
export type {
  TmdbRepository,
  TitleArtwork,
  TitleMedia,
} from './repositories/TmdbRepository';
export type {KeyValueStore} from './repositories/KeyValueStore';
export type {AuthRepository} from './repositories/AuthRepository';
export type {PreferencesRepository} from './repositories/PreferencesRepository';
export type {WatchlistRepository} from './repositories/WatchlistRepository';
export type {WatchHistoryRepository} from './repositories/WatchHistoryRepository';
export type {PurchaseRepository} from './repositories/PurchaseRepository';
export type {SeenMoviesRepository} from './repositories/SeenMoviesRepository';
export type {SearchHistoryRepository} from './repositories/SearchHistoryRepository';

export {
  selectNewMovies,
  buildNotificationContent,
  buildNotificationBatch,
  filterNotifiableMovies,
  isWithinQuietHours,
  quietHoursEndAt,
  notificationQuerySignature,
  NOTIFICATION_BURST_LIMIT,
} from './policies/newMoviesNotification';
export type {NewMoviesNotification, NewMoviesFilter} from './policies/newMoviesNotification';
export {readSection, mergeSection} from './policies/preferencesMerge';
export type {SectionGuards} from './policies/preferencesMerge';
export {
  decideAd,
  commitAdShown,
  parseAdGateState,
  encodeAdGateState,
  INITIAL_AD_GATE_STATE,
  AD_GATE_STATE_VERSION,
  AD_COOLDOWN_MS,
  AD_WINDOW_MS,
  AD_WINDOW_LIMIT,
} from './policies/adGating';
export {
  decideNudge,
  commitAdWatched,
  commitNudgeShown,
  commitNudgeDeclined,
  commitNudgeAccepted,
  parseNudgeState,
  encodeNudgeState,
  INITIAL_NUDGE_STATE,
  NUDGE_STATE_VERSION,
  NUDGE_COOLDOWN_MS,
  NUDGE_MIN_ADS,
  NUDGE_DECLINE_LIMIT,
} from './policies/supporterNudge';
export type {NudgeDecision, NudgeState, NudgeInput} from './policies/supporterNudge';
export type {AdTrigger, AdGateDecision, AdGateState, AdGateInput} from './policies/adGating';
export {
  chooseSyncMode,
  resolveSection,
  parseWatchlistState,
  mergeWatchlistState,
  sameWatchlistState,
  markChanges,
  pruneMarks,
  encodeWatchlistState,
  fitWatchlistPayload,
  payloadWithinBudget,
  WATCHLIST_PAYLOAD_VERSION,
  TOMBSTONE_HORIZON_MS,
} from './policies/syncMerge';
export {
    clearHistory,
    emptyHistoryState,
    encodeHistoryState,
    fitHistoryPayload,
    liveHistory,
    mergeHistoryState,
    parseHistoryState,
    pruneTombstones,
    recordHistory,
    removeHistory,
    sameHistoryState,
    sortHistory,
    HISTORY_LIMIT,
    HISTORY_PAYLOAD_VERSION,
    HISTORY_TOMBSTONE_HORIZON_MS,
} from './policies/historyMerge';
export type {
    HistoryState,
    HistoryTombstones,
    FittedHistoryPayload,
} from './policies/historyMerge';
export {
    filterHistory,
    groupHistory,
    historyGroupLabel,
    historyHref,
    historyKind,
    movieHistoryEntry,
    movieHistoryKey,
    showHistoryEntry,
    showHistoryKey,
} from './policies/historyView';
export type {HistoryGroup, HistoryFilter} from './policies/historyView';
export type {
  SyncMode,
  SectionResolution,
  WatchlistEntry,
  WatchlistMark,
  WatchlistMarks,
  WatchlistState,
  FittedPayload,
} from './policies/syncMerge';

export type {AnalyticsSink, AnalyticsParams} from './services/AnalyticsSink';
export type {AppConfig} from './services/AppConfig';
export type {AppUpdates} from './services/AppUpdates';
export type {StoreServices} from './services/StoreServices';
export type {AdGateway} from './services/AdGateway';
export type {
    AdRevenueSink,
    AdImpressionRevenue,
    AdRevenuePrecision,
} from './services/AdRevenueSink';
export type {SupporterNudge} from './services/SupporterNudge';
export type {NewMoviesNotifier} from './services/NewMoviesNotifier';
export type {AccountSync} from './services/AccountSync';

export type {Dependencies} from './Dependencies';
