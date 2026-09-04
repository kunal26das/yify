import {Ionicons} from '@expo/vector-icons';
import {useCallback, useMemo, useState} from 'react';
import {FlatList, StyleSheet, TextInput, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {filterHistory, groupHistory, type HistoryEntry, type HistoryKind} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {useConfirm} from '../components/confirm-dialog';
import {enterRise, PressableScale, shiftLayout} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {usePreferences} from '../hooks/use-preferences';
import {useResponsive} from '../hooks/use-responsive';
import {usePreferencesRepository} from '../di/DependenciesContext';
import {HistoryRow} from './components/HistoryRow';
import {useTopBarHeight} from './components/TopBar';
import {ChipBar} from './components/ChipBar';
import {useGoTo} from './constants/destinations';
import {useClearHistory, useRemoveFromHistory, useWatchHistory} from './useWatchHistory';

type Filter = HistoryKind | 'all';

type Row =
    | { type: 'heading'; key: string; label: string }
    | { type: 'entry'; key: string; entry: HistoryEntry };

const FILTERS: readonly { key: Filter; label: string }[] = [
    {key: 'all', label: 'All'},
    {key: 'movie', label: 'Movies'},
    {key: 'show', label: 'Shows'},
];

const THUMB_RATIO = 0.4;
const THUMB_MAX = 220;
const THUMB_MIN = 120;

function ControlButton({
                           icon,
                           label,
                           active,
                           onPress,
                       }: {
    icon: 'trash-outline' | 'pause-circle-outline' | 'play-circle-outline';
    label: string;
    active?: boolean;
    onPress: () => void;
}) {
    const {colors} = usePalette();
    return (
        <PressableScale
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{selected: !!active}}
            pressedScale={0.95}
            pressedOpacity={0.85}
            hoveredScale={1.03}
            contentStyle={[
                styles.control,
                {
                    backgroundColor: active ? colors.accent : colors.surfaceSunken,
                    borderColor: active ? 'transparent' : colors.border,
                },
            ]}
        >
            <Ionicons
                name={icon}
                size={16}
                color={active ? colors.onAccent : colors.textMuted}
            />
            <ThemedText
                style={[styles.controlLabel, {color: active ? colors.onAccent : colors.text}]}
            >
                {label}
            </ThemedText>
        </PressableScale>
    );
}

