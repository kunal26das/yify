import {useCallback, useEffect, useRef, useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Modal, Platform, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ThemedText} from '../../components/themed-text';
import {PressableScale, enterFade, exitFade, shiftLayout} from '../../components/motion';
import {usePalette} from '../../hooks/use-palette';
import {Spacing, Typography} from '../../constants/theme';
import {Analytics} from '@/lib/analytics-events';
import {createKeyValueStore} from '@/lib/storage/create-key-value-store';
import type {KeyValueStore} from '@/lib/storage/key-value-store';

const STORE_ID = 'search';
const RECENTS_KEY = 'search.recents';
const RECENTS_LIMIT = 8;
const SEARCH_ROW_HEIGHT = 56;
const RECENT_ROW_HEIGHT = 48;

let store: KeyValueStore | null = null;

function getStore(): KeyValueStore {
    if (!store) store = createKeyValueStore(STORE_ID);
    return store;
}

function parseRecents(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENTS_LIMIT);
    } catch {
        return [];
    }
}

function writeRecents(next: string[]): string[] {
    getStore().set(RECENTS_KEY, JSON.stringify(next));
    return next;
}

export function getRecentSearches(): string[] {
    return parseRecents(getStore().getString(RECENTS_KEY));
}

export function rememberRecentSearch(term: string): string[] {
    const trimmed = term.trim();
    if (!trimmed) return getRecentSearches();
    const rest = getRecentSearches().filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    return writeRecents([trimmed, ...rest].slice(0, RECENTS_LIMIT));
}

export function clearRecentSearches(): void {
    writeRecents([]);
}

export function forgetRecentSearch(term: string): string[] {
    return writeRecents(getRecentSearches().filter((item) => item !== term));
}

export function SearchOverlay({
                                  visible,
                                  initialQuery,
                                  onClose,
                                  onSubmit,
                              }: {
    visible: boolean;
    initialQuery?: string;
    onClose: () => void;
    onSubmit: (q: string) => void;
}) {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const inputRef = useRef<TextInput>(null);
    const [query, setQuery] = useState(initialQuery ?? '');
    const [recents, setRecents] = useState<string[]>([]);

    useEffect(() => {
        if (!visible) return;
        setQuery(initialQuery ?? '');
        setRecents(getRecentSearches());
    }, [visible, initialQuery]);

    const submit = useCallback(
        (term: string) => {
            const trimmed = term.trim();
            if (!trimmed) return;
            rememberRecentSearch(trimmed);
            Analytics.search(trimmed);
            onSubmit(trimmed);
            onClose();
        },
        [onSubmit, onClose]
    );

    const remove = useCallback((term: string) => {
        setRecents(forgetRecentSearch(term));
    }, []);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
            onShow={() => inputRef.current?.focus()}
        >
            <View style={[styles.overlay, {backgroundColor: colors.background, paddingTop: insets.top}]}>
                <View style={[styles.searchRow, {borderBottomColor: colors.border}]}>
                    <PressableScale
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close search"
                        hitSlop={8}
                        pressedScale={0.86}
                        pressedOpacity={0.6}
                        contentStyle={styles.iconButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text}/>
                    </PressableScale>

                    <TextInput
                        ref={inputRef}
                        style={[
                            styles.input,
                            {color: colors.text},
                            Platform.OS === 'web' ? ({outlineStyle: 'none'} as object) : null,
                        ]}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={() => submit(query)}
                        placeholder="Search movies"
                        placeholderTextColor={colors.textFaint}
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        clearButtonMode="never"
                        accessibilityLabel="Search movies"
                    />

                    {query.length > 0 ? (
                        <Animated.View entering={enterFade()} exiting={exitFade}>
                            <PressableScale
                                onPress={() => {
                                    Analytics.searchCleared();
                                    setQuery('');
                                    inputRef.current?.focus();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Clear search"
                                hitSlop={8}
                                pressedScale={0.86}
                                pressedOpacity={0.6}
                                contentStyle={styles.iconButton}
                            >
                                <Ionicons name="close" size={22} color={colors.textMuted}/>
                            </PressableScale>
                        </Animated.View>
                    ) : null}
                </View>

                <ScrollView
                    style={styles.list}
                    contentContainerStyle={[styles.listContent, {paddingBottom: insets.bottom + Spacing.lg}]}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {recents.map((term) => (
                        <Animated.View key={term} layout={shiftLayout} exiting={exitFade} style={styles.recentRow}>
                            <PressableScale
                                onPress={() => submit(term)}
                                accessibilityRole="button"
                                accessibilityLabel={`Search ${term}`}
                                pressedScale={0.99}
                                pressedOpacity={0.6}
                                style={styles.recentPress}
                                contentStyle={styles.recentContent}
                            >
                                <Ionicons name="time-outline" size={20} color={colors.textMuted}/>
                                <ThemedText numberOfLines={1} style={[styles.recentLabel, {color: colors.text}]}>
                                    {term}
                                </ThemedText>
                            </PressableScale>
                            <PressableScale
                                onPress={() => remove(term)}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${term}`}
                                hitSlop={8}
                                pressedScale={0.84}
                                pressedOpacity={0.6}
                                contentStyle={styles.iconButton}
                            >
                                <Ionicons name="close" size={18} color={colors.textMuted}/>
                            </PressableScale>
                        </Animated.View>
                    ))}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
    searchRow: {
        height: SEARCH_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        gap: Spacing.xs,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    iconButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
    input: {flex: 1, height: 40, fontSize: 16, paddingHorizontal: Spacing.sm},
    list: {flex: 1},
    listContent: {paddingTop: Spacing.xs},
    recentRow: {
        height: RECENT_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: Spacing.sm,
    },
    recentPress: {flex: 1, height: RECENT_ROW_HEIGHT, justifyContent: 'center'},
    recentContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    recentLabel: {...Typography.body, flex: 1},
});
