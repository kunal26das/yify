import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useRef, useState} from 'react';
import {Analytics} from '@/presentation/analytics/events';
import {
    ActivityIndicator,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Platform,
    ScrollView,
    type StyleProp,
    StyleSheet,
    Switch,
    type TextStyle,
    View,
} from 'react-native';
import Animated, {LayoutAnimationConfig} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
    type BrowseDefaults,
    DEFAULT_BROWSE_DEFAULTS,
    type NotificationPreferences,
    Quality,
    type ThemePreference,
} from '@/domain';
import {useConfirm} from '../components/confirm-dialog';
import {Duration, enterFade, enterRise, exitFade, PressableScale} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {
    GENRE_OPTIONS,
    ORDER_OPTIONS,
    QUALITY_OPTIONS,
    RATING_OPTIONS,
    SORT_BY_OPTIONS,
} from './constants/movieFilterLabels';
import {HOUR_OPTIONS} from './constants/quietHours';
import * as WebBrowser from 'expo-web-browser';
import {openPlayStore, PlayStoreButton} from './components/PlayStoreButton';
import {ChipBar} from './components/ChipBar';
import {useTopBarHeight} from './components/TopBar';
import {type PreferencesViewModel, usePreferencesViewModel} from './usePreferencesViewModel';
import {useAuth} from '../hooks/use-auth';
import {usePurchases} from '../hooks/use-purchases';
import {useSyncStatus} from '../hooks/use-sync-status';
import {
    useAccountSync,
    useAdGateway,
    useAppConfig,
    useAuthRepository,
    usePurchaseRepository,
} from '../di/DependenciesContext';

type Colors = ReturnType<typeof usePalette>['colors'];

function switchColors(colors: Colors, on: boolean): React.ComponentProps<typeof Switch> {
    const thumb = on ? colors.onAccent : colors.surface;
    return {
        trackColor: {true: colors.accent, false: colors.surfaceSunken},
        thumbColor: thumb,
        ios_backgroundColor: colors.surfaceSunken,
        ...(Platform.OS === 'web'
            ? {activeThumbColor: thumb, activeTrackColor: colors.accent}
            : {}),
    } as React.ComponentProps<typeof Switch>;
}
type Glyph = keyof typeof Ionicons.glyphMap;
type NotifyDisclosureKey = 'quality' | 'minimumRating' | 'genre' | 'quietStartHour' | 'quietEndHour';
type DisclosureKey = 'theme' | `browse.${keyof BrowseDefaults}` | `notify.${NotifyDisclosureKey}`;

interface OptionRow<K> {
    key: K;
    icon: Glyph;
    title: string;
    options: {value: string | number; label: string}[];
}

type BrowseRow = OptionRow<keyof BrowseDefaults>;
type NotifyRow = OptionRow<NotifyDisclosureKey>;

interface PlaybackRow {
    key: 'autoplayTrailers' | 'trailerCaptions' | 'autoplayNext' | 'miniPlayer';
    icon: Glyph;
    title: string;
    subtitle: string;
}

const PLAYBACK_ROWS: PlaybackRow[] = [
    {
        key: 'autoplayTrailers',
        icon: 'film-outline',
        title: 'Autoplay trailers',
        subtitle: 'Roll the trailer behind the hero banner a moment after it settles.',
    },
    {
        key: 'trailerCaptions',
        icon: 'text-outline',
        title: 'Trailer captions',
        subtitle: 'Turn YouTube subtitles on whenever a trailer starts.',
    },
    {
        key: 'autoplayNext',
        icon: 'play-forward-outline',
        title: 'Autoplay next',
        subtitle: 'When a trailer ends, roll on to the next one in the list.',
    },
    {
        key: 'miniPlayer',
        icon: 'albums-outline',
        title: 'Mini player',
        subtitle: 'Keep a trailer playing in the corner after you leave its page.',
    },
];

const NOTIFY_ROWS: NotifyRow[] = [
    {key: 'quality', icon: 'tv-outline', title: 'Quality', options: QUALITY_OPTIONS},
    {key: 'minimumRating', icon: 'star-outline', title: 'Minimum rating', options: RATING_OPTIONS},
    {key: 'genre', icon: 'pricetags-outline', title: 'Genre', options: GENRE_OPTIONS},
];

const QUIET_ROWS: NotifyRow[] = [
    {key: 'quietStartHour', icon: 'moon-outline', title: 'Quiet from', options: HOUR_OPTIONS},
    {key: 'quietEndHour', icon: 'sunny-outline', title: 'Quiet until', options: HOUR_OPTIONS},
];

const WEBSITE_URL = 'https://kunal26das.github.io/yify';

const GLYPH_SIZE = 22;
const GLYPH_GAP = Spacing.md;

const THEME_OPTIONS: {value: ThemePreference; label: string; icon: Glyph}[] = [
    {value: 'system', label: 'System', icon: 'phone-portrait-outline'},
    {value: 'light', label: 'Light', icon: 'sunny-outline'},
    {value: 'dark', label: 'Dark', icon: 'moon-outline'},
];

