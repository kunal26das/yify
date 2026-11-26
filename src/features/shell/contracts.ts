import type {ErrorBoundaryProps} from 'expo-router';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import type {JSX, ReactNode} from 'react';
import type {AuthSession} from '@/core/domain/account';
import type {EntryKey, MediaType, TitleKey} from '@/core/domain/keys';
import type {DiaryEntry, HalfStars, LibraryEntry, RecentEntry, RecentState, TitleSnapshot, UserList} from '@/core/domain/library';
import type {Consent, Preferences, PreferenceStamps, PreferencesSectionState} from '@/core/domain/preferences';
import type {CatalogProvider, Region, RegionAvailability, RegionCode} from '@/core/domain/providers';
import type {SectionName, SyncFailure, SyncStatus, SyncedStoreAccess} from '@/core/domain/sync/types';
import type {Genre, Video} from '@/core/domain/title';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import type {AuthAdapter, auth} from '@/core/platform/auth/firebaseAuth';
import type {startStoreUpdates} from '@/core/platform/updates/storeUpdates';
import type {CardSurface} from '@/core/ui/components/MediaCard';
import type {setPlayerOpen, usePlayerOpen} from '@/core/ui/overlays';
import type {deleteAccount, DeleteAccountResult} from '@/features/account/public/deletion';
import type {getSession, isNewUser, onAccountDeleted, signIn, startSession, subscribeUid, useSession} from '@/features/account/public/session';
import type {signOut} from '@/features/account/public/signOut';
import type {AddToListSheet} from '@/features/library/public/AddToListSheet';
import type {DiarySheet, LibraryTarget} from '@/features/library/public/DiarySheet';
import type {DiaryPatch, logWatch, LogWatchInput, removeEntry, restoreEntry, updateEntry, useDiary, useWatched} from '@/features/library/public/diary';
import type {createList, ListResult, removeList, renameList, restoreList, setListItem, useCustomListCount, useList, useLists} from '@/features/library/public/lists';
import type {migrateLocalV1, retryLegacyResolution, startLegacyResolution, useLegacyMigrationStatus} from '@/features/library/public/migration';
import type {clearRecent, recordView, removeRecent, restoreRecent, restoreRecentState, useRecent} from '@/features/library/public/recent';
import type {removeFromWatchlist, restoreWatchlistEntry, toggleWatchlist, ToggleResult, useInWatchlist, useWatchlist} from '@/features/library/public/watchlist';
import type {AdTransitionHost} from '@/features/monetization/public/AdTransitionHost';
import type {reportTrailerState, startAds, useAdPrivacyOptions} from '@/features/monetization/public/ads';
import type {openTitle} from '@/features/monetization/public/openTitle';
import type {canCreateCustomList, effectiveAccent, getPlusStatus, insightsAccess, openPaywall, startPlus, usePlus} from '@/features/monetization/public/plus';
import type {PlusSheetHost} from '@/features/monetization/public/PlusSheetHost';
import type {
  EntitlementSnapshot, FREE_CUSTOM_LIST_LIMIT, OpenTitleInput, PaywallPlacement, PLUS_ENTITLEMENT, PlusEntitlement, PlusStatus, PlusStore, TitleOpenSource,
} from '@/features/monetization/public/types';
import type {TrailerFrame, TrailerFrameProps} from '@/features/player/public/TrailerFrame';
import type {HeaderSearch} from '@/features/search/public/HeaderSearch';
import type {useGenres} from '@/features/search/public/useGenres';
import type {ConsentPrompt} from '@/features/settings/public/ConsentPrompt';
import type {getConsent, isConsentPromptResolved, setConsent, startConsent, subscribeConsent, useConsent} from '@/features/settings/public/consent';
import type {CountryPickerSheet} from '@/features/settings/public/CountryPickerSheet';
import type {getPreferences, preferencesSyncAccess, setPreference, usePreferences} from '@/features/settings/public/preferences';
import type {getEffectiveRegion, startRegionDetection, useEffectiveRegion, useRegionSource} from '@/features/settings/public/region';
import type {ServicesPickerSheet} from '@/features/settings/public/ServicesPickerSheet';
import type {setMyServices, useMyServices, useProviderCatalog, useRegions} from '@/features/settings/public/streaming';
import type {
  clearLocalAccountData, deleteRemoteAccountData, importV1Again, pauseSync, prepareSignOut, resumeSync, startSync, syncNow, useSyncStatus, useV1ImportStatus,
} from '@/features/sync/public/sync';
import type {AvailabilityState, useAvailability} from '@/features/title/public/useAvailability';
import type {titleQueryOptions} from '@/features/title/public/titleQuery';
import type {useOpenMedia} from '@/features/title/public/useOpenMedia';
import type {AppRoot} from './public/AppRoot';
import type {AppTabBar} from './public/AppTabBar';
import type {RootErrorBoundary} from './public/RootErrorBoundary';
import type {prepareLocalState, startApp} from './start';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type Status = 'loading' | 'ready' | 'error';

