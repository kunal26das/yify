import Ionicons from '@expo/vector-icons/Ionicons';
import {useState, type ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {OrderBy, SortBy} from '@/domain';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {GENRE_OPTIONS, ORDER_OPTIONS, QUALITY_OPTIONS, SORT_BY_OPTIONS} from '../constants/movieFilterLabels';
import type {MovieFilters} from '../useMoviesViewModel';

export interface BrowseFilterBarProps {
    filters: MovieFilters;
    onChange: (filters: MovieFilters) => void;
    onOpenFilters: () => void;
    onReset: () => void;
    resultCount?: number | null;
    query?: string;
    loading?: boolean;
}

function appliedSummary(filters: MovieFilters): string[] {
    const summary: string[] = [];
    if (filters.quality) summary.push(QUALITY_OPTIONS.find(option => option.value === filters.quality)?.label ?? filters.quality);
    if (filters.genre) summary.push(GENRE_OPTIONS.find(option => option.value === filters.genre)?.label ?? filters.genre);
    if ((filters.minimum_rating ?? 0) > 0) summary.push(`Rating ${filters.minimum_rating}+`);
    if ((filters.sort_by ?? SortBy.DateAdded) !== SortBy.DateAdded || (filters.order_by ?? OrderBy.Desc) !== OrderBy.Desc) {
        const sort = SORT_BY_OPTIONS.find(option => option.value === (filters.sort_by ?? SortBy.DateAdded))?.label;
        const order = ORDER_OPTIONS.find(option => option.value === (filters.order_by ?? OrderBy.Desc))?.label;
        summary.push(`${sort} · ${order}`);
    }
    return summary;
}

function BrowseButton({label, onPress, primary = false}: {label: string; onPress: () => void; primary?: boolean}) {
    const {colors} = usePalette();
    const [focused, setFocused] = useState(false);
    return (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            contentStyle={[styles.button, {
                borderColor: focused ? colors.accent : primary ? colors.borderStrong : 'transparent',
                backgroundColor: primary ? colors.surface : 'transparent',
            }]}>
            {primary ? <Ionicons name="options-outline" size={18} color={colors.text}/> : null}
            <ThemedText type="caption" style={{color: primary ? colors.text : colors.accent, fontWeight: '600'}}>{label}</ThemedText>
        </PressableScale>
    );
}

export function BrowseFilterBarContent({filters, onOpenFilters, onReset, resultCount, query, loading, children}: BrowseFilterBarProps & {children?: ReactNode}) {
    const {colors} = usePalette();
    const search = query?.trim();
    const summary = appliedSummary(filters);
    const count = resultCount != null && Number.isFinite(resultCount) && resultCount >= 0 ? resultCount : null;
    const countLabel = loading ? 'Loading movies…' : count == null ? 'Explore the catalog' : `${count.toLocaleString()} ${count === 1 ? 'movie' : 'movies'}`;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.heading}>
                    <ThemedText accessibilityRole="header" type="title" numberOfLines={2}>
                        {search ? `Search results for “${search}”` : 'Browse movies'}
                    </ThemedText>
                    <ThemedText type="caption" accessibilityLiveRegion="polite" style={{color: colors.textMuted}}>{countLabel}</ThemedText>
                </View>
                <View style={styles.actions}>
                    {search || summary.length > 0 ? <BrowseButton label="Reset" onPress={onReset}/> : null}
                    <BrowseButton label="Filters" onPress={onOpenFilters} primary/>
                </View>
            </View>
            {children ?? <ThemedText type="caption" style={{color: colors.textMuted}}>{summary.length ? summary.join(' · ') : 'All movies · Newest additions'}</ThemedText>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {gap: Spacing.md, paddingVertical: Spacing.lg},
    header: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm},
    heading: {flex: 1, minWidth: 180, gap: Spacing.xs},
    actions: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs},
    button: {minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 2, borderRadius: Radius.sm, paddingHorizontal: Spacing.md},
});