type SectionKey = 'browse' | 'playback' | 'notifications' | 'search' | 'watchlist' | 'about';

const SECTION_ROWS: Partial<Record<SectionKey, string>> = {
    browse: 'browse.',
    notifications: 'notify.',
};

function labelOf(
    options: readonly {value: string | number; label: string}[],
    value: string | number
): string {
    return (options.find((option) => option.value === value) ?? options[0]).label;
}



export function PreferencesScreen({viewModel}: {viewModel?: PreferencesViewModel} = {}) {
    const fallback = usePreferencesViewModel();
    const vm = viewModel ?? fallback;

    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {gutter, contentMaxWidth} = useResponsive();
    const navHeight = useTopBarHeight();
    const {account} = useAuth();
    const confirm = useConfirm();

    const [open, setOpen] = useState<DisclosureKey | null>(null);
    const [sections, setSections] = useState<Partial<Record<SectionKey, boolean>>>({});

    const scrollRef = useRef<ScrollView | null>(null);
    const pending = useRef<SectionKey | null>(null);
    const offsetY = useRef(0);
    const viewport = useRef(0);

    const toggleGroup = (key: DisclosureKey) => setOpen((current) => (current === key ? null : key));

    const theme = THEME_OPTIONS.find((option) => option.value === vm.theme) ?? THEME_OPTIONS[0];

    const browseRows: BrowseRow[] = [
        {key: 'sort_by', icon: 'swap-vertical-outline', title: 'Sort by', options: SORT_BY_OPTIONS},
        {key: 'order_by', icon: 'funnel-outline', title: 'Order', options: ORDER_OPTIONS},
        {key: 'quality', icon: 'tv-outline', title: 'Quality', options: QUALITY_OPTIONS},
        {key: 'genre', icon: 'pricetags-outline', title: 'Genre', options: GENRE_OPTIONS},
        {key: 'minimum_rating', icon: 'star-outline', title: 'Minimum rating', options: RATING_OPTIONS},
    ];

    const confirmClear = () => {
        const count = vm.watchlistCount;
        const where = account ? ' on this device and in your account' : '';
        confirm({
            title: 'Clear Watchlist?',
            message: `This removes ${count} ${count === 1 ? 'title' : 'titles'} from Watchlist${where}. This can't be undone.`,
            confirmLabel: 'Clear',
            icon: 'trash-outline',
            onConfirm: vm.clearList,
        });
    };

    const closeIfOpen = (keys: DisclosureKey[]) =>
        setOpen((current) => (current && keys.includes(current) ? null : current));

    const closeRows = (key: SectionKey) => {
        const prefix = SECTION_ROWS[key];
        if (prefix) setOpen((current) => (current?.startsWith(prefix) ? null : current));
    };

    const onToggleNotifications = (next: boolean) => {
        if (!next) closeRows('notifications');
        void vm.toggleNotifications(next);
    };

    const onToggleQuietHours = (next: boolean) => {
        if (!next) closeIfOpen(['notify.quietStartHour', 'notify.quietEndHour']);
        vm.setNotificationPreference('quietHours', next);
    };

    const toggleSection = (key: SectionKey) => {
        const next = sections[key] !== true;
        if (next) pending.current = key;
        else closeRows(key);
        setSections((current) => ({...current, [key]: next}));
    };

    const reveal = (key: SectionKey, y: number, height: number) => {
        if (pending.current !== key) return;
        pending.current = null;
        const scroller = scrollRef.current;
        if (!scroller || viewport.current <= 0) return;
        if (y + height <= offsetY.current + viewport.current) return;
        scroller.scrollTo({y: Math.max(0, y - navHeight - Spacing.sm), animated: true});
    };

    const sectionProps = (key: SectionKey, index: number, title: string) => ({
        title,
        index,
        colors,
        gutter,
        expanded: sections[key] === true,
        onToggle: () => toggleSection(key),
        onLayout: (event: LayoutChangeEvent) => {
            const {y, height} = event.nativeEvent.layout;
            reveal(key, y, height);
        },
    });

    const changedBrowse = browseRows.filter(
        (row) => vm.browseDefaults[row.key] !== DEFAULT_BROWSE_DEFAULTS[row.key]
    );
    const browseSummary =
        changedBrowse.length === 0
            ? 'Default'
            : changedBrowse.length === 1
              ? labelOf(changedBrowse[0].options, vm.browseDefaults[changedBrowse[0].key])
              : `${changedBrowse.length} changed`;

    const playbackOn = PLAYBACK_ROWS.filter((row) => vm.playback[row.key]).length;
    const playbackSummary =
        playbackOn === 0
            ? 'Off'
            : playbackOn === PLAYBACK_ROWS.length
              ? 'All on'
              : `${playbackOn} of ${PLAYBACK_ROWS.length} on`;

    const notifyBlocked = vm.notifications && vm.permissionBlocked;
    const notifySummary = !vm.notifications
        ? 'Off'
        : notifyBlocked
          ? 'Blocked'
          : vm.notify.quality === Quality.All
            ? 'On'
            : `On \u00b7 ${labelOf(QUALITY_OPTIONS, vm.notify.quality)}`;

    const searchSummary =
        vm.searchHistoryCount === 0 ? 'None' : `${vm.searchHistoryCount} recent`;

    const watchlistSummary =
        vm.watchlistCount === 0
            ? 'Empty'
            : `${vm.watchlistCount} ${vm.watchlistCount === 1 ? 'title' : 'titles'}`;

    return (
        <Screen>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{
                    paddingTop: navHeight,
                    paddingBottom: insets.bottom + 48,
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                    width: '100%',
                }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onLayout={(event) => {
                    viewport.current = event.nativeEvent.layout.height;
                }}
                onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
                    offsetY.current = event.nativeEvent.contentOffset.y;
                }}
            >
                <AccountSection colors={colors} gutter={gutter}/>

                <SupporterSection colors={colors} gutter={gutter}/>

                <SectionHeader title="General" colors={colors} gutter={gutter} index={2}/>

                <Group colors={colors} index={2}>
                    <ChoiceRow
                        icon={theme.icon}
                        title="Theme"
                        value={vm.theme}
                        options={THEME_OPTIONS}
                        expanded={open === 'theme'}
                        colors={colors}
                        gutter={gutter}
                        onToggle={() => toggleGroup('theme')}
                        onSelect={(value) => {
                            vm.selectTheme(value as ThemePreference);
                            setOpen(null);
                        }}
                    />
                </Group>

                <SettingsSection
                    {...sectionProps('browse', 3, 'Browse defaults')}
                    summary={browseSummary}
                >
                    {browseRows.map((row) => (
                        <ChoiceRow
                            key={row.key}
                            icon={row.icon}
                            title={row.title}
                            value={vm.browseDefaults[row.key]}
                            options={row.options}
                            expanded={open === `browse.${row.key}`}
                            colors={colors}
                            gutter={gutter}
                            onToggle={() => toggleGroup(`browse.${row.key}`)}
                            onSelect={(value) => {
                                vm.setBrowseDefault(row.key, value);
                                setOpen(null);
                            }}
                        />
                    ))}
                </SettingsSection>

                <SettingsSection
                    {...sectionProps('playback', 4, 'Playback')}
                    summary={playbackSummary}
                >
                    {PLAYBACK_ROWS.map((row) => (
                        <Row
                            key={row.key}
                            icon={row.icon}
                            title={row.title}
                            subtitle={row.subtitle}
                            colors={colors}
                            gutter={gutter}
                            trailing={
                                <Switch
                                    value={vm.playback[row.key]}
                                    onValueChange={(value) => vm.setPlaybackPreference(row.key, value)}
                                    accessibilityLabel={row.title}
                                    {...switchColors(colors, vm.playback[row.key])}
                                />
                            }
                        />
                    ))}
                </SettingsSection>

                <SettingsSection
                    {...sectionProps('notifications', 5, 'Notifications')}
                    summary={notifySummary}
                    tone={notifyBlocked ? colors.gold : undefined}
                >
                    <Row
                        icon="notifications-outline"
                        title="New releases"
                        subtitle="A daily check for titles added since you last looked."
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <Switch
                                value={vm.notifications}
                                onValueChange={onToggleNotifications}
                                accessibilityLabel="New releases"
                                {...switchColors(colors, vm.notifications)}
                            />
                        }
                    />
                    {vm.notifications && vm.permissionBlocked ? (
                        <Animated.View
                            entering={enterRise()}
                            style={[styles.notice, {paddingLeft: gutter + GLYPH_SIZE + GLYPH_GAP, paddingRight: gutter}]}
                        >
                            <Ionicons name="warning-outline" size={15} color={colors.gold}/>
                            <ThemedText style={[styles.subtitle, styles.noticeText, {color: colors.textMuted}]}>
                                {Platform.OS === 'web'
                                    ? 'Your browser is blocking notifications for this site. Allow them in its site settings and this will start working.'
                                    : 'Notifications are turned off for Yify in your device settings. Allow them there and this will start working.'}
                            </ThemedText>
                        </Animated.View>
                    ) : null}
                    {vm.notifications ? (
                        <Animated.View entering={enterRise()} exiting={exitFade}>
                            {NOTIFY_ROWS.map((row) => (
                                <ChoiceRow
                                    key={row.key}
                                    icon={row.icon}
                                    title={row.title}
                                    value={vm.notify[row.key]}
                                    options={row.options}
                                    expanded={open === `notify.${row.key}`}
                                    colors={colors}
                                    gutter={gutter}
                                    accessibilityLabel={`Notification ${row.title.toLowerCase()}`}
                                    onToggle={() => toggleGroup(`notify.${row.key}`)}
                                    onSelect={(value) => {
                                        vm.setNotificationPreference(
                                            row.key,
                                            value as NotificationPreferences[typeof row.key]
                                        );
                                        setOpen(null);
                                    }}
                                />
                            ))}
                            <Row
                                icon="moon-outline"
                                title="Quiet hours"
                                subtitle={
                                    Platform.OS === 'web'
                                        ? 'Hold alerts overnight. They arrive the next time you open Yify after the window.'
                                        : 'Hold alerts overnight and deliver them when the window ends.'
                                }
                                colors={colors}
                                gutter={gutter}
                                trailing={
                                    <Switch
                                        value={vm.notify.quietHours}
                                        onValueChange={onToggleQuietHours}
                                        accessibilityLabel="Quiet hours"
                                        {...switchColors(colors, vm.notify.quietHours)}
                                    />
                                }
                            />
                            {vm.notify.quietHours ? (
                                <Animated.View entering={enterRise()} exiting={exitFade}>
                                    {QUIET_ROWS.map((row) => (
                                        <ChoiceRow
                                            key={row.key}
                                            icon={row.icon}
                                            title={row.title}
                                            value={vm.notify[row.key]}
                                            options={row.options}
                                            expanded={open === `notify.${row.key}`}
                                            colors={colors}
                                            gutter={gutter}
                                            onToggle={() => toggleGroup(`notify.${row.key}`)}
                                            onSelect={(value) => {
                                                vm.setNotificationPreference(
                                                    row.key,
                                                    value as NotificationPreferences[typeof row.key]
                                                );
                                                setOpen(null);
                                            }}
                                        />
                                    ))}
                                </Animated.View>
                            ) : null}
                            <Row
                                icon="list-outline"
                                title="One alert per title"
                                subtitle="A separate notification for each new title instead of one summary."
                                colors={colors}
                                gutter={gutter}
                                trailing={
                                    <Switch
                                        value={vm.notify.perTitle}
                                        onValueChange={(value) =>
                                            vm.setNotificationPreference('perTitle', value)
                                        }
                                        accessibilityLabel="One alert per title"
                                        {...switchColors(colors, vm.notify.perTitle)}
                                    />
                                }
                            />
                        </Animated.View>
                    ) : null}
                </SettingsSection>

                <SettingsSection {...sectionProps('search', 6, 'Search')} summary={searchSummary}>
                    <Row
                        icon="time-outline"
                        title={`${vm.searchHistoryCount} recent ${vm.searchHistoryCount === 1 ? 'search' : 'searches'}`}
                        subtitle="Kept on this device. Never synced to your account."
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <PressableScale
                                disabled={vm.searchHistoryCount === 0}
                                onPress={vm.clearSearchHistory}
                                accessibilityRole="button"
                                accessibilityLabel="Clear search history"
                                pressedScale={0.93}
                                pressedOpacity={0.7}
                                hoveredScale={1.04}
                                contentStyle={[
                                    styles.dangerButton,
                                    {
                                        borderColor: colors.border,
                                        opacity: vm.searchHistoryCount === 0 ? 0.4 : 1,
                                    },
                                ]}
                            >
                                <ThemedText style={[styles.dangerLabel, {color: colors.peer}]}>Clear</ThemedText>
                            </PressableScale>
                        }
                    />
                </SettingsSection>

                <SettingsSection
                    {...sectionProps('watchlist', 7, 'Watchlist')}
                    summary={watchlistSummary}
                >
                    <Row
                        icon="bookmark-outline"
                        title={`${vm.watchlistCount} ${vm.watchlistCount === 1 ? 'title' : 'titles'} saved`}
                        subtitle={
                            account
                                ? 'Kept on this device and synced to your account.'
                                : 'Kept on this device. Sign in to sync it to your account.'
                        }
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <PressableScale
                                disabled={vm.watchlistCount === 0}
                                onPress={confirmClear}
                                accessibilityRole="button"
                                accessibilityLabel="Clear Watchlist"
                                pressedScale={0.93}
                                pressedOpacity={0.7}
                                hoveredScale={1.04}
                                contentStyle={[
                                    styles.dangerButton,
                                    {
                                        borderColor: colors.border,
                                        opacity: vm.watchlistCount === 0 ? 0.4 : 1,
                                    },
                                ]}
                            >
                                <ThemedText style={[styles.dangerLabel, {color: colors.peer}]}>Clear</ThemedText>
                            </PressableScale>
                        }
                    />
                    {vm.listCleared && vm.watchlistCount === 0 ? (
                        <Animated.View
                            entering={enterFade()}
                            style={{paddingLeft: gutter + GLYPH_SIZE + GLYPH_GAP, paddingRight: gutter}}
                        >
                            <ThemedText style={[styles.subtitle, {color: colors.textMuted}]}>Cleared.</ThemedText>
                        </Animated.View>
                    ) : null}
                    <Row
                        icon="help-circle-outline"
                        title="Confirm removals"
                        subtitle="Ask before the ✕ on a poster removes a title."
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <Switch
                                value={vm.confirmWatchlistRemoval}
                                onValueChange={vm.toggleConfirmWatchlistRemoval}
                                accessibilityLabel="Confirm removals"
                                {...switchColors(colors, vm.confirmWatchlistRemoval)}
                            />
                        }
                    />
                </SettingsSection>

                <SettingsSection {...sectionProps('about', 8, 'About')} summary={vm.appInfo.version}>
                    <Row
                        icon="information-circle-outline"
                        title="Version"
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <ThemedText style={[styles.value, {color: colors.textMuted}]}>
                                {vm.appInfo.version}
                            </ThemedText>
                        }
                    />
                    {Platform.OS === 'android' ? (
                        <Row
                            icon="star-outline"
                            title="Rate on Google Play"
                            subtitle="A rating helps other people find Yify."
                            colors={colors}
                            gutter={gutter}
                            onPress={() => void openPlayStore('settings')}
                            accessibilityRole="link"
                            accessibilityLabel="Rate on Google Play"
                            trailing={<Ionicons name="open-outline" size={18} color={colors.textMuted}/>}
                        />
                    ) : (
                        <Row
                            icon="logo-google-playstore"
                            title="Android app"
                            colors={colors}
                            gutter={gutter}
                            trailing={<PlayStoreButton source="settings"/>}
                        />
                    )}
                    {Platform.OS !== 'web' ? (
                        <Row
                            icon="globe-outline"
                            title="Open Yify on the web"
                            subtitle={WEBSITE_URL.replace('https://', '')}
                            colors={colors}
                            gutter={gutter}
                            onPress={() => {
                                Analytics.websiteOpen('settings');
                                void WebBrowser.openBrowserAsync(WEBSITE_URL, {enableBarCollapsing: true});
                            }}
                            accessibilityRole="link"
                            accessibilityLabel="Open Yify on the web"
                            trailing={<Ionicons name="open-outline" size={18} color={colors.textMuted}/>}
                        />
                    ) : null}
                </SettingsSection>
            </ScrollView>
        </Screen>
    );
}