export type SharedTypeContracts = [
  Expect<Equal<SectionName, 'watchlist' | 'diary' | 'lists' | 'recent' | 'preferences'>>,
  Expect<Equal<SyncFailure, 'offline' | 'denied' | 'server' | 'oversized' | 'newer-schema'>>,
  Expect<Equal<SyncStatus,
    | {state: 'signed-out'}
    | {state: 'idle' | 'syncing'; lastSyncedAt: number | null; pending: boolean}
    | {state: 'error'; failure: SyncFailure; sections: SectionName[]; lastSyncedAt: number | null; pending: boolean}
    | {state: 'deleted'}>>,
  Expect<Equal<SyncedStoreAccess<number>, {
    read(): {rev: number; state: number};
    apply(state: number, options: {dirty: boolean}): void;
    subscribe(listener: () => void): () => void;
    reset(): void;
  }>>,
  Expect<Equal<PreferencesSectionState, {values: Preferences; stamps: PreferenceStamps}>>,
];

export type ShellContracts = [
  Expect<Equal<typeof AppRoot, (props: {children: ReactNode}) => JSX.Element>>,
  Expect<Equal<typeof AppTabBar, (props: BottomTabBarProps) => JSX.Element>>,
  Expect<Equal<typeof RootErrorBoundary, (props: ErrorBoundaryProps) => JSX.Element>>,
  Expect<Equal<typeof prepareLocalState, () => true>>,
  Expect<Equal<typeof startApp, () => void>>,
];

export type SearchContracts = [
  Expect<Equal<typeof useGenres, () => {genres: readonly Genre[]; status: Status; retry(): void}>>,
  Expect<Equal<typeof HeaderSearch, () => JSX.Element>>,
];

export type TitleContracts = [
  Expect<Equal<typeof useOpenMedia, (surface: CardSurface) => (item: MediaCardItem) => void>>,
  Expect<Equal<AvailabilityState, {availability: RegionAvailability | null; status: Status; updatedAt: number | null; retry(): void}>>,
  Expect<Equal<typeof useAvailability, (key: TitleKey | null, region?: RegionCode) => AvailabilityState>>,
  Expect<Equal<Parameters<typeof titleQueryOptions>, [key: TitleKey, region: RegionCode]>>,
];

export type PlayerContracts = [
  Expect<Equal<TrailerFrameProps, {
    open: boolean;
    onClose: () => void;
    video: Video;
    title: string;
    titleKey: TitleKey;
    surface: 'title' | 'home';
    backdropPath?: string | null;
  }>>,
  Expect<Equal<typeof TrailerFrame, (props: TrailerFrameProps) => JSX.Element | null>>,
];

