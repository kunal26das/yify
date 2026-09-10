import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import * as Localization from 'expo-localization';
import Animated from 'react-native-reanimated';
import type {MovieDetails, TitleMedia, WatchAvailability, WatchProvider} from '@/domain';
import {usePreferencesRepository, useTmdbRepository} from '../../di/DependenciesContext';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterFade} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {usePreferences} from '../../hooks/use-preferences';
import {useToast} from '../../components/toast';
import {providerUrl} from './providerLinks';
import {countryName, WatchRegionPicker} from './WatchRegionPicker';

const OFFER_LABEL: Record<WatchProvider['offer'], string> = {
    stream: 'Stream',
    free: 'Free',
    ads: 'With ads',
    rent: 'Rent',
    buy: 'Buy',
};

const ZONE_REGION: Record<string, string> = {
    Kolkata: 'IN', Calcutta: 'IN', Colombo: 'LK', Karachi: 'PK', Dhaka: 'BD', Kathmandu: 'NP',
    London: 'GB', Dublin: 'IE', Paris: 'FR', Berlin: 'DE', Madrid: 'ES', Rome: 'IT',
    Amsterdam: 'NL', Brussels: 'BE', Lisbon: 'PT', Zurich: 'CH', Vienna: 'AT', Stockholm: 'SE',
    Oslo: 'NO', Copenhagen: 'DK', Helsinki: 'FI', Warsaw: 'PL', Prague: 'CZ', Moscow: 'RU',
    Istanbul: 'TR', Athens: 'GR', Dubai: 'AE', Riyadh: 'SA', Doha: 'QA', Jerusalem: 'IL',
    Tokyo: 'JP', Seoul: 'KR', Shanghai: 'CN', Hong_Kong: 'HK', Taipei: 'TW', Singapore: 'SG',
    Bangkok: 'TH', Jakarta: 'ID', Manila: 'PH', Kuala_Lumpur: 'MY', Ho_Chi_Minh: 'VN',
    Sydney: 'AU', Melbourne: 'AU', Brisbane: 'AU', Perth: 'AU', Auckland: 'NZ',
    Toronto: 'CA', Vancouver: 'CA', Montreal: 'CA', Mexico_City: 'MX',
    Sao_Paulo: 'BR', Buenos_Aires: 'AR', Santiago: 'CL', Bogota: 'CO', Lima: 'PE',
    Johannesburg: 'ZA', Lagos: 'NG', Nairobi: 'KE', Cairo: 'EG', Casablanca: 'MA',
};

export function deviceRegion(): string {
    try {
        const region = Localization.getLocales()[0]?.regionCode;
        if (region && /^[A-Z]{2}$/.test(region.toUpperCase())) return region.toUpperCase();
    } catch {
    }
    try {
        const locale =
            Platform.OS === 'web' && typeof navigator !== 'undefined'
                ? navigator.language
                : new Intl.DateTimeFormat().resolvedOptions().locale;
        const region = locale ? new Intl.Locale(locale).region : undefined;
        if (region && /^[A-Z]{2}$/.test(region.toUpperCase())) return region.toUpperCase();
    } catch {
    }
    try {
        const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        const city = zone?.split('/').pop();
        if (city && ZONE_REGION[city]) return ZONE_REGION[city];
        if (zone?.startsWith('America/')) return 'US';
        if (zone?.startsWith('Europe/')) return 'GB';
    } catch {
    }
    return 'US';
}

