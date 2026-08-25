import {useEffect, useState} from 'react';
import {Linking, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import Animated from 'react-native-reanimated';
import type {MovieDetails, WatchAvailability, WatchProvider} from '@/domain';
import {useTmdbRepository} from '../../di/DependenciesContext';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterFade} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {providerLinkable, providerUrl} from './providerLinks';

const OFFER_LABEL: Record<WatchProvider['offer'], string> = {
    stream: 'Stream',
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
        const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        const city = zone?.split('/').pop();
        if (city && ZONE_REGION[city]) return ZONE_REGION[city];
        if (zone?.startsWith('America/')) return 'US';
        if (zone?.startsWith('Europe/')) return 'GB';
    } catch {
    }
    try {
        const locale =
            Platform.OS === 'web' && typeof navigator !== 'undefined'
                ? navigator.language
                : new Intl.DateTimeFormat().resolvedOptions().locale;
        const region = locale?.split('-')[1];
        if (region) return region.toUpperCase();
    } catch {
    }
    return 'US';
}

export function WatchProviders({details, pad = 0}: {details: MovieDetails; pad?: number}) {
    const {colors} = usePalette();
    const [availability, setAvailability] = useState<WatchAvailability | null>(null);

    const repository = useTmdbRepository();

    useEffect(() => {
        let active = true;
        setAvailability(null);
        if (!details.imdbCode) return;

        void (async () => {
            const artwork = await repository.findByImdbCode(details.imdbCode);
            if (!active || !artwork) return;
            const found = await repository.getWatchAvailability(
                artwork.tmdbId,
                artwork.media,
                deviceRegion()
            );
            if (active) setAvailability(found);
        })();

        return () => {
            active = false;
        };
    }, [details.imdbCode, repository]);

    const shown = (availability?.providers ?? []).filter((provider) => providerLinkable(provider.id));
    if (!availability || shown.length === 0) return null;

    const open = (provider: WatchProvider) => {
        const url = providerUrl(provider.id, details.title);
        if (!url) return;
        Analytics.watchProviderOpen(details.id, availability.region);
        if (Platform.OS === 'web') {
            void Linking.openURL(url);
            return;
        }
        void WebBrowser.openBrowserAsync(url, {enableBarCollapsing: true}).catch(() => Linking.openURL(url));
    };

    return (
        <Animated.View entering={enterFade()} style={styles.section}>
            <ThemedText type="section" style={{color: colors.text}}>
                Watch on
            </ThemedText>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{marginHorizontal: -pad}}
                contentContainerStyle={[styles.row, {paddingHorizontal: pad}]}
            >
                {shown.map((provider) => (
                    <PressableScale
                        key={`${provider.offer}-${provider.id}`}
                        onPress={() => open(provider)}
                        accessibilityRole="link"
                        accessibilityLabel={`${OFFER_LABEL[provider.offer]} on ${provider.name}`}
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
                ))}
            </ScrollView>
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
});
