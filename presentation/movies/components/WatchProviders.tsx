import {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useDeviceRegion} from './watchRegion';
import Animated from 'react-native-reanimated';
import type {MovieDetails, StreamingAvailability, TitleMedia} from '@/domain';
import {usePreferencesRepository, useStreamingRepository} from '../../di/DependenciesContext';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterFade} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {usePreferences} from '../../hooks/use-preferences';
import {useToast} from '../../components/toast';
import {countryName, WatchRegionPicker} from './WatchRegionPicker';
import {StreamingOffers} from './StreamingOffers';
import {openStreamingLink} from './openStreamingLink';

export {deviceRegion} from './watchRegion';

export function WatchProviders({details, imdbCode, media, pad = 0}: {
    details?: Pick<MovieDetails, 'id' | 'imdbCode' | 'title'>;
    imdbCode?: string;
    title?: string;
    media?: TitleMedia;
    pad?: number;
}) {
    const {colors} = usePalette();
    const preferences = usePreferences();
    const preferencesRepository = usePreferencesRepository();
    const streaming = useStreamingRepository();
    const toast = useToast();
    const automatic = useDeviceRegion();
    const region = preferences.watchRegion ?? automatic;
    const identity = details?.imdbCode ?? imdbCode;
    const [pickingCountry, setPickingCountry] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const key = `${identity}:${media ?? 'auto'}:${region}:${attempt}`;
    const [result, setResult] = useState<{key: string; value: StreamingAvailability} | null>(null);
    const current = result?.key === key ? result.value : null;
    const selected = preferences.streamingServices?.[region] ?? [];

    useEffect(() => {
        let active = true;
        if (!identity) return;
        void streaming.getAvailability(identity, region, media).then(value => {
            if (active) setResult({key, value: value.country === region ? value
                : {country: region, status: 'unavailable', offers: []}});
        }).catch(() => {
            if (active) setResult({key, value: {country: region, status: 'unavailable', offers: []}});
        });
        return () => {active = false;};
    }, [identity, key, media, region, streaming]);

    const open = async (url: string) => {
        if (details) Analytics.watchProviderOpen(details.id, region);
        try {await openStreamingLink(url);} catch {toast('Couldn’t open viewing options. Please try again.');}
    };

    if (!identity) return null;

    return (
        <Animated.View entering={enterFade()} style={styles.section}>
            <View style={styles.heading}>
                <ThemedText type="heading" style={[styles.title, {color: colors.text}]}>Where to watch</ThemedText>
                <PressableScale onPress={() => setPickingCountry(true)} accessibilityRole="button"
                    accessibilityLabel={`Change viewing country, currently ${countryName(region)}`}
                    contentStyle={styles.country}>
                    <ThemedText style={[styles.countryLabel, {color: colors.accent}]}>{countryName(region)}</ThemedText>
                    <Ionicons name="chevron-down" size={14} color={colors.accent}/>
                </PressableScale>
            </View>
            {!current ? <ActivityIndicator style={styles.loading} color={colors.accent}
                accessibilityLabel="Loading viewing options"/> : current.status === 'unavailable' ? (
                <View style={styles.message}>
                    <ThemedText style={{color: colors.textMuted}}>Viewing options couldn’t be loaded.</ThemedText>
                    <PressableScale onPress={() => setAttempt(value => value + 1)} accessibilityRole="button" contentStyle={styles.retry}>
                        <ThemedText style={{color: colors.accent}}>Try again</ThemedText>
                    </PressableScale>
                </View>
            ) : current.status === 'unsupported-country' ? (
                <ThemedText style={{color: colors.textMuted}}>Streaming availability isn’t covered for {countryName(region)} yet.</ThemedText>
            ) : current.offers.length ? (
                <StreamingOffers offers={current.offers} selected={selected} onOpen={url => void open(url)} pad={pad}/>
            ) : (
                <ThemedText style={{color: colors.textMuted}}>No viewing options listed for {countryName(region)}.</ThemedText>
            )}
            {!current?.offers.length ? <PressableScale onPress={() => void open('https://www.justwatch.com')}
                accessibilityRole="link" accessibilityLabel="Streaming availability by JustWatch" contentStyle={styles.attribution}>
                <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>JustWatch ↗</ThemedText>
            </PressableScale> : null}
            {pickingCountry ? <WatchRegionPicker selected={preferences.watchRegion ?? null} automatic={automatic}
                onSelect={code => preferencesRepository.setWatchRegion(code)} onClose={() => setPickingCountry(false)}/> : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    section: {gap: Spacing.md, marginTop: Spacing.lg},
    heading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm},
    title: {fontSize: 22, lineHeight: 30, letterSpacing: -0.4},
    country: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 44},
    countryLabel: {fontSize: 13, lineHeight: 20},
    attribution: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
    message: {gap: Spacing.sm},
    retry: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
    loading: {alignSelf: 'flex-start', paddingVertical: Spacing.sm},
});
