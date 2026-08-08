import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {useState} from 'react';
import {Analytics} from '@/presentation/analytics/events';
import {ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {BrowseDefaults, ThemePreference} from '@/domain';
import {useConfirm} from '../components/confirm-dialog';
import {PressableScale, enterFade, enterPop, enterRise, exitFade} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
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
import * as WebBrowser from 'expo-web-browser';
import {PlayStoreButton, openPlayStore} from './components/PlayStoreButton';
import {ChipBar} from './components/ChipBar';
import {useTopBarHeight} from './components/TopBar';
import {usePreferencesViewModel, type PreferencesViewModel} from './usePreferencesViewModel';
import {useAuth} from '../hooks/use-auth';
import {useSyncStatus} from '../hooks/use-sync-status';
import {useAccountSync, useAuthRepository} from '../di/DependenciesContext';

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
type DisclosureKey = 'theme' | keyof BrowseDefaults;

interface BrowseRow {
    key: keyof BrowseDefaults;
    icon: Glyph;
    title: string;
    options: {value: string | number; label: string}[];
}

const WEBSITE_URL = 'https://kunal26das.github.io/yify';

const GLYPH_SIZE = 22;
const GLYPH_GAP = Spacing.md;

const THEME_OPTIONS: {value: ThemePreference; label: string; icon: Glyph}[] = [
    {value: 'system', label: 'System', icon: 'phone-portrait-outline'},
    {value: 'light', label: 'Light', icon: 'sunny-outline'},
    {value: 'dark', label: 'Dark', icon: 'moon-outline'},
];



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

    return (
        <Screen>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: navHeight,
                    paddingBottom: insets.bottom + 48,
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                    width: '100%',
                }}
                showsVerticalScrollIndicator={false}
            >
                <AccountSection colors={colors} gutter={gutter}/>

                <SectionHeader title="General" colors={colors} gutter={gutter} index={0}/>

                <Group colors={colors} index={0}>
                    <Row
                        icon={theme.icon}
                        title="Theme"
                        colors={colors}
                        gutter={gutter}
                        onPress={() => toggleGroup('theme')}
                        accessibilityLabel="Theme"
                        accessibilityState={{expanded: open === 'theme'}}
                        trailing={<Disclosure value={theme.label} expanded={open === 'theme'} colors={colors}/>}
                    />
                    {open === 'theme' ? (
                        <Animated.View entering={enterFade()} exiting={exitFade} style={styles.options}>
                            <ChipBar
                                chips={THEME_OPTIONS.map((option) => ({key: option.value, label: option.label}))}
                                active={vm.theme}
                                onSelect={(key) => {
                                    vm.selectTheme(key as ThemePreference);
                                    setOpen(null);
                                }}
                                contentPadding={gutter}
                            />
                        </Animated.View>
                    ) : null}
                </Group>

                {browseRows.map((row, position) => {
                    const current =
                        row.options.find((option) => option.value === vm.browseDefaults[row.key]) ??
                        row.options[0];
                    return (
                        <Group colors={colors} index={position + 1} key={row.key}>
                            <Row
                                icon={row.icon}
                                title={row.title}
                                colors={colors}
                                gutter={gutter}
                                onPress={() => toggleGroup(row.key)}
                                accessibilityLabel={row.title}
                                accessibilityState={{expanded: open === row.key}}
                                trailing={
                                    <Disclosure
                                        value={current.label}
                                        expanded={open === row.key}
                                        colors={colors}
                                    />
                                }
                            />
                            {open === row.key ? (
                                <Animated.View entering={enterFade()} exiting={exitFade} style={styles.options}>
                                    <ChipBar
                                        chips={row.options.map((option) => ({
                                            key: String(option.value),
                                            label: option.label,
                                        }))}
                                        active={String(vm.browseDefaults[row.key])}
                                        onSelect={(key) => {
                                            const picked = row.options.find(
                                                (option) => String(option.value) === key
                                            );
                                            if (picked) vm.setBrowseDefault(row.key, picked.value);
                                            setOpen(null);
                                        }}
                                        contentPadding={gutter}
                                    />
                                </Animated.View>
                            ) : null}
                        </Group>
                    );
                })}

                <SectionHeader title="Notifications" colors={colors} gutter={gutter} index={2}/>

                <Group colors={colors} index={2}>
                    <Row
                        icon="notifications-outline"
                        title="New releases"
                        subtitle="A daily check for titles added since you last looked."
                        colors={colors}
                        gutter={gutter}
                        trailing={
                            <Switch
                                value={vm.notifications}
                                onValueChange={(v) => void vm.toggleNotifications(v)}
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
                </Group>

                <SectionHeader title="Search" colors={colors} gutter={gutter} index={3}/>

                <Group colors={colors} index={3}>
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
                </Group>

                <SectionHeader title="Watchlist" colors={colors} gutter={gutter} index={4}/>

                <Group colors={colors} index={3}>
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
                </Group>

                <SectionHeader title="About" colors={colors} gutter={gutter} index={4}/>

                <Group colors={colors} index={4}>
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
                </Group>

                {Platform.OS === 'android' ? (
                    <Group colors={colors} index={5}>
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
                    </Group>
                ) : (
                    <Group colors={colors} index={5}>
                        <Row
                            icon="logo-google-playstore"
                            title="Android app"
                            colors={colors}
                            gutter={gutter}
                            trailing={<PlayStoreButton source="settings"/>}
                        />
                    </Group>
                )}

                {Platform.OS !== 'web' ? (
                    <Group colors={colors} index={6}>
                        <Row
                            icon="globe-outline"
                            title="Open Yify on the web"
                            subtitle={WEBSITE_URL.replace('https://', '')}
                            colors={colors}
                            gutter={gutter}
                            onPress={() => {
                                Analytics.websiteOpen('settings');
                                void WebBrowser.openBrowserAsync(WEBSITE_URL);
                            }}
                            accessibilityRole="link"
                            accessibilityLabel="Open Yify on the web"
                            trailing={<Ionicons name="open-outline" size={18} color={colors.textMuted}/>}
                        />
                    </Group>
                ) : null}
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

    const unavailable = ready && !available;

    const signOut = () => {
        Analytics.signOut();
        void auth.signOut();
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
               }: {
    colors: Colors;
    children: React.ReactNode;
    index?: number;
}) {
    return (
        <Animated.View
            entering={enterRise(index)}
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
            {leading ?? <Ionicons name={icon ?? 'ellipse-outline'} size={GLYPH_SIZE} color={colors.textMuted}/>}
            <View style={styles.rowText}>
                <ThemedText style={[styles.rowTitle, {color: colors.text}]}>{title}</ThemedText>
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
            pressedScale={0.99}
            pressedOpacity={0.6}
            lift={1}
            contentStyle={[styles.row, {paddingHorizontal: gutter}]}
        >
            {content}
        </PressableScale>
    );
}

function Disclosure({value, expanded, colors}: {value: string; expanded: boolean; colors: Colors}) {
    return (
        <View style={styles.disclosure}>
            <ThemedText style={[styles.value, {color: colors.textMuted}]} numberOfLines={1}>
                {value}
            </ThemedText>
            <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
            />
        </View>
    );
}


const styles = StyleSheet.create({
    container: {flex: 1},

    sectionHeader: {paddingTop: Spacing.xl, paddingBottom: Spacing.sm},
    sectionTitle: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bold},

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
    option: {flexDirection: 'row', alignItems: 'center', gap: GLYPH_GAP, minHeight: 44},
    optionLabel: {fontSize: 15, lineHeight: 21, fontFamily: FontFamily.medium},

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