export type LibraryContracts = [
  Expect<Equal<ToggleResult, 'added' | 'removed' | 'full'>>,
  Expect<Equal<typeof useWatchlist, <T>(select: (entries: readonly LibraryEntry[]) => T, equals?: (a: T, b: T) => boolean) => T>>,
  Expect<Equal<typeof useInWatchlist, (key: EntryKey) => boolean>>,
  Expect<Equal<typeof toggleWatchlist, (key: EntryKey, snapshot: TitleSnapshot) => ToggleResult>>,
  Expect<Equal<typeof removeFromWatchlist, (key: EntryKey) => LibraryEntry | null>>,
  Expect<Equal<typeof restoreWatchlistEntry, (entry: LibraryEntry) => void>>,
  Expect<Equal<LogWatchInput, {key: EntryKey; snapshot: TitleSnapshot; watchedOn: string | null; rating: HalfStars | null; note: string; rewatch: boolean}>>,
  Expect<Equal<DiaryPatch, Partial<Pick<DiaryEntry, 'watchedOn' | 'rating' | 'note' | 'rewatch'>>>>,
  Expect<Equal<typeof useDiary, <T>(select: (entries: readonly DiaryEntry[]) => T, equals?: (a: T, b: T) => boolean) => T>>,
  Expect<Equal<typeof useWatched, (key: EntryKey) => {watched: boolean; latest: DiaryEntry | null; count: number}>>,
  Expect<Equal<typeof logWatch, (input: LogWatchInput) => DiaryEntry | 'full'>>,
  Expect<Equal<typeof updateEntry, (id: string, patch: DiaryPatch) => DiaryEntry | null>>,
  Expect<Equal<typeof removeEntry, (id: string) => DiaryEntry | null>>,
  Expect<Equal<typeof restoreEntry, (entry: DiaryEntry) => void>>,
  Expect<Equal<ListResult, {ok: true; list: UserList} | {ok: false; reason: 'empty' | 'duplicate' | 'max'}>>,
  Expect<Equal<typeof useLists, <T>(select: (lists: readonly UserList[]) => T, equals?: (a: T, b: T) => boolean) => T>>,
  Expect<Equal<typeof useList, (id: string) => UserList | null>>,
  Expect<Equal<typeof useCustomListCount, () => number>>,
  Expect<Equal<typeof createList, (name: string) => ListResult>>,
  Expect<Equal<typeof renameList, (id: string, name: string) => ListResult>>,
  Expect<Equal<typeof removeList, (id: string) => UserList | null>>,
  Expect<Equal<typeof restoreList, (list: UserList) => void>>,
  Expect<Equal<typeof setListItem, (id: string, key: EntryKey, snapshot: TitleSnapshot, included: boolean) => void>>,
  Expect<Equal<typeof useRecent, <T>(select: (entries: readonly (RecentEntry & {key: EntryKey})[]) => T, equals?: (a: T, b: T) => boolean) => T>>,
  Expect<Equal<typeof recordView, (key: TitleKey, snapshot: TitleSnapshot) => void>>,
  Expect<Equal<typeof removeRecent, (key: EntryKey) => RecentEntry | null>>,
  Expect<Equal<typeof restoreRecent, (key: EntryKey, entry: RecentEntry) => void>>,
  Expect<Equal<typeof clearRecent, () => RecentState>>,
  Expect<Equal<typeof restoreRecentState, (state: RecentState) => void>>,
  Expect<Equal<typeof migrateLocalV1, () => void>>,
  Expect<Equal<typeof startLegacyResolution, () => void>>,
  Expect<Equal<typeof retryLegacyResolution, () => void>>,
  Expect<Equal<typeof useLegacyMigrationStatus, () => {unresolved: number; noticeVisible: boolean; dismissNotice(): void}>>,
  Expect<Equal<LibraryTarget, {key: EntryKey; snapshot: TitleSnapshot}>>,
  Expect<Equal<typeof DiarySheet, (props: {open: boolean; onClose: () => void; target: LibraryTarget; entryId?: string | null; startNew?: boolean}) => JSX.Element | null>>,
  Expect<Equal<typeof AddToListSheet, (props: {open: boolean; onClose: () => void; target: LibraryTarget}) => JSX.Element | null>>,
];

export type SyncContracts = [
  Expect<Equal<typeof useSyncStatus, () => SyncStatus>>,
  Expect<Equal<typeof syncNow, () => void>>,
  Expect<Equal<typeof startSync, () => void>>,
  Expect<Equal<typeof prepareSignOut, (uid: string) => Promise<void>>>,
  Expect<Equal<typeof pauseSync, () => Promise<void>>>,
  Expect<Equal<typeof resumeSync, () => void>>,
  Expect<Equal<typeof deleteRemoteAccountData, (uid: string) => Promise<'ok' | 'failed'>>>,
  Expect<Equal<typeof clearLocalAccountData, (uid: string) => void>>,
  Expect<Equal<typeof useV1ImportStatus, () => {lastImportedAt: number | null; running: boolean}>>,
  Expect<Equal<typeof importV1Again, () => Promise<'ok' | 'failed'>>>,
];

export type AccountContracts = [
  Expect<Equal<typeof useSession, () => AuthSession>>,
  Expect<Equal<typeof getSession, () => AuthSession>>,
  Expect<Equal<typeof subscribeUid, (listener: (uid: string | null) => void) => () => void>>,
  Expect<Equal<typeof isNewUser, () => boolean>>,
  Expect<Equal<typeof signIn, () => Promise<boolean>>>,
  Expect<Equal<typeof onAccountDeleted, (listener: (uid: string) => Promise<void> | void) => () => void>>,
  Expect<Equal<typeof startSession, () => void>>,
  Expect<Equal<typeof signOut, () => Promise<void>>>,
  Expect<Equal<DeleteAccountResult, 'deleted' | 'cancelled' | 'failed' | 'incomplete'>>,
  Expect<Equal<typeof deleteAccount, () => Promise<DeleteAccountResult>>>,
];

