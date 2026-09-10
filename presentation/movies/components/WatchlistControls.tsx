import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {StyleSheet, TextInput, View} from 'react-native';
import type {WatchlistSort, WatchlistStatus, WatchlistViewOptions} from '@/domain';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {ChipBar} from './ChipBar';
import {WatchlistSheet} from './WatchlistSheet';

const STATUSES = [
    {key: 'all', label: 'All'},
    {key: 'to-watch', label: 'To watch'},
    {key: 'watched', label: 'Watched'},
] as const;

const SORTS: {value: WatchlistSort; label: string}[] = [
    {value: 'saved', label: 'Saved order'},
    {value: 'title', label: 'Title A–Z'},
    {value: 'rating', label: 'Highest rated'},
    {value: 'year', label: 'Newest year'},
];

export function WatchlistControlButton({label, icon, onPress, active = false, disabled = false, iconOnly = false}: {
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    active?: boolean;
    disabled?: boolean;
    iconOnly?: boolean;
}) {
    const {colors} = usePalette();
    return (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
                        accessibilityState={{selected: active, disabled}} disabled={disabled}
                        contentStyle={[styles.button, {
                            backgroundColor: active ? colors.accentStrong : colors.surfaceSunken,
                            borderColor: active ? colors.accentStrong : colors.border,
                            opacity: disabled ? 0.45 : 1,
                        }, iconOnly && styles.iconButton]}>
            {icon ? <Ionicons name={icon} size={18} color={active ? colors.onAccent : colors.textMuted}/> : null}
            {!iconOnly ? <ThemedText numberOfLines={1} style={[styles.buttonText, {color: active ? colors.onAccent : colors.text}]}>{label}</ThemedText> : null}
        </PressableScale>
    );
}

function Choices<T extends string | number>({title, options, value, onChange}: {
    title: string;
    options: {value: T; label: string}[];
    value: T;
    onChange: (value: T) => void;
}) {
    const {colors} = usePalette();
    return (
        <View style={styles.choices}>
            <ThemedText style={[styles.sectionLabel, {color: colors.textMuted}]}>{title}</ThemedText>
            <View style={styles.choiceRow}>
                {options.map((option) => (
                    <WatchlistControlButton key={option.value} label={option.label}
                                            active={option.value === value} onPress={() => onChange(option.value)}/>
                ))}
            </View>
        </View>
    );
}

export function WatchlistControls({options, onChange, genres, collections, onManageCollections, onPick, canPick}: {
    options: WatchlistViewOptions;
    onChange: (value: WatchlistViewOptions) => void;
    genres: string[];
    collections: {id: string; name: string}[];
    onManageCollections: () => void;
    onPick: () => void;
    canPick: boolean;
}) {
    const {colors} = usePalette();
    const {isPhone} = useResponsive();
    const [showFilters, setShowFilters] = useState(false);
    const filtered = !!(options.genre || options.collectionId || options.maxRuntimeMinutes || (options.sort ?? 'saved') !== 'saved');
    const selectedCollection = collections.find((collection) => collection.id === options.collectionId);

    return (
        <View style={styles.controls}>
            <View style={styles.searchRow}>
                <View style={[styles.search, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
                    <Ionicons name="search" size={17} color={colors.textMuted}/>
                    <TextInput value={options.query ?? ''} onChangeText={(query) => onChange({...options, query})}
                               accessibilityLabel="Search watchlist" placeholder="Search watchlist"
                               placeholderTextColor={colors.textFaint} autoCorrect={false} returnKeyType="search"
                               style={[styles.searchInput, {color: colors.text}]}/>
                    {options.query ? (
                        <PressableScale onPress={() => onChange({...options, query: ''})} accessibilityRole="button"
                                        accessibilityLabel="Clear watchlist search" contentStyle={styles.searchClear}>
                            <Ionicons name="close" size={17} color={colors.textMuted}/>
                        </PressableScale>
                    ) : null}
                </View>
                <WatchlistControlButton label="Pick for me" icon="shuffle" onPress={onPick} disabled={!canPick} iconOnly={isPhone}/>
                <WatchlistControlButton label="Sort and filter" icon="options-outline" onPress={() => setShowFilters(true)}
                                        active={filtered} iconOnly={isPhone}/>
            </View>
            <View style={styles.statusRow}>
                <View style={styles.statuses}>
                    <ChipBar chips={STATUSES} active={options.status ?? 'all'} contentPadding={0}
                             onSelect={(status) => onChange({...options, status: status as WatchlistStatus})}/>
                </View>
                <WatchlistControlButton label="Manage collections" icon="folder-outline" onPress={onManageCollections} iconOnly={isPhone}/>
            </View>
            {selectedCollection ? (
                <View style={styles.collection}>
                    <Ionicons name="folder-outline" size={15} color={colors.textMuted}/>
                    <ThemedText numberOfLines={1} style={[styles.collectionName, {color: colors.textMuted}]}>{selectedCollection.name}</ThemedText>
                    <PressableScale onPress={() => onChange({...options, collectionId: undefined})}
                                    accessibilityRole="button" accessibilityLabel="Show all collections" contentStyle={styles.searchClear}>
                        <Ionicons name="close" size={17} color={colors.textMuted}/>
                    </PressableScale>
                </View>
            ) : null}
            <WatchlistSheet visible={showFilters} title="Sort and filter" onClose={() => setShowFilters(false)}>
                <Choices title="Sort" options={SORTS} value={options.sort ?? 'saved'} onChange={(sort) => onChange({...options, sort})}/>
                <Choices title="Collection" options={[{value: '', label: 'All collections'}, ...collections.map(({id, name}) => ({value: id, label: name}))]}
                         value={options.collectionId ?? ''} onChange={(collectionId) => onChange({...options, collectionId: collectionId || undefined})}/>
                <Choices title="Genre" options={[{value: '', label: 'Any genre'}, ...genres.map((genre) => ({value: genre, label: genre}))]}
                         value={options.genre ?? ''} onChange={(genre) => onChange({...options, genre: genre || undefined})}/>
                <Choices title="Runtime" options={[{value: 0, label: 'Any length'}, {value: 90, label: 'Up to 90 min'}, {value: 120, label: 'Up to 2 hours'}]}
                         value={options.maxRuntimeMinutes ?? 0} onChange={(maxRuntimeMinutes) => onChange({...options, maxRuntimeMinutes: maxRuntimeMinutes || undefined})}/>
                <View style={styles.choiceRow}>
                    <WatchlistControlButton label="Reset filters" onPress={() => onChange({query: options.query, status: 'all', sort: 'saved'})}/>
                    <WatchlistControlButton label="Done" active onPress={() => setShowFilters(false)}/>
                </View>
            </WatchlistSheet>
        </View>
    );
}

const styles = StyleSheet.create({
    controls: {gap: Spacing.sm, marginTop: Spacing.lg},
    searchRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    search: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 44, paddingLeft: Spacing.md, paddingRight: Spacing.xs, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth},
    searchInput: {flex: 1, minWidth: 0, fontSize: 14, padding: 0},
    searchClear: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
    button: {minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.md},
    iconButton: {width: 44, paddingHorizontal: 0},
    buttonText: {fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1},
    statusRow: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    statuses: {flex: 1, minWidth: 0},
    choices: {gap: Spacing.sm},
    sectionLabel: {fontSize: 13, fontWeight: '600'},
    choiceRow: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm},
    collection: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    collectionName: {fontSize: 13, flex: 1},
});
