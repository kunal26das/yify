import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {StreamingCatalog, StreamingService} from '@/domain';
import {useStreamingRepository} from '../../di/DependenciesContext';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {useToast} from '../../components/toast';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {countryName} from './WatchRegionPicker';
import {openStreamingLink} from './openStreamingLink';
import {PickerSheet, PickerSheetInput} from './PickerSheet';
import {Analytics} from '../../analytics/events';

interface ServiceOption extends StreamingService {
    unavailable?: boolean;
}

export function StreamingServicesPicker({country, selected, onSelect, onClose}: {
    country: string;
    selected: string[];
    onSelect: (ids: string[]) => void;
    onClose: () => void;
}) {
    const {colors} = usePalette();
    const repository = useStreamingRepository();
    const toast = useToast();
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [catalog, setCatalog] = useState<StreamingCatalog | null>(null);

    useEffect(() => {
        let active = true;
        void repository.getCatalog(country).then(result => {
            if (active) setCatalog(result);
        }).catch(() => {
            if (active) setCatalog({status: 'unavailable', countries: []});
        });
        return () => { active = false; };
    }, [repository, country, attempt]);

    const currentCountry = catalog?.countries.find(item => item.code === country);
    const unavailable = catalog?.status === 'unavailable';
    const unsupported = catalog?.status === 'ready' && !currentCountry;
    const countryLabel = currentCountry?.name ?? countryName(country);
    const selectedIds = useMemo(() => new Set(selected), [selected]);
    const options = useMemo(() => {
        const available: ServiceOption[] = currentCountry?.services ?? [];
        const knownIds = new Set(available.map(service => service.id));
        const saved: ServiceOption[] = selected.filter(id => !knownIds.has(id)).map(id => ({
            id,
            name: id,
            unavailable: true,
        }));
        const search = query.trim().toLocaleLowerCase();
        return [...available, ...saved]
            .filter(service => `${service.name} ${service.parentName ?? ''}`.toLocaleLowerCase().includes(search))
            .sort((left, right) => Number(Boolean(left.parentName)) - Number(Boolean(right.parentName))
                || left.name.localeCompare(right.name)
                || (left.parentName ?? '').localeCompare(right.parentName ?? ''));
    }, [currentCountry, query, selected]);

    const toggle = (id: string) => {
        const next = selectedIds.has(id) ? selected.filter(item => item !== id) : [...selected, id];
        onSelect(next);
        Analytics.subscriptionFunnel({step: 'streaming_services_saved', selectedCount: next.length}, country);
    };

    const openAttribution = async () => {
        try {
            await openStreamingLink('https://www.justwatch.com');
        } catch {
            toast('Couldn’t open the availability source. Please try again.');
        }
    };

    return (
        <PickerSheet<ServiceOption> title="My streaming services" onClose={onClose}
            backdropLabel="Close streaming services picker" maxWidth={520}
            listProps={{
                data: catalog ? options : [],
                keyExtractor: service => service.id,
                extraData: selected,
                ListHeaderComponent: (<View style={styles.listHeading}>
                    <View style={styles.intro}>
                        <ThemedText style={{color: colors.textMuted}}>Choose services you use in {countryLabel}.</ThemedText>
                        <ThemedText type="caption" style={{color: colors.textMuted}}>This saves your choices without connecting accounts.</ThemedText>
                    </View>
                    <PickerSheetInput value={query} onChangeText={setQuery} placeholder="Search services"
                        accessibilityLabel="Search streaming services" placeholderTextColor={colors.textFaint}
                        autoCorrect={false} autoCapitalize="none"
                        style={[styles.search, {color: colors.text, borderColor: colors.border}]}/>
                    {unavailable ? <View style={styles.message}>
                        <ThemedText style={{color: colors.textMuted}}>Services couldn’t be loaded.</ThemedText>
                        <PressableScale onPress={() => {setCatalog(null); setAttempt(value => value + 1);}}
                            accessibilityRole="button" contentStyle={styles.retry}>
                            <ThemedText style={{color: colors.accent}}>Try again</ThemedText>
                        </PressableScale>
                    </View> : unsupported ? <ThemedText style={[styles.message, {color: colors.textMuted}]}>
                        Streaming availability isn’t supported in {countryLabel} yet.
                    </ThemedText> : null}
                </View>),
                ListEmptyComponent: (!catalog ? <ActivityIndicator style={styles.message} color={colors.accent}
                    accessibilityLabel="Loading streaming services"/> : !unavailable && !unsupported ? <ThemedText style={[styles.message, {color: colors.textMuted}]}>
                        {query.trim() ? 'No matching services.' : `No streaming services listed for ${countryLabel}.`}
                    </ThemedText> : null),
                renderItem: ({item}) => {
                    const added = selectedIds.has(item.id);
                    const label = item.parentName ? `${item.name} through ${item.parentName}` : item.name;
                    return <PressableScale onPress={() => toggle(item.id)} accessibilityRole="checkbox"
                        accessibilityState={{checked: added}} accessibilityLabel={label}
                        accessibilityHint={item.unavailable ? 'Remove this saved service' : undefined}
                        contentStyle={[styles.option, {backgroundColor: added ? colors.accentSoft : 'transparent'}]}>
                        <View style={styles.flex}>
                            <ThemedText style={{color: colors.text}}>{item.name}</ThemedText>
                            {item.parentName ? <ThemedText type="caption" style={{color: colors.textMuted}}>
                                Add-on through {item.parentName}
                            </ThemedText> : null}
                            {item.unavailable ? <ThemedText type="caption" style={{color: colors.textMuted}}>
                                {unavailable ? 'Saved service · tap to remove' : 'No longer listed · tap to remove'}
                            </ThemedText> : null}
                        </View>
                        <Ionicons name={added ? 'checkbox' : 'square-outline'} size={24}
                            color={added ? colors.accent : colors.textMuted}/>
                    </PressableScale>;
                },
            }}
            footer={<View style={[styles.footer, {borderTopColor: colors.border}]}>
                <View style={styles.flex}>
                    <ThemedText type="caption" style={{color: colors.textMuted}}>{selected.length} added</ThemedText>
                    {catalog?.status === 'ready' ? <PressableScale
                        onPress={() => void openAttribution()} accessibilityRole="link"
                        accessibilityLabel="Streaming services by JustWatch" contentStyle={styles.attribution}>
                        <ThemedText type="caption" style={{color: colors.textMuted}}>JustWatch ↗</ThemedText>
                    </PressableScale> : null}
                </View>
                <PressableScale onPress={onClose} accessibilityRole="button"
                    contentStyle={[styles.done, {backgroundColor: colors.accent}]}>
                    <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Done</ThemedText>
                </PressableScale>
                    </View>}
        />
    );
}

const styles = StyleSheet.create({
    intro: {gap: Spacing.xs},
    listHeading: {gap: Spacing.md, paddingBottom: Spacing.sm},
    flex: {flex: 1, minWidth: 0},
    search: {borderWidth: 1, borderRadius: Radius.card, minHeight: 44, paddingHorizontal: Spacing.md, fontSize: 16},
    option: {minHeight: 52, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.card, flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    message: {paddingVertical: Spacing.sm, gap: Spacing.xs},
    retry: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
    attribution: {minHeight: 44, justifyContent: 'center'},
    footer: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm},
    done: {minHeight: 44, minWidth: 80, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg},
});
