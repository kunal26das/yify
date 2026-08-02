import {useEffect, useMemo, useState} from 'react';
import {Linking, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {Image} from 'expo-image';
import Animated from 'react-native-reanimated';
import type {MovieDetails, WatchAvailability, WatchProvider} from '@/domain';
import {TmdbApiDataSource, TmdbRepositoryImpl} from '@/data';
import {getTmdbApiKey, remoteConfigReady} from '@/lib/remote-config';
import {Analytics} from '@/lib/analytics-events';
import {PressableScale, enterFade} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing, Typography} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';

const OFFER_LABEL: Record<WatchProvider['offer'], string> = {
    stream: 'Stream',
    rent: 'Rent',
    buy: 'Buy',
};

export function deviceRegion(): string {
    try {
        const locale =
            Platform.OS === 'web' && typeof navigator !== 'undefined'
                ? navigator.language
                : new Intl.DateTimeFormat().resolvedOptions().locale;
        const region = locale?.split('-')[1];
        return region ? region.toUpperCase() : 'US';
    } catch {
        return 'US';
    }
}

export function WatchProviders({details, pad = 0}: {details: MovieDetails; pad?: number}) {
    const {colors} = usePalette();
    const [availability, setAvailability] = useState<WatchAvailability | null>(null);

    const repository = useMemo(
        () =>
            new TmdbRepositoryImpl(
                new TmdbApiDataSource(async () => {
                    await remoteConfigReady();
                    return getTmdbApiKey();
                })
            ),
        []
    );

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

    if (!availability || availability.providers.length === 0) return null;

    const open = () => {
        if (!availability.link) return;
        Analytics.watchProviderOpen(details.id, availability.region);
        void Linking.openURL(availability.link);
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
                {availability.providers.map((provider) => (
                    <PressableScale
                        key={`${provider.offer}-${provider.id}`}
                        onPress={open}
                        disabled={!availability.link}
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
                                contentFit="cover"
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
            <ThemedText style={[styles.credit, {color: colors.textFaint}]}>
                Availability in {availability.region} from JustWatch via TMDB
            </ThemedText>
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
    credit: {fontSize: 11.5, lineHeight: 16},
});
