import {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type {WatchRegion} from '@/domain';
import {useCountryLocation, useTmdbRepository} from '../../di/DependenciesContext';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {PickerSheet, PickerSheetInput} from './PickerSheet';
import {Analytics} from '../../analytics/events';

export function countryName(code: string): string {
    try {
        return new Intl.DisplayNames(['en'], {type: 'region'}).of(code) ?? code;
    } catch {
        return code;
    }
}

export function WatchRegionPicker({selected, automatic, onSelect, onClose}: {
    selected: string | null;
    automatic: string;
    onSelect: (code: string | null) => void;
    onClose: () => void;
}) {
    const {colors} = usePalette();
    const repository = useTmdbRepository();
    const countryLocation = useCountryLocation();
    const locationRequest = useRef<AbortController | null>(null);
    const [locating, setLocating] = useState(false);
    const [locationMessage, setLocationMessage] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{regions: WatchRegion[]; failed: boolean} | null>(null);

    useEffect(() => () => locationRequest.current?.abort(), []);

    useEffect(() => {
        let active = true;
        void repository.getWatchRegions().then(regions => {
            if (active) setResult({regions: [...regions].sort((a, b) => a.name.localeCompare(b.name)), failed: !regions.length});
        }).catch(() => {
            if (active) setResult({regions: [], failed: true});
        });
        return () => { active = false; };
    }, [repository, attempt]);

    const regions = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return (result?.regions ?? []).filter(region =>
            `${region.name} ${region.code}`.toLocaleLowerCase().includes(search));
    }, [query, result]);

    const close = () => {
        locationRequest.current?.abort();
        onClose();
    };

    const choose = (code: string | null, method: 'manual' | 'location' = 'manual') => {
        locationRequest.current?.abort();
        onSelect(code);
        Analytics.subscriptionFunnel({step: 'streaming_country_selected', method}, code ?? automatic);
        onClose();
    };

    const locate = async () => {
        if (locationRequest.current || !result || result.failed) return;
        const request = new AbortController();
        locationRequest.current = request;
        setLocating(true);
        setLocationMessage(null);
        try {
            const location = await countryLocation.requestCountry(request.signal);
            if (request.signal.aborted) return;
            if (location.status === 'ready') {
                if (result.regions.some(region => region.code === location.country)) {
                    choose(location.country, 'location');
                } else {
                    setLocationMessage(`Streaming availability isn’t supported in ${countryName(location.country)} yet. Choose a country below.`);
                }
            } else {
                setLocationMessage(location.status === 'denied'
                    ? 'Location access is off. You can allow it in settings or choose a country below.'
                    : location.status === 'timeout'
                        ? 'Finding your country took too long. Try again or choose below.'
                        : 'Your country couldn’t be detected. Choose a country below.');
            }
        } catch {
            if (!request.signal.aborted) setLocationMessage('Your country couldn’t be detected. Choose a country below.');
        } finally {
            if (locationRequest.current === request) locationRequest.current = null;
            if (!request.signal.aborted) setLocating(false);
        }
    };

    return (
        <PickerSheet<WatchRegion> title="Where do you watch?" onClose={close} backdropLabel="Close country picker"
            listProps={{
                data: regions,
                keyExtractor: region => region.code,
                ListHeaderComponent: (<View style={styles.listHeading}>
                    <PickerSheetInput value={query} onChangeText={setQuery} placeholder="Search countries"
                        accessibilityLabel="Search countries" placeholderTextColor={colors.textFaint}
                        autoCorrect={false} style={[styles.search, {color: colors.text, borderColor: colors.border}]}/>
                    <PressableScale onPress={() => choose(null)} accessibilityRole="button"
                        accessibilityState={{selected: selected === null}}
                        contentStyle={[styles.option, {backgroundColor: selected === null ? colors.accentSoft : colors.surfaceSunken}]}>
                        <ThemedText style={[styles.optionLabel, {color: colors.text}]}>Use device country · {countryName(automatic)}</ThemedText>
                        {selected === null ? <Ionicons name="checkmark" size={20} color={colors.accent}/> : null}
                    </PressableScale>
                    <View style={styles.location}>
                        <PressableScale onPress={locate} disabled={locating || !result || result.failed}
                            accessibilityRole="button" accessibilityLabel="Use current location"
                            accessibilityState={{busy: locating, disabled: locating || !result || result.failed}}
                            contentStyle={[styles.option, {backgroundColor: colors.surfaceSunken}]}>
                            <ThemedText style={[styles.optionLabel, {color: colors.accent}]}>{locating ? 'Finding your country…' : 'Use current location'}</ThemedText>
                            {locating ? <ActivityIndicator color={colors.accent}/> : <Ionicons name="locate-outline" size={20} color={colors.accent}/>}
                        </PressableScale>
                        {locationMessage ? <ThemedText type="caption" accessibilityLiveRegion="polite"
                            style={{color: colors.textMuted}}>{locationMessage}</ThemedText> : null}
                    </View>
                </View>),
                ListEmptyComponent: (!result ? <ActivityIndicator style={styles.message} color={colors.accent}/> : result.failed ? (
                    <View style={styles.message}>
                        <ThemedText style={{color: colors.textMuted}}>Countries couldn’t be loaded.</ThemedText>
                        <PressableScale onPress={() => {setResult(null); setAttempt(value => value + 1);}} accessibilityRole="button">
                            <ThemedText style={{color: colors.accent}}>Try again</ThemedText>
                        </PressableScale>
                    </View>
                ) : <ThemedText style={styles.message}>No matching countries</ThemedText>),
                renderItem: ({item}) => (
                    <PressableScale onPress={() => choose(item.code)} accessibilityRole="button"
                        accessibilityState={{selected: selected === item.code}}
                        contentStyle={[styles.option, {backgroundColor: selected === item.code ? colors.accentSoft : 'transparent'}]}>
                        <ThemedText style={[styles.optionLabel, {color: colors.text}]}>{item.name}</ThemedText>
                        {selected === item.code ? <Ionicons name="checkmark" size={20} color={colors.accent}/> : null}
                    </PressableScale>
                ),
            }}/>
    );
}

const styles = StyleSheet.create({
    search: {borderWidth: 1, borderRadius: Radius.card, minHeight: 44, paddingHorizontal: Spacing.md, fontSize: 16},
    option: {minHeight: 48, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm},
    optionLabel: {flex: 1, minWidth: 0},
    location: {gap: Spacing.xs},
    listHeading: {gap: Spacing.md, paddingBottom: Spacing.md},
    message: {padding: Spacing.md, gap: Spacing.md},
});
