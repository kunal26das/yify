import Ionicons from '@expo/vector-icons/Ionicons';
import {memo, useCallback, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {AnimeCategory, AnimeRelease} from '@/domain/entities/AnimeRelease';
import {PressableScale} from '../components/motion';
import {Screen} from '../components/screen';
import {ThemedText} from '../components/themed-text';
import {FontFamily, Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {useTopBarHeight} from '../movies/components/TopBar';
import {TopBarSlot} from '../movies/components/TopBarSlot';
import type {AnimeViewModel} from './useAnimeViewModel';

const CATEGORIES: {value: AnimeCategory; label: string}[] = [
    {value: 'all', label: 'All anime'},
    {value: 'english', label: 'English translated'},
    {value: 'non-english', label: 'Other translations'},
    {value: 'raw', label: 'Untranslated'},
    {value: 'music-video', label: 'Music videos'},
];

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(category => [category.value, category.label]));

export function AnimeScreen({viewModel}: {viewModel: AnimeViewModel}) {
    const {colors} = usePalette();
    const {contentMaxWidth, gutter, isPhone} = useResponsive();
    const insets = useSafeAreaInsets();
    const top = useTopBarHeight();
    const [draft, setDraft] = useState(viewModel.query);
    const list = useRef<FlatList<AnimeRelease>>(null);
    const {releases, status, refreshing, refreshFailed, query, category, limit, reload, submitSearch, selectCategory} = viewModel;
    const busy = status === 'loading' || refreshing;
    const submit = () => {
        submitSearch(draft);
        list.current?.scrollToOffset({offset: 0, animated: false});
    };
    const renderRelease = useCallback(({item}: {item: AnimeRelease}) => <ReleaseRow release={item}/>, []);

    const header = <View style={styles.header}>
        <View style={styles.searchRow}>
            <View style={[styles.searchField, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Ionicons name="search-outline" size={20} color={colors.textMuted}/>
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={submit}
                    placeholder="Search anime uploads"
                    placeholderTextColor={colors.textFaint}
                    accessibilityLabel="Search anime uploads"
                    maxLength={200}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    style={[styles.searchInput, {color: colors.text}]}
                />
                {draft ? <PressableScale onPress={() => { setDraft(''); submitSearch(''); }}
                    accessibilityRole="button" accessibilityLabel="Clear anime search" contentStyle={styles.iconButton}>
                    <Ionicons name="close-outline" size={20} color={colors.textMuted}/>
                </PressableScale> : null}
            </View>
            <PressableScale onPress={submit} accessibilityRole="button" accessibilityLabel="Search anime"
                contentStyle={[styles.searchButton, {backgroundColor: colors.accentStrong}]}>
                <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Search</ThemedText>
            </PressableScale>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}
            keyboardShouldPersistTaps="handled" accessibilityLabel="Anime categories">
            {CATEGORIES.map(item => <PressableScale key={item.value}
                onPress={() => {selectCategory(item.value); list.current?.scrollToOffset({offset: 0, animated: false});}}
                accessibilityRole="button" accessibilityLabel={item.label}
                accessibilityState={{selected: category === item.value}}
                contentStyle={[styles.category, {borderColor: category === item.value ? colors.accent : colors.border,
                    backgroundColor: category === item.value ? colors.accentSoft : colors.surface}]}>
                <ThemedText type="caption" style={{color: category === item.value ? colors.accent : colors.textMuted}}>
                    {item.label}
                </ThemedText>
            </PressableScale>)}
        </ScrollView>
        <View style={styles.feedHeading}>
            <View style={styles.headingText}>
                <ThemedText type="section">{query ? 'Search results' : 'Recent uploads'}</ThemedText>
                <ThemedText type="caption" style={{color: colors.textMuted}}>
                    {query ? `For “${query}” on Nyaa` : 'Latest anime listings from Nyaa'}
                </ThemedText>
            </View>
            <PressableScale onPress={reload} disabled={busy} accessibilityRole="button"
                accessibilityLabel="Refresh anime uploads" accessibilityState={{disabled: busy}}
                contentStyle={[styles.refresh, {borderColor: colors.border, opacity: busy ? 0.5 : 1}]}>
                {refreshing ? <ActivityIndicator size="small" color={colors.accent}/>
                    : <Ionicons name="refresh-outline" size={18} color={colors.text}/>}
                {!isPhone ? <ThemedText type="caption">Refresh</ThemedText> : null}
            </PressableScale>
        </View>
        {refreshFailed ? <View style={[styles.refreshError, {backgroundColor: colors.accentSoft}]}>
            <ThemedText accessibilityRole="alert" style={[styles.flex, {color: colors.textMuted}]}>
                Couldn’t refresh. Showing the last loaded uploads.
            </ThemedText>
            <PressableScale onPress={reload} accessibilityRole="button" accessibilityLabel="Retry anime refresh"
                contentStyle={styles.retry}>
                <ThemedText type="defaultSemiBold" style={{color: colors.accent}}>Retry</ThemedText>
            </PressableScale>
        </View> : null}
    </View>;

    return <Screen overlays={<TopBarSlot showSearch={false}/>}>
        <FlatList
            ref={list}
            data={releases}
            keyExtractor={release => release.id}
            renderItem={renderRelease}
            ListHeaderComponent={header}
            ListEmptyComponent={status === 'loading' ? <View style={styles.empty}>
                <ActivityIndicator color={colors.accent} accessibilityLabel="Loading anime uploads"/>
                <ThemedText style={{color: colors.textMuted}}>Loading uploads…</ThemedText>
            </View> : <View style={styles.empty}>
                <Ionicons name={status === 'unavailable' ? 'cloud-offline-outline' : 'search-outline'} size={30} color={colors.accent}/>
                <ThemedText type="heading">{status === 'unavailable' ? 'Anime uploads couldn’t load' : 'No matching uploads'}</ThemedText>
                <ThemedText style={[styles.emptyText, {color: colors.textMuted}]}>
                    {status === 'unavailable' ? 'The upload feed is unavailable right now. Try again.'
                        : query ? 'Try another title or choose a different category.' : 'Try a different category or check again for new uploads.'}
                </ThemedText>
                {status === 'unavailable' ? <PressableScale onPress={reload} accessibilityRole="button"
                    accessibilityLabel="Retry loading anime uploads"
                    contentStyle={[styles.searchButton, {backgroundColor: colors.accentStrong}]}>
                    <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Try again</ThemedText>
                </PressableScale> : null}
            </View>}
            ListFooterComponent={status === 'ready' ? <ThemedText type="caption" style={[styles.footer, {color: colors.textMuted}]}>
                {releases.length >= limit ? `Showing the latest ${limit} uploads. Refine your search for a specific title.`
                    : `${releases.length} ${releases.length === 1 ? 'upload' : 'uploads'} in this feed.`}
            </ThemedText> : null}
            contentContainerStyle={[styles.listContent, {maxWidth: contentMaxWidth || 1680,
                paddingHorizontal: gutter, paddingTop: top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl}]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.accent}
                colors={[colors.accent]} progressViewOffset={top}/>}
        />
    </Screen>;
}

const ReleaseRow = memo(function ReleaseRow({release}: {release: AnimeRelease}) {
    const {colors} = usePalette();
    const uploaded = release.uploadedAt.toLocaleString(undefined, {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
    return <View style={[styles.release, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <View style={styles.releaseHeading}>
            <ThemedText type="caption" style={{color: colors.accent}}>{CATEGORY_LABELS[release.category]}</ThemedText>
            <ThemedText type="caption" style={{color: colors.textMuted}}>{release.size}</ThemedText>
        </View>
        <ThemedText selectable style={styles.releaseTitle}>{release.title}</ThemedText>
        <ThemedText type="caption" style={{color: colors.textMuted}}>Uploaded {uploaded}</ThemedText>
        <View style={styles.stats}>
            <ThemedText type="caption" style={{color: colors.textMuted}}>
                <ThemedText type="caption" style={{color: colors.seed}}>{release.seeds.toLocaleString()}</ThemedText> seeders
            </ThemedText>
            <ThemedText type="caption" style={{color: colors.textMuted}}>{release.peers.toLocaleString()} peers</ThemedText>
            <ThemedText type="caption" style={{color: colors.textMuted}}>{release.downloadCount.toLocaleString()} downloads</ThemedText>
        </View>
    </View>;
});

const styles = StyleSheet.create({
    listContent: {alignSelf: 'center', width: '100%', gap: Spacing.md},
    header: {width: '100%', maxWidth: 1120, gap: Spacing.lg, paddingBottom: Spacing.xs},
    searchRow: {flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch'},
    searchField: {flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderRadius: Radius.md, paddingLeft: Spacing.md, gap: Spacing.sm},
    searchInput: {flex: 1, minWidth: 0, paddingVertical: Spacing.md, paddingRight: Spacing.sm,
        fontFamily: FontFamily.regular, fontSize: 15},
    iconButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    searchButton: {minHeight: 48, paddingHorizontal: Spacing.lg, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center'},
    categories: {gap: Spacing.sm, paddingVertical: 2, alignItems: 'center'},
    category: {minHeight: 44, paddingHorizontal: Spacing.md, borderWidth: 1, borderRadius: Radius.pill,
        alignItems: 'center', justifyContent: 'center'},
    feedHeading: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    headingText: {flex: 1, minWidth: 0, gap: Spacing.xs},
    refresh: {minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.md,
        borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm},
    refreshError: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md},
    flex: {flex: 1, minWidth: 0},
    retry: {minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center'},
    release: {width: '100%', maxWidth: 1120, borderWidth: 1, borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm},
    releaseHeading: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.sm},
    releaseTitle: {...Typography.bodyStrong, fontSize: 17, lineHeight: 24},
    stats: {flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs},
    empty: {minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg},
    emptyText: {maxWidth: 400, textAlign: 'center'},
    footer: {paddingVertical: Spacing.md},
});