export function HistoryScreen() {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter, isPhone} = useResponsive();
    const topBarHeight = useTopBarHeight();
    const entries = useWatchHistory();
    const removeFromHistory = useRemoveFromHistory();
    const clearHistory = useClearHistory();
    const preferences = usePreferencesRepository();
    const {historyPaused} = usePreferences();
    const confirm = useConfirm();
    const goTo = useGoTo();

    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');

    const listWidth = Math.min(width, contentMaxWidth);
    const innerWidth = Math.max(0, listWidth - gutter * 2);
    const thumbWidth = Math.max(
        THUMB_MIN,
        Math.min(THUMB_MAX, Math.round(innerWidth * THUMB_RATIO))
    );

    const visible = useMemo(
        () => filterHistory(entries, {query, kind: filter}),
        [entries, filter, query]
    );

    const rows = useMemo(() => {
        const next: Row[] = [];
        groupHistory(visible, Date.now()).forEach((group) => {
            next.push({type: 'heading', key: `heading:${group.label}`, label: group.label});
            group.entries.forEach((entry) => {
                next.push({type: 'entry', key: entry.key, entry});
            });
        });
        return next;
    }, [visible]);

    const onRemove = useCallback(
        (entry: HistoryEntry) => {
            Analytics.historyRemove(entry.key, entry.title);
            removeFromHistory(entry.key);
        },
        [removeFromHistory]
    );

    const onClear = useCallback(() => {
        confirm({
            title: 'Clear watch history?',
            message: 'Everything you have opened will be removed from History on all your devices.',
            confirmLabel: 'Clear',
            cancelLabel: 'Cancel',
            icon: 'trash-outline',
            destructive: true,
            onConfirm: () => {
                Analytics.historyClear(entries.length);
                clearHistory();
            },
        });
    }, [clearHistory, confirm, entries.length]);

    const onTogglePause = useCallback(() => {
        const next = !historyPaused;
        Analytics.historyPaused(next);
        preferences.setHistoryPaused(next);
    }, [historyPaused, preferences]);

    const renderItem = useCallback(
        ({item}: { item: Row }) => {
            if (item.type === 'heading') {
                return (
                    <ThemedText type="heading" style={styles.heading}>
                        {item.label}
                    </ThemedText>
                );
            }
            return (
                <Animated.View layout={shiftLayout} style={styles.rowWrap}>
                    <HistoryRow entry={item.entry} thumbWidth={thumbWidth} onRemove={onRemove}/>
                </Animated.View>
            );
        },
        [onRemove, thumbWidth]
    );

    const header = (
        <View style={styles.header}>
            <ThemedText type="title">History</ThemedText>
            <View style={[styles.search, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
                <Ionicons name="search" size={16} color={colors.textMuted}/>
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search history"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Search history"
                    style={[styles.searchInput, {color: colors.text}]}
                    autoCorrect={false}
                    returnKeyType="search"
                />
                {query ? (
                    <PressableScale
                        onPress={() => setQuery('')}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                        hitSlop={8}
                        pressedScale={0.86}
                        pressedOpacity={0.6}
                        contentStyle={styles.searchClear}
                    >
                        <Ionicons name="close" size={16} color={colors.textMuted}/>
                    </PressableScale>
                ) : null}
            </View>
            <View style={styles.chips}>
                <ChipBar
                    chips={FILTERS}
                    active={filter}
                    onSelect={(key) => setFilter(key as Filter)}
                    contentPadding={0}
                />
            </View>
            <View style={styles.controls}>
                <ControlButton icon="trash-outline" label="Clear all history" onPress={onClear}/>
                <ControlButton
                    icon={historyPaused ? 'play-circle-outline' : 'pause-circle-outline'}
                    label={historyPaused ? 'Resume history' : 'Pause history'}
                    active={historyPaused}
                    onPress={onTogglePause}
                />
            </View>
            {historyPaused ? (
                <ThemedText style={[styles.paused, {color: colors.textMuted}]}>
                    History is paused. Movies you open are not being saved.
                </ThemedText>
            ) : null}
        </View>
    );

    const empty =
        entries.length === 0 ? (
            <Animated.View entering={enterRise()} style={styles.empty}>
                <Ionicons name="time-outline" size={48} color={colors.textFaint}/>
                <ThemedText type="heading" style={styles.emptyTitle}>
                    No watch history yet
                </ThemedText>
                <ThemedText style={[styles.emptyBody, {color: colors.textMuted}]}>
                    {historyPaused
                        ? 'History is paused, so nothing you open is being saved.'
                        : 'Movies and shows you open will show up here.'}
                </ThemedText>
                <PressableScale
                    onPress={() => {
                        Analytics.browseAllOpen('history_empty');
                        goTo('/movies');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Find something to watch"
                    pressedScale={0.95}
                    pressedOpacity={0.85}
                    hoveredScale={1.03}
                    contentStyle={[styles.cta, {backgroundColor: colors.accent}]}
                >
                    <Ionicons name="search" size={16} color={colors.onAccent}/>
                    <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>
                        Find something to watch
                    </ThemedText>
                </PressableScale>
            </Animated.View>
        ) : (
            <Animated.View entering={enterRise()} style={styles.empty}>
                <Ionicons name="search-outline" size={40} color={colors.textFaint}/>
                <ThemedText style={[styles.emptyBody, {color: colors.textMuted}]}>
                    Nothing in your history matches that.
                </ThemedText>
            </Animated.View>
        );

    return (
        <Screen>
            <FlatList
                data={rows}
                keyExtractor={(item: Row) => item.key}
                renderItem={renderItem}
                ListHeaderComponent={header}
                ListEmptyComponent={empty}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={11}
                contentContainerStyle={{
                    width: listWidth,
                    alignSelf: 'center',
                    paddingHorizontal: gutter,
                    paddingTop: topBarHeight + (isPhone ? Spacing.md : Spacing.lg),
                    paddingBottom: insets.bottom + 96,
                }}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {gap: Spacing.md, paddingBottom: Spacing.lg},
    search: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 40,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {flex: 1, fontSize: 14, padding: 0},
    searchClear: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
    chips: {marginHorizontal: -Spacing.xs},
    controls: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm},
    control: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 36,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    controlLabel: {fontSize: 14, lineHeight: 18, fontWeight: '500'},
    paused: {fontSize: 13, lineHeight: 18},

    heading: {marginTop: Spacing.lg, marginBottom: Spacing.sm},
    rowWrap: {paddingVertical: Spacing.sm},

    empty: {alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: Spacing.xs},
    emptyTitle: {marginTop: Spacing.md},
    emptyBody: {fontSize: 14, lineHeight: 20, textAlign: 'center'},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        height: 40,
        paddingHorizontal: 20,
        borderRadius: Radius.pill,
        marginTop: Spacing.lg,
    },
    ctaLabel: {fontSize: 14, lineHeight: 18, fontWeight: '600'},
});
