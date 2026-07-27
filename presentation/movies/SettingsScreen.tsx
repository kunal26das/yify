import {Ionicons} from '@expo/vector-icons';
import {Analytics} from '@/lib/analytics-events';
import {Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {LandingPage, ThemePreference} from '@/lib/settings';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {DESTINATIONS} from './constants/destinations';
import * as WebBrowser from 'expo-web-browser';
import {PlayStoreButton, openPlayStore} from './components/PlayStoreButton';
import {TopNav, useTopNavHeight} from './components/TopNav';
import {useSettingsViewModel, type SettingsViewModel} from './useSettingsViewModel';

type Colors = ReturnType<typeof usePalette>['colors'];

const WEBSITE_URL = 'https://kunal26das.github.io/yify';

const LANDING_OPTIONS = DESTINATIONS.filter((d) => d.key !== 'my-list');

const THEME_OPTIONS: {value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap}[] = [
    {value: 'system', label: 'System', icon: 'phone-portrait-outline'},
    {value: 'light', label: 'Light', icon: 'sunny-outline'},
    {value: 'dark', label: 'Dark', icon: 'moon-outline'},
];

export function SettingsScreen({viewModel}: {viewModel?: SettingsViewModel} = {}) {
    const fallback = useSettingsViewModel();
    const vm = viewModel ?? fallback;

    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {gutter, contentMaxWidth} = useResponsive();
    const navHeight = useTopNavHeight();

    const confirmClear = () => {
        const count = vm.watchlistCount;
        const message = `This removes ${count} ${count === 1 ? 'title' : 'titles'} from My List. This can't be undone.`;
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && !window.confirm(message)) return;
            vm.clearList();
            return;
        }
        Alert.alert('Clear My List?', message, [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Clear', style: 'destructive', onPress: vm.clearList},
        ]);
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
                        {THEME_OPTIONS.map((option) => (
                            <Segment
                                key={option.value}
                                label={option.label}
                                icon={option.icon}
                                selected={vm.theme === option.value}
                                onPress={() => vm.selectTheme(option.value)}
                                colors={colors}
                            />
                        ))}
                    </View>
                </Section>

                <Section title="Landing page" colors={colors}>
                    <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                        Where the app opens. Home by default.
                    </ThemedText>
                    <View style={styles.choices}>
                        {LANDING_OPTIONS.map((destination) => (
                            <Choice
                                key={destination.key}
                                label={destination.label}
                                selected={vm.landingPage === destination.key}
                                onPress={() => vm.selectLandingPage(destination.key as LandingPage)}
                                colors={colors}
                            />
                        ))}
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
                            value={vm.notifications}
                            onValueChange={(v) => void vm.toggleNotifications(v)}
                            trackColor={{true: colors.accent, false: colors.surfaceSunken}}
                            thumbColor={vm.notifications ? colors.onAccent : colors.surface}
                            ios_backgroundColor={colors.surfaceSunken}
                        />
                    </View>
                    {vm.notifications && vm.permissionBlocked ? (
                        <View style={styles.notice}>
                            <Ionicons name="warning-outline" size={15} color={colors.gold}/>
                            <ThemedText style={[styles.rowHint, styles.noticeText, {color: colors.textMuted}]}>
                                {Platform.OS === 'web'
                                    ? 'Your browser is blocking notifications for this site. Allow them in its site settings and this will start working.'
                                    : 'Notifications are turned off for Yify in your device settings. Allow them there and this will start working.'}
                            </ThemedText>
                        </View>
                    ) : null}
                </Section>

                <Section title="My List" colors={colors}>
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <ThemedText style={[styles.rowTitle, {color: colors.text}]}>
                                {vm.watchlistCount} {vm.watchlistCount === 1 ? 'title' : 'titles'} saved
                            </ThemedText>
                            <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>
                                Your list is kept on this device only.
                            </ThemedText>
                        </View>
                        <Pressable
                            disabled={vm.watchlistCount === 0}
                            onPress={confirmClear}
                            accessibilityRole="button"
                            accessibilityLabel="Clear My List"
                            style={({pressed}) => [
                                styles.dangerButton,
                                {
                                    borderColor: colors.border,
                                    opacity: vm.watchlistCount === 0 ? 0.4 : pressed ? 0.7 : 1,
                                },
                            ]}
                        >
                            <ThemedText style={[styles.dangerLabel, {color: colors.peer}]}>Clear</ThemedText>
                        </Pressable>
                    </View>
                    {vm.listCleared && vm.watchlistCount === 0 ? (
                        <ThemedText style={[styles.rowHint, {color: colors.textMuted}]}>Cleared.</ThemedText>
                    ) : null}
                </Section>

                <Section title="About" colors={colors}>
                    <InfoRow label="Version" value={vm.appInfo.version} colors={colors}/>

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

                    {Platform.OS !== 'web' ? (
                        <Pressable
                            onPress={() => {
                                Analytics.websiteOpen('settings');
                                void WebBrowser.openBrowserAsync(WEBSITE_URL);
                            }}
                            accessibilityRole="link"
                            style={({pressed}) => [styles.linkRow, {opacity: pressed ? 0.7 : 1}]}
                        >
                            <ThemedText style={[styles.rowTitle, {color: colors.accent}]}>
                                Open Yify on the web
                            </ThemedText>
                            <Ionicons name="open-outline" size={16} color={colors.accent}/>
                        </Pressable>
                    ) : null}
                </Section>
            </ScrollView>
            <TopNav active="settings"/>
        </ThemedView>
    );
}

function Segment({
                     label,
                     icon,
                     selected,
                     onPress,
                     colors,
                 }: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    selected: boolean;
    onPress: () => void;
    colors: Colors;
}) {
    return (
        <Pressable
            onPress={onPress}
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
            <Ionicons name={icon} size={17} color={selected ? colors.onAccent : colors.text}/>
            <ThemedText style={[styles.segmentLabel, {color: selected ? colors.onAccent : colors.text}]}>
                {label}
            </ThemedText>
        </Pressable>
    );
}

function Choice({
                    label,
                    selected,
                    onPress,
                    colors,
                }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    colors: Colors;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{selected}}
            style={({pressed}) => [
                styles.choice,
                {
                    backgroundColor: selected ? colors.accentSoft : 'transparent',
                    borderColor: selected ? colors.accent : colors.border,
                    opacity: pressed ? 0.85 : 1,
                },
            ]}
        >
            <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={16}
                color={selected ? colors.accent : colors.textMuted}
            />
            <ThemedText style={[styles.choiceLabel, {color: colors.text}]}>{label}</ThemedText>
        </Pressable>
    );
}

function Section({
                     title,
                     colors,
                     children,
                 }: {
    title: string;
    colors: Colors;
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

function InfoRow({label, value, colors}: {label: string; value: string; colors: Colors}) {
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
    notice: {flexDirection: 'row', alignItems: 'flex-start', gap: 7},
    noticeText: {flexShrink: 1},

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

    choices: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm},
    choice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    choiceLabel: {fontSize: 14, fontFamily: FontFamily.semibold},

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
});