const AVATAR_SIZE = 30;

function SyncRow({colors, gutter}: {colors: Colors; gutter: number}) {
    const status = useSyncStatus();
    const accountSync = useAccountSync();

    if (status.state !== 'error') return null;

    return (
        <Row
            icon="cloud-offline-outline"
            title="Sync failed"
            subtitle={status.detail ?? undefined}
            colors={colors}
            gutter={gutter}
            onPress={() => accountSync.syncNow()}
            accessibilityLabel="Retry sync"
            trailing={
                <ThemedText style={[styles.value, {color: colors.accent}]}>Retry</ThemedText>
            }
        />
    );
}

function AccountSection({colors, gutter}: {colors: Colors; gutter: number}) {
    const {ready, available, signingIn, account, error} = useAuth();
    const auth = useAuthRepository();
    const accountSync = useAccountSync();
    const confirm = useConfirm();
    const [deleting, setDeleting] = useState(false);

    const unavailable = ready && !available;

    const signOut = () => {
        Analytics.signOut();
        void auth.signOut();
    };

    const runDelete = async () => {
        setDeleting(true);
        const cleared = await accountSync.deleteRemote();
        if (!cleared) {
            setDeleting(false);
            Analytics.accountDeleteFailed('sync');
            return;
        }
        const deleted = await auth.deleteAccount();
        setDeleting(false);
        if (deleted) Analytics.accountDeleted();
        else Analytics.accountDeleteFailed('auth');
    };

    const confirmDelete = () => {
        confirm({
            title: 'Delete account?',
            message:
                'This permanently deletes your account and the watchlist, history and settings synced to it. Titles saved on this device stay until you clear them.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            icon: 'trash-outline',
            destructive: true,
            onConfirm: () => void runDelete(),
        });
    };

    return (
        <>
            <SectionHeader title="Account" colors={colors} gutter={gutter} index={0}/>
            <Group colors={colors} index={0}>
                {account ? (
                    <>
                    <Row
                        leading={
                            account.photoUrl ? (
                                <Image
                                    source={{uri: account.photoUrl}}
                                    style={[styles.avatar, {backgroundColor: colors.surfaceSunken}]}
                                    contentFit="cover"
                                    transition={160}
                                    cachePolicy="memory-disk"
                                />
                            ) : (
                                <Ionicons
                                    name="person-outline"
                                    size={GLYPH_SIZE}
                                    color={colors.textMuted}
                                />
                            )
                        }
                        title={account.name ?? 'Signed in'}
                        subtitle={account.email ?? undefined}
                        colors={colors}
                        gutter={gutter}
                        onPress={signOut}
                        accessibilityLabel="Sign out"
                        trailing={
                            <ThemedText style={[styles.value, {color: colors.accent}]}>Sign out</ThemedText>
                        }
                    />
                    <SyncRow colors={colors} gutter={gutter}/>
                    <Row
                        icon="trash-outline"
                        title="Delete account"
                        subtitle="Removes your account and everything synced to it."
                        colors={colors}
                        gutter={gutter}
                        onPress={deleting ? undefined : confirmDelete}
                        accessibilityLabel="Delete account"
                        trailing={
                            deleting ? (
                                <ActivityIndicator color={colors.accent}/>
                            ) : (
                                <ThemedText style={[styles.value, {color: colors.peer}]}>Delete</ThemedText>
                            )
                        }
                    />
                    </>
                ) : (
                    <Row
                        icon="logo-google"
                        title="Sign in with Google"
                        subtitle={
                            unavailable
                                ? (error ?? 'Sign-in is unavailable in this build.')
                                : 'Syncs your watchlist and settings across your devices.'
                        }
                        colors={colors}
                        gutter={gutter}
                        onPress={signingIn || unavailable ? undefined : () => void auth.signIn()}
                        accessibilityLabel="Sign in with Google"
                        accessibilityState={{disabled: unavailable}}
                        trailing={
                            signingIn ? (
                                <ActivityIndicator color={colors.accent}/>
                            ) : unavailable ? null : (
                                <Ionicons name="chevron-forward" size={16} color={colors.textMuted}/>
                            )
                        }
                    />
                )}
            </Group>
        </>
    );
}

