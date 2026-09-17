import {useMemo} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {streamingOfferLabel, streamingOfferSelected, type StreamingOffer} from '@/domain';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';

export function StreamingOffers({offers, selected, onOpen, pad = 0}: {
    offers: StreamingOffer[];
    selected: readonly string[];
    onOpen: (url: string) => void;
    pad?: number;
}) {
    const {colors} = usePalette();
    const sorted = useMemo(() => [...offers].sort((a, b) => Number(streamingOfferSelected(b, selected))
        - Number(streamingOfferSelected(a, selected))), [offers, selected]);
    return <View style={styles.content}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal: -pad}}
            contentContainerStyle={[styles.row, {paddingHorizontal: pad}]}>
            {sorted.map((offer, index) => {
                const mine = streamingOfferSelected(offer, selected);
                const url = offer.url;
                return <PressableScale key={`${offer.selectionId}:${offer.type}:${index}`}
                    style={styles.offerContainer}
                    disabled={!url} onPress={url ? () => onOpen(url) : undefined} accessibilityRole={url ? 'link' : 'text'}
                    accessibilityLabel={`${url ? 'View options for ' : ''}${offer.serviceName}, ${streamingOfferLabel(offer)}${mine ? ', your service' : ''}`}
                    contentStyle={[styles.offer, {backgroundColor: mine ? colors.accentSoft : colors.surfaceSunken,
                        borderColor: mine ? colors.accent : colors.border}]}>
                    <View style={styles.heading}>
                        <ThemedText style={styles.name}>{offer.serviceName}</ThemedText>
                        {url ? <Ionicons name="open-outline" size={17} color={colors.textMuted}/> : null}
                    </View>
                    <ThemedText style={[styles.meta, {color: colors.textMuted}]}>{streamingOfferLabel(offer)}</ThemedText>
                    {mine ? <ThemedText style={[styles.meta, {color: colors.accent}]}>Your service</ThemedText> : null}
                    {url ? <ThemedText style={[styles.meta, styles.action, {color: colors.accent}]}>View options</ThemedText> : null}
                </PressableScale>;
            })}
        </ScrollView>
        <PressableScale onPress={() => onOpen('https://www.justwatch.com')}
            accessibilityRole="link" accessibilityLabel="Streaming availability by JustWatch" contentStyle={styles.attribution}>
            <ThemedText style={[styles.meta, {color: colors.textMuted}]}>JustWatch ↗</ThemedText>
        </PressableScale>
    </View>;
}

const styles = StyleSheet.create({
    content: {gap: Spacing.sm},
    row: {flexDirection: 'row', gap: Spacing.sm, alignItems: 'stretch'},
    offerContainer: {alignSelf: 'stretch'},
    offer: {flexGrow: 1, minWidth: 150, maxWidth: 280, minHeight: 64, padding: Spacing.md, gap: Spacing.xs,
        borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card},
    heading: {flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    name: {fontSize: 14, fontWeight: '600', flexShrink: 1},
    meta: {fontSize: 12, lineHeight: 17},
    action: {marginTop: 'auto'},
    attribution: {minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'},
});