export function WatchProviders({details, imdbCode, title, media, pad = 0}: {
    details?: Pick<MovieDetails, 'id' | 'imdbCode' | 'title'>;
    imdbCode?: string;
    title?: string;
    media?: TitleMedia;
    pad?: number;
}) {
    const {colors} = usePalette();
    const preferences = usePreferences();
    const preferencesRepository = usePreferencesRepository();
    const repository = useTmdbRepository();
    const toast = useToast();
    const automatic = useMemo(() => deviceRegion(), []);
    const region = preferences.watchRegion ?? automatic;
    const identity = details?.imdbCode ?? imdbCode;
    const displayTitle = details?.title ?? title ?? '';
    const [pickingCountry, setPickingCountry] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const key = `${identity}:${media ?? 'auto'}:${region}:${attempt}`;
    const [result, setResult] = useState<{
        key: string;
        status: 'ready' | 'error';
        availability: WatchAvailability | null;
    } | null>(null);
    const current = result?.key === key ? result : null;
    const availability = current?.availability;

    useEffect(() => {
        let active = true;
        if (!identity) return;

        void (async () => {
            try {
                const artwork = await repository.findByImdbCode(identity);
                if (!active) return;
                if (!artwork || (media && artwork.media !== media)) {
                    setResult({key, status: 'ready', availability: null});
                    return;
                }
                const found = await repository.getWatchAvailability(artwork.tmdbId, artwork.media, region);
                if (active) setResult({key, status: 'ready', availability: found});
            } catch {
                if (active) setResult({key, status: 'error', availability: null});
            }
        })();

        return () => {
            active = false;
        };
    }, [identity, key, media, region, repository]);

    const open = async (url: string | undefined) => {
        if (!url) return;
        if (details) Analytics.watchProviderOpen(details.id, region);
        try {
            if (Platform.OS === 'web') await Linking.openURL(url);
            else await WebBrowser.openBrowserAsync(url, {enableBarCollapsing: true});
        } catch {
            toast('Couldn’t open viewing options. Please try again.');
        }
    };

    if (!identity) return null;

    return (
        <Animated.View entering={enterFade()} style={styles.section}>
            <View style={styles.heading}>
                <ThemedText type="section" style={{color: colors.text}}>Where to watch</ThemedText>
                <PressableScale onPress={() => setPickingCountry(true)} accessibilityRole="button"
                    accessibilityLabel={`Change viewing country, currently ${countryName(region)}`}
                    contentStyle={styles.country}>
                    <ThemedText style={{color: colors.accent}}>{countryName(region)}</ThemedText>
                    <Ionicons name="chevron-down" size={14} color={colors.accent}/>
                </PressableScale>
            </View>
            {!current ? <ActivityIndicator style={styles.loading} color={colors.accent}/> : current.status === 'error' ? (
                <View style={styles.message}>
                    <ThemedText style={{color: colors.textMuted}}>Viewing options couldn’t be loaded.</ThemedText>
                    <PressableScale onPress={() => setAttempt(value => value + 1)} accessibilityRole="button">
                        <ThemedText style={{color: colors.accent}}>Try again</ThemedText>
                    </PressableScale>
                </View>
            ) : !availability?.providers.length ? (
                <ThemedText style={{color: colors.textMuted}}>No viewing options listed for {countryName(region)}.</ThemedText>
            ) : <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{marginHorizontal: -pad}}
                contentContainerStyle={[styles.row, {paddingHorizontal: pad}]}
            >
                {availability.providers.map((provider) => {
                    const url = availability.url ?? providerUrl(provider.id, displayTitle);
                    return (
                    <PressableScale
                        key={`${provider.offer}-${provider.id}`}
                        onPress={url ? () => void open(url) : undefined}
                        accessibilityRole={url ? 'link' : 'text'}
                        accessibilityLabel={`${OFFER_LABEL[provider.offer]} on ${provider.name}${url ? ', view options' : ''}`}
                        pressedScale={0.96}
                        pressedOpacity={0.85}
                        contentStyle={[
                            styles.provider,
                            {backgroundColor: colors.surfaceSunken, borderColor: colors.border},
                        ]}
                    >
                        {provider.logoUrl ? (
                            <Image
                                source={{uri: provider.logoUrl}}
                                style={styles.logo}
                                contentFit="contain"
                                transition={140}
                                cachePolicy="memory-disk"
                            />
                        ) : null}
                        <View style={styles.providerText}>
                            <ThemedText numberOfLines={1} style={[styles.name, {color: colors.text}]}>
                                {provider.name}
                            </ThemedText>
                            <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>
                                {OFFER_LABEL[provider.offer]}
                            </ThemedText>
                        </View>
                    </PressableScale>
                    );
                })}
            </ScrollView>}
            <View style={styles.footer}>
                <ThemedText style={[Typography.videoMeta, {color: colors.textMuted}]}>Availability by JustWatch</ThemedText>
                {availability?.url ? <PressableScale onPress={() => void open(availability.url)} accessibilityRole="link">
                    <ThemedText style={[Typography.videoMeta, {color: colors.accent}]}>View all options ↗</ThemedText>
                </PressableScale> : null}
            </View>
            {pickingCountry ? <WatchRegionPicker selected={preferences.watchRegion ?? null} automatic={automatic}
                onSelect={code => preferencesRepository.setWatchRegion(code)} onClose={() => setPickingCountry(false)}/> : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    section: {gap: Spacing.sm, marginTop: Spacing.sm},
    row: {flexDirection: 'row', gap: Spacing.sm, alignItems: 'center'},
    provider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingRight: Spacing.md,
        borderRadius: Radius.card,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    logo: {width: 40, height: 40},
    providerText: {gap: 1},
    name: {fontSize: 14, fontWeight: '600'},
    heading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm},
    country: {flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 44},
    footer: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.sm},
    message: {gap: Spacing.sm},
    loading: {alignSelf: 'flex-start', paddingVertical: Spacing.sm},
});