function SupporterSection({colors, gutter}: {colors: Colors; gutter: number}) {
    const purchases = usePurchaseRepository();
    const ads = useAdGateway();
    const state = usePurchases();
    const {account, signingIn, available: canSignIn} = useAuth();
    const auth = useAuthRepository();
    const confirm = useConfirm();
    const config = useAppConfig();

    const offer = state.offers.length > 0 ? state.offers[0] : null;
    const terms = offer?.recurring ? 'billed monthly until you cancel' : 'one payment, nothing renews';
    const sellable = state.available && (state.adsRemoved || offer != null);
    const coffeeUrl = config.getSupportUrl();
    const showCoffee = coffeeUrl.startsWith('https://');
    const adsLive = ads.supported && config.getAdsEnabled();
    const billing = offer?.recurring ? 'A monthly subscription' : 'One payment';

    const notice = (title: string, message: string, icon: Glyph) =>
        confirm({
            title,
            message,
            confirmLabel: 'OK',
            icon,
            destructive: false,
            onConfirm: () => undefined,
        });

    const buy = () => {
        if (offer == null || account == null || state.purchasing != null) return;
        Analytics.supporterPrompt('settings');
        confirm({
            title: 'Support Yify',
            message: adsLive
                ? `Yify is built by one person. ${offer.priceLabel}, ${terms}. It turns off the ads in Yify on every device you sign in on. Trailers still play YouTube's own ads, which no app can remove.`
                : `Yify is built by one person and has no ads today. ${offer.priceLabel}, ${terms}. It carries across every device you sign in on, and if ads are ever switched on they will never apply to you.`,
            confirmLabel: `Support \u00b7 ${offer.priceLabel}`,
            cancelLabel: 'Not now',
            icon: 'heart-outline',
            destructive: false,
            onConfirm: () => {
                void purchases.purchase(offer.id).then((granted) => {
                    if (granted) return;
                    const reason = purchases.getState().failure;
                    if (reason == null || reason === 'cancelled') return;
                    if (reason === 'already_purchased') {
                        notice(
                            'Already a supporter',
                            'This account has already supported Yify. It will come back on this device on its own \u2014 give it a moment.',
                            'information-circle-outline'
                        );
                        return;
                    }
                    if (reason === 'pending') {
                        notice(
                            'Payment pending',
                            'Your payment is still being processed. It will apply on its own once it clears \u2014 no need to pay again.',
                            'time-outline'
                        );
                        return;
                    }
                    if (reason === 'not_granted') {
                        notice(
                            'Not applied yet',
                            'The payment went through but has not applied yet. It should arrive shortly \u2014 reopen Yify if it does not.',
                            'alert-circle-outline'
                        );
                        return;
                    }
                    notice(
                        'Payment failed',
                        'We could not complete the payment. If you were charged, it will apply on its own once the store confirms it.',
                        'alert-circle-outline'
                    );
                });
            },
        });
    };

    if (!sellable && !showCoffee && !ads.privacyOptionsRequired()) return null;

    return (
        <>
            <SectionHeader title="Yify" colors={colors} gutter={gutter} index={1}/>
            <Group colors={colors} index={1}>
                {!sellable ? null : state.adsRemoved ? (
                    <Row
                        icon="heart"
                        title="You support Yify"
                        subtitle={
                            adsLive
                                ? 'Thank you. The ads in Yify are off for you, on every device you sign in on.'
                                : 'Thank you. This carries across every device you sign in on.'
                        }
                        colors={colors}
                        gutter={gutter}
                        trailing={<Ionicons name="checkmark" size={18} color={colors.accent}/>}
                    />
                ) : account == null ? (
                    <Row
                        icon="heart-outline"
                        title="Support Yify"
                        subtitle={
                            canSignIn
                                ? 'Sign in first, then your support carries across every device you use.'
                                : 'Sign-in is unavailable in this build.'
                        }
                        colors={colors}
                        gutter={gutter}
                        onPress={signingIn || !canSignIn ? undefined : () => void auth.signIn()}
                        accessibilityLabel="Sign in to support Yify"
                        accessibilityState={{disabled: !canSignIn}}
                        trailing={
                            signingIn ? (
                                <ActivityIndicator color={colors.accent}/>
                            ) : offer ? (
                                <ThemedText style={[styles.value, {color: colors.accent}]}>
                                    {offer.priceLabel}
                                </ThemedText>
                            ) : null
                        }
                    />
                ) : (
                    <Row
                        icon="heart-outline"
                        title="Support Yify"
                        subtitle={
                            adsLive
                                ? `Built by one person. ${billing} to turn off the ads in Yify, on every device you sign in on.`
                                : `Built by one person, with no ads. ${billing}, on every device you sign in on.`
                        }
                        colors={colors}
                        gutter={gutter}
                        onPress={state.purchasing == null ? buy : undefined}
                        accessibilityLabel="Support Yify"
                        trailing={
                            state.purchasing != null ? (
                                <ActivityIndicator color={colors.accent}/>
                            ) : offer ? (
                                <ThemedText style={[styles.value, {color: colors.accent}]}>
                                    {offer.priceLabel}
                                </ThemedText>
                            ) : null
                        }
                    />
                )}
                {showCoffee ? (
                    <Row
                        icon="cafe-outline"
                        title="Buy me a coffee"
                        subtitle="A one-off tip, outside the app. It unlocks nothing — it just says thanks."
                        colors={colors}
                        gutter={gutter}
                        onPress={() => {
                            Analytics.coffeeOpen('settings');
                            void WebBrowser.openBrowserAsync(coffeeUrl, {enableBarCollapsing: true});
                        }}
                        accessibilityRole="link"
                        accessibilityLabel="Buy me a coffee"
                        trailing={<Ionicons name="open-outline" size={18} color={colors.textMuted}/>}
                    />
                ) : null}
                {ads.privacyOptionsRequired() ? (
                    <Row
                        icon="shield-checkmark-outline"
                        title="Ad privacy choices"
                        subtitle="Change how ads are personalised for you."
                        colors={colors}
                        gutter={gutter}
                        onPress={() => void ads.showPrivacyOptions()}
                        accessibilityLabel="Ad privacy choices"
                        trailing={<Ionicons name="chevron-forward" size={16} color={colors.textMuted}/>}
                    />
                ) : null}
            </Group>
        </>
    );
}

