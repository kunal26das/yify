import {Ionicons} from '@expo/vector-icons';
import Constants from 'expo-constants';
import {router} from 'expo-router';
import {useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Analytics} from '@/lib/analytics-events';
import {requestNotificationPermission} from '@/lib/new-movies-task';
import {setNotificationsEnabled, setThemePreference, type ThemePreference} from '@/lib/settings';
import {clearWatchlist} from '@/lib/watchlist';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {useSettings} from '../hooks/use-settings';
import {PlayStoreButton, openPlayStore} from './components/PlayStoreButton';
import {TopNav, useTopNavHeight} from './components/TopNav';
import {useWatchlist} from './useWatchlist';

const THEME_OPTIONS: {value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap}[] = [
    {value: 'system', label: 'System', icon: 'phone-portrait-outline'},
    {value: 'light', label: 'Light', icon: 'sunny-outline'},
    {value: 'dark', label: 'Dark', icon: 'moon-outline'},
];

export function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {gutter, contentMaxWidth} = useResponsive();
    const navHeight = useTopNavHeight();
    const settings = useSettings();
    const watchlist = useWatchlist();
    const [cleared, setCleared] = useState(false);

    const version = Constants.expoConfig?.version ?? '—';
    const buildNumber =
        Platform.OS === 'android'
            ? Constants.expoConfig?.android?.versionCode
            : Constants.expoConfig?.ios?.buildNumber;

    const onToggleNotifications = async (next: boolean) => {
        Analytics.settingChanged('notifications', String(next));
        if (!next) {
            setNotificationsEnabled(false);
            return;
        }
        // Turning it on is only meaningful if the OS will actually let us post — ask first and
        // leave the switch off if permission is refused, rather than promising alerts that
        // will never arrive.
        const granted = await requestNotificationPermission();
        setNotificationsEnabled(granted);
    };

    return (
        <ThemedView style={styles.container}>
            <ScrollView
                contentContainerStyle={{
                    paddingTop: navHeight + Spacing.lg,
                    paddingBottom: insets.bottom + 48,
                    paddingHorizontal: gutter,
                    maxWidth: contentMaxWidth,
                    alignSelf: 'center',
                    width: '100%',
                }}
                showsVerticalScrollIndicator={false}
            >
                <ThemedText type="title" style={styles.heading}>Settings</ThemedText>

                <Section title="Appearance" colors={colors}>
                    <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                        Match the device, or pin the app to one theme.
                    </ThemedText>
                    <View style={styles.segmented}>
                        {THEME_OPTIONS.map((option) => {
                            const selected = settings.theme === option.value;
                            return (
                                <Pressable
                                    key={option.value}
                                    onPress={() => {
                                        Analytics.settingChanged('theme', option.value);
                                        setThemePreference(option.value);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{selected}}
                                    style={({pressed}) => [
                                        styles.segment,
                                        {
                                            backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                                            borderColor: selected ? colors.accent : colors.border,
                                            opacity: pressed ? 0.85 : 1,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={option.icon}
                                        size={17}
                                        color={selected ? colors.onAccent : colors.text}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.segmentLabel,
                                            {color: selected ? colors.onAccent : colors.text},
                                        ]}
                                    >
                                        {option.label}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                </Section>

                <Section title="Notifications" colors={colors}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <ThemedText style={[styles.rowTitle, {color: colors.text}]}>
                                New releases
                            </ThemedText>
                            <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                                A daily check for titles added since you last looked.
                            </ThemedText>
                        </View>
                        <Switch
                            value={settings.notifications}
                            onValueChange={(v) => void onToggleNotifications(v)}
                            trackColor={{true: colors.accent, false: colors.surfaceSunken}}
                        />
                    </View>
                </Section>

                <Section title="My List" colors={colors}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <ThemedText style={[styles.rowTitle, {color: colors.text}]}>
                                {watchlist.length} {watchlist.length === 1 ? 'title' : 'titles'} saved
                            </ThemedText>
                            <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                                Your list is kept on this device only.
                            </ThemedText>
                        </View>
                        <Pressable
                            disabled={watchlist.length === 0}
                            onPress={() => {
                                Analytics.settingChanged('watchlist', 'cleared');
                                clearWatchlist();
                                setCleared(true);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear My List"
                            style={({pressed}) => [
                                styles.dangerButton,
                                {
                                    borderColor: colors.border,
                                    opacity: watchlist.length === 0 ? 0.4 : pressed ? 0.7 : 1,
                                },
                            ]}
                        >
                            <ThemedText style={[styles.dangerLabel, {color: colors.peer}]}>Clear</ThemedText>
                        </Pressable>
                    </View>
                    {cleared && watchlist.length === 0 ? (
                        <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                            Cleared.
                        </ThemedText>
                    ) : null}
                </Section>

                <Section title="About" colors={colors}>
                    <InfoRow label="Version" value={version} colors={colors}/>
                    {buildNumber != null ? (
                        <InfoRow label="Build" value={String(buildNumber)} colors={colors}/>
                    ) : null}
                    <InfoRow
                        label="Platform"
                        value={Platform.OS === 'web' ? 'Web' : Platform.OS === 'ios' ? 'iOS' : 'Android'}
                        colors={colors}
                    />
                    <InfoRow label="Catalogue" value="YTS API" colors={colors}/>

                    {Platform.OS === 'android' ? (
                        <Pressable
                            onPress={() => void openPlayStore('settings')}
                            accessibilityRole="link"
                            style={({pressed}) => [styles.linkRow, {opacity: pressed ? 0.7 : 1}]}
                        >
                            <ThemedText style={[styles.rowTitle, {color: colors.accent}]}>
                                Rate on Google Play
                            </ThemedText>
                            <Ionicons name="open-outline" size={16} color={colors.accent}/>
                        </Pressable>
                    ) : (
                        <View style={styles.store}>
                            <PlayStoreButton source="settings"/>
                        </View>
                    )}

                    <ThemedText style={[styles.disclaimer, {color: colors.textFaint}]}>
                        Yify is an unofficial client for the YTS API. It indexes what that API
                        returns and hosts no files itself.
                    </ThemedText>
                </Section>
            </ScrollView>
            <TopNav
                active="settings"
                onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
        </ThemedView>
    );
}

function Section({
                     title,
                     colors,
                     children,
                 }: {
    title: string;
    colors: ReturnType<typeof usePalette>['colors'];
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, {color: colors.textMuted}]}>
                {title.toUpperCase()}
            </ThemedText>
            <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                {children}
            </View>
        </View>
    );
}

function InfoRow({
                     label,
                     value,
                     colors,
                 }: {
    label: string;
    value: string;
    colors: ReturnType<typeof usePalette>['colors'];
}) {
    return (
        <View style={styles.infoRow}>
            <ThemedText style={[styles.rowTitle, {color: colors.text}]}>{label}</ThemedText>
            <ThemedText style={[styles.infoValue, {color: colors.textMuted}]}>{value}</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    heading: {marginBottom: Spacing.xl},

    section: {marginBottom: Spacing.xl},
    sectionTitle: {fontSize: 11.5, letterSpacing: 1, marginBottom: Spacing.sm, fontFamily: FontFamily.bold},
    card: {
        borderRadius: Radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        padding: Spacing.lg,
        gap: Spacing.md,
    },

    row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.lg},
    rowText: {flexShrink: 1, gap: 2},
    rowTitle: {fontSize: 15, fontFamily: FontFamily.semibold},
    rowHint: {fontSize: 13, lineHeight: 18, fontFamily: FontFamily.regular},

    segmented: {flexDirection: 'row', gap: Spacing.sm},
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
    },
    segmentLabel: {fontSize: 14, fontFamily: FontFamily.semibold},

    dangerButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    dangerLabel: {fontSize: 14, fontFamily: FontFamily.bold},

    infoRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    infoValue: {fontSize: 14, fontFamily: FontFamily.medium},
    linkRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
    store: {marginTop: Spacing.xs},
    disclaimer: {fontSize: 12, lineHeight: 17, marginTop: Spacing.xs, fontFamily: FontFamily.regular},
});