export type SettingsContracts = [
  Expect<Equal<typeof usePreferences, <T>(select: (preferences: Preferences) => T, equals?: (a: T, b: T) => boolean) => T>>,
  Expect<Equal<typeof getPreferences, () => Preferences>>,
  Expect<Equal<typeof setPreference, <K extends keyof Preferences>(key: K, value: Preferences[K]) => void>>,
  Expect<Equal<typeof preferencesSyncAccess, SyncedStoreAccess<PreferencesSectionState>>>,
  Expect<Equal<typeof useEffectiveRegion, () => RegionCode>>,
  Expect<Equal<typeof getEffectiveRegion, () => RegionCode>>,
  Expect<Equal<typeof useRegionSource, () => 'manual' | 'locale' | 'geo' | 'default'>>,
  Expect<Equal<typeof startRegionDetection, () => void>>,
  Expect<Equal<typeof useRegions, () => {regions: readonly Region[]; status: Status; retry(): void}>>,
  Expect<Equal<typeof useProviderCatalog, (region: RegionCode) => {providers: readonly CatalogProvider[]; status: Status; retry(): void}>>,
  Expect<Equal<typeof useMyServices, (region: RegionCode) => readonly number[]>>,
  Expect<Equal<typeof setMyServices, (region: RegionCode, providerIds: readonly number[]) => void>>,
  Expect<Equal<typeof useConsent, () => Consent>>,
  Expect<Equal<typeof getConsent, () => Consent>>,
  Expect<Equal<typeof setConsent, (patch: Partial<Pick<Consent, 'analytics' | 'youtube'>>) => void>>,
  Expect<Equal<typeof isConsentPromptResolved, () => boolean>>,
  Expect<Equal<typeof subscribeConsent, (listener: () => void) => () => void>>,
  Expect<Equal<typeof startConsent, () => void>>,
  Expect<Equal<typeof ConsentPrompt, () => JSX.Element | null>>,
  Expect<Equal<typeof ServicesPickerSheet, (props: {open: boolean; onClose: () => void; region: RegionCode}) => JSX.Element | null>>,
  Expect<Equal<typeof CountryPickerSheet, (props: {open: boolean; onClose: () => void}) => JSX.Element | null>>,
];

export type MonetizationContracts = [
  Expect<Equal<PlusStatus, 'unknown' | 'free' | 'plus'>>,
  Expect<Equal<PlusStore, 'play_store' | 'rc_billing' | 'other'>>,
  Expect<Equal<EntitlementSnapshot, {
    active: boolean;
    productId: string | null;
    store: PlusStore | null;
    expiresAt: string | null;
    willRenew: boolean;
    billingIssue: boolean;
    managementUrl: string | null;
  }>>,
  Expect<Equal<Omit<PlusEntitlement, keyof EntitlementSnapshot>, {status: PlusStatus; source: 'none' | 'cache' | 'store'; appUserId: string | null; checkedAt: number | null}>>,
  Expect<Equal<PaywallPlacement, 'you_card' | 'plus_route' | 'list_limit' | 'insights' | 'ad_free_row' | 'accent_theme'>>,
  Expect<Equal<TitleOpenSource, 'tap' | 'deep_link'>>,
  Expect<Equal<OpenTitleInput, {
    source: TitleOpenSource;
    surface: CardSurface | 'deep_link';
    contentType: MediaType;
    contentId: number;
    title: string;
    posterPath: string | null;
  }>>,
  Expect<Equal<typeof PLUS_ENTITLEMENT, 'remove_ads'>>,
  Expect<Equal<typeof FREE_CUSTOM_LIST_LIMIT, 3>>,
  Expect<Equal<typeof usePlus, () => {status: PlusStatus; entitlement: PlusEntitlement; ensureKnown(): Promise<'free' | 'plus'>; openPaywall(placement: PaywallPlacement): void}>>,
  Expect<Equal<typeof getPlusStatus, () => PlusStatus>>,
  Expect<Equal<typeof openPaywall, (placement: PaywallPlacement) => void>>,
  Expect<Equal<typeof canCreateCustomList, (input: {customListCount: number; status: PlusStatus}) => {allowed: true} | {allowed: false; reason: 'limit'}>>,
  Expect<Equal<typeof effectiveAccent, <T extends string>(input: {stored: T; status: PlusStatus; fallback: T}) => T>>,
  Expect<Equal<typeof insightsAccess, (status: PlusStatus) => 'full' | 'teaser'>>,
  Expect<Equal<typeof startPlus, () => void>>,
  Expect<Equal<typeof openTitle, (navigate: () => void, input: OpenTitleInput) => void>>,
  Expect<Equal<typeof startAds, () => void>>,
  Expect<Equal<typeof reportTrailerState, (state: 'requested' | 'playing' | 'stopped') => void>>,
  Expect<Equal<typeof useAdPrivacyOptions, () => {required: boolean; show(): Promise<void>}>>,
  Expect<Equal<typeof PlusSheetHost, () => JSX.Element | null>>,
  Expect<Equal<typeof AdTransitionHost, () => JSX.Element | null>>,
];

export type PlatformContracts = [
  Expect<Equal<typeof auth, AuthAdapter>>,
  Expect<Equal<typeof startStoreUpdates, () => void>>,
  Expect<Equal<typeof setPlayerOpen, (open: boolean) => void>>,
  Expect<Equal<typeof usePlayerOpen, () => boolean>>,
];