function SectionHeader({
                           title,
                           colors,
                           gutter,
                           index = 0,
                       }: {
    title: string;
    colors: Colors;
    gutter: number;
    index?: number;
}) {
    return (
        <Animated.View
            entering={enterRise(index)}
            style={[styles.sectionHeader, {paddingHorizontal: gutter}]}
        >
            <ThemedText style={[styles.sectionTitle, {color: colors.textMuted}]}>{title}</ThemedText>
        </Animated.View>
    );
}

function Group({
                   colors,
                   children,
                   index = 0,
                   onLayout,
               }: {
    colors: Colors;
    children: React.ReactNode;
    index?: number;
    onLayout?: (event: LayoutChangeEvent) => void;
}) {
    return (
        <Animated.View
            entering={enterRise(index)}
            onLayout={onLayout}
            style={[styles.group, {borderBottomColor: colors.border}]}
        >
            {children}
        </Animated.View>
    );
}

function Row({
                 icon,
                 leading,
                 title,
                 titleStyle,
                 subtitle,
                 trailing,
                 colors,
                 gutter,
                 onPress,
                 accessibilityRole = 'button',
                 accessibilityLabel,
                 accessibilityState,
             }: {
    icon?: Glyph;
    leading?: React.ReactNode;
    title: string;
    titleStyle?: StyleProp<TextStyle>;
    subtitle?: string;
    trailing?: React.ReactNode;
    colors: Colors;
    gutter: number;
    onPress?: () => void;
    accessibilityRole?: 'button' | 'link';
    accessibilityLabel?: string;
    accessibilityState?: {expanded?: boolean; selected?: boolean; disabled?: boolean};
}) {
    const content = (
        <>
            {leading ?? (icon ? <Ionicons name={icon} size={GLYPH_SIZE} color={colors.textMuted}/> : null)}
            <View style={styles.rowText}>
                <ThemedText style={[styles.rowTitle, titleStyle, {color: colors.text}]}>{title}</ThemedText>
                {subtitle ? (
                    <ThemedText style={[styles.subtitle, {color: colors.textMuted}]}>{subtitle}</ThemedText>
                ) : null}
            </View>
            {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        </>
    );

    if (!onPress) {
        return <View style={[styles.row, {paddingHorizontal: gutter}]}>{content}</View>;
    }

    return (
        <PressableScale
            onPress={onPress}
            accessibilityRole={accessibilityRole}
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
            aria-expanded={accessibilityState?.expanded}
            aria-disabled={accessibilityState?.disabled}
            pressedScale={0.99}
            pressedOpacity={0.6}
            lift={1}
            contentStyle={[styles.row, {paddingHorizontal: gutter}]}
        >
            {content}
        </PressableScale>
    );
}

function ChoiceRow({
                       icon,
                       title,
                       value,
                       options,
                       expanded,
                       colors,
                       gutter,
                       accessibilityLabel,
                       onToggle,
                       onSelect,
                   }: {
    icon: Glyph;
    title: string;
    value: string | number;
    options: readonly {value: string | number; label: string}[];
    expanded: boolean;
    colors: Colors;
    gutter: number;
    accessibilityLabel?: string;
    onToggle: () => void;
    onSelect: (value: string | number) => void;
}) {
    const current = options.find((option) => option.value === value) ?? options[0];

    return (
        <>
            <Row
                icon={icon}
                title={title}
                colors={colors}
                gutter={gutter}
                onPress={onToggle}
                accessibilityLabel={accessibilityLabel ?? title}
                accessibilityState={{expanded}}
                trailing={<Disclosure value={current.label} expanded={expanded} colors={colors}/>}
            />
            {expanded ? (
                <Animated.View entering={enterFade()} exiting={exitFade} style={styles.options}>
                    <ChipBar
                        chips={options.map((option) => ({
                            key: String(option.value),
                            label: option.label,
                        }))}
                        active={String(value)}
                        onSelect={(key) => {
                            const picked = options.find((option) => String(option.value) === key);
                            if (picked) onSelect(picked.value);
                        }}
                        contentPadding={gutter}
                    />
                </Animated.View>
            ) : null}
        </>
    );
}

function Disclosure({
                        value,
                        expanded,
                        colors,
                        tone,
                    }: {
    value: string;
    expanded: boolean;
    colors: Colors;
    tone?: string;
}) {
    return (
        <View style={styles.disclosure}>
            <ThemedText style={[styles.value, {color: tone ?? colors.textMuted}]} numberOfLines={1}>
                {value}
            </ThemedText>
            <Animated.View
                style={{
                    transform: [{rotate: expanded ? '180deg' : '0deg'}],
                    transitionProperty: ['transform'],
                    transitionDuration: Duration.fast,
                    transitionTimingFunction: 'ease-out',
                }}
            >
                <Ionicons name="chevron-down" size={16} color={colors.textMuted}/>
            </Animated.View>
        </View>
    );
}

function SettingsSection({
                             title,
                             summary,
                             tone,
                             expanded,
                             colors,
                             gutter,
                             index,
                             onToggle,
                             onLayout,
                             children,
                         }: {
    title: string;
    summary: string;
    tone?: string;
    expanded: boolean;
    colors: Colors;
    gutter: number;
    index: number;
    onToggle: () => void;
    onLayout: (event: LayoutChangeEvent) => void;
    children: React.ReactNode;
}) {
    return (
        <Group colors={colors} index={index} onLayout={onLayout}>
            <Row
                title={title}
                titleStyle={styles.sectionRowTitle}
                colors={colors}
                gutter={gutter}
                onPress={onToggle}
                accessibilityLabel={title}
                accessibilityState={{expanded}}
                trailing={<Disclosure value={summary} expanded={expanded} colors={colors} tone={tone}/>}
            />
            {expanded ? (
                <LayoutAnimationConfig skipExiting>
                    <Animated.View entering={enterFade()}>{children}</Animated.View>
                </LayoutAnimationConfig>
            ) : null}
        </Group>
    );
}


const styles = StyleSheet.create({
    sectionHeader: {paddingTop: Spacing.xl, paddingBottom: Spacing.sm},
    sectionTitle: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bold},
    sectionRowTitle: {fontSize: 16, lineHeight: 22, fontFamily: FontFamily.bold},

    group: {borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing.xs},

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: GLYPH_GAP,
        minHeight: 56,
        paddingVertical: Spacing.sm,
    },
    rowText: {flex: 1, gap: 1},
    rowTitle: {fontSize: 15, lineHeight: 21, fontFamily: FontFamily.semibold},
    subtitle: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.regular},
    trailing: {flexShrink: 0, alignItems: 'flex-end', justifyContent: 'center'},
    value: {fontSize: 14, lineHeight: 19, fontFamily: FontFamily.medium},
    disclosure: {flexDirection: 'row', alignItems: 'center', gap: 4},
    avatar: {width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2},

    options: {paddingBottom: Spacing.sm},

    notice: {flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingBottom: Spacing.sm},
    noticeText: {flex: 1},

    dangerButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    dangerLabel: {fontSize: 14, fontFamily: FontFamily.bold},
});
