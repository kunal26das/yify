import {StyleSheet} from 'react-native';
import {streamingOfferSelected, type StreamingAvailability} from '@/domain';
import {ThemedText} from '../../components/themed-text';
import {Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {POSTER_GAP} from './moviePosterLayout';

export function WatchlistStreamingBadge({availability, country, services, validId}: {
    availability?: StreamingAvailability;
    country: string;
    services: string[];
    validId: boolean;
}) {
    const {colors} = usePalette();
    const current = availability?.country === country ? availability : undefined;
    const matches = current?.status === 'ready'
        ? [...new Set(current.offers.filter(offer => streamingOfferSelected(offer, services))
            .map(offer => offer.addonName ? `${offer.serviceName} · ${offer.addonName}` : offer.serviceName))] : [];
    const label = !validId ? 'Availability unavailable'
        : !current ? 'Not checked'
        : current.status === 'unavailable' ? 'Couldn’t check availability'
        : current.status === 'unsupported-country' ? 'Country not covered'
        : matches.length ? `On ${matches[0]}${matches.length > 1 ? ` +${matches.length - 1}` : ''}`
        : services.length ? 'Not listed on your services'
        : current.offers.length ? 'Viewing options available' : 'No viewing options listed';
    return <ThemedText type="caption" numberOfLines={2} style={[styles.label, {color: matches.length ? colors.accent : colors.textMuted}]}>
        {label}
    </ThemedText>;
}

const styles = StyleSheet.create({
    label: {marginHorizontal: POSTER_GAP / 2, marginBottom: Spacing.md, minHeight: 32},
});
