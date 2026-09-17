import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import type {MovieDetails} from '@/domain';
import {PressableScale, enterFade, shiftLayout} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {formatCompact, metaParts} from './format';

function GenreChip({label}: {label: string}) {
    const {colors} = usePalette();
    return (
        <View
            style={[
                styles.genreChip,
                {backgroundColor: colors.surface, borderColor: colors.border},
            ]}
        >
            <ThemedText style={[styles.genreLabel, {color: colors.text}]} numberOfLines={1}>
                {label}
            </ThemedText>
        </View>
    );
}

export function DescriptionCard({
    details,
    onGenrePress,
}: {
    details: MovieDetails;
    onGenrePress?: (genre: string) => void;
}) {
    const {colors} = usePalette();
    const [expanded, setExpanded] = useState(false);

    const description = details.descriptionFull || details.descriptionIntro || details.summary;
    const genres = details.genres;

    if (!description && genres.length === 0) return null;

    const hasRating = details.rating > 0;
    const segments = metaParts(details);
    if (details.downloadCount != null) {
        segments.push(`${formatCompact(details.downloadCount)} downloads`);
    }
    const metaLine = segments.join(' · ');

    return (
        <Animated.View
            layout={shiftLayout}
            style={[styles.card, {backgroundColor: colors.surfaceSunken}]}
        >
            <PressableScale
                onPress={() => setExpanded(true)}
                disabled={expanded}
                accessibilityRole="button"
                accessibilityLabel="Show full description"
                accessibilityState={{expanded}}
                pressedScale={0.99}
                pressedOpacity={0.8}
                contentStyle={styles.stack}
            >
                {hasRating || metaLine ? (
                    <View style={styles.metaRow}>
                        {hasRating ? (
                            <View style={styles.ratingGroup}>
                                <Ionicons name="star" size={13} color={colors.gold}/>
                                <ThemedText style={[styles.meta, {color: colors.textMuted}]}>
                                    {details.rating.toFixed(1)}
                                </ThemedText>
                            </View>
                        ) : null}
                        {metaLine ? (
                            <ThemedText style={[styles.meta, {color: colors.textMuted}]}>
                                {hasRating ? `· ${metaLine}` : metaLine}
                            </ThemedText>
                        ) : null}
                    </View>
                ) : null}
                {description ? (
                    <ThemedText
                        style={[styles.description, {color: colors.text}]}
                        numberOfLines={expanded ? undefined : 2}
                    >
                        {description}
                    </ThemedText>
                ) : null}
                {expanded ? null : (
                    <ThemedText style={[styles.affordance, {color: colors.accent}]}>...more</ThemedText>
                )}
            </PressableScale>

            {expanded ? (
                <Animated.View entering={enterFade()} layout={shiftLayout} style={styles.stack}>
                    {genres.length > 0 ? (
                        <View style={styles.genreRow}>
                            {genres.map((genre) =>
                                onGenrePress ? (
                                    <PressableScale
                                        key={genre}
                                        onPress={() => onGenrePress(genre)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Browse ${genre} movies`}
                                        pressedScale={0.95}
                                        pressedOpacity={0.75}
                                    >
                                        <GenreChip label={genre}/>
                                    </PressableScale>
                                ) : (
                                    <GenreChip key={genre} label={genre}/>
                                )
                            )}
                        </View>
                    ) : null}
                    <PressableScale
                        onPress={() => setExpanded(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Show less"
                        accessibilityState={{expanded}}
                        pressedScale={0.97}
                        pressedOpacity={0.75}
                        style={styles.showLess}
                    >
                        <ThemedText style={[styles.affordance, {color: colors.accent}]}>Show less</ThemedText>
                    </PressableScale>
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.lg},
    stack: {gap: Spacing.md},
    metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6},
    ratingGroup: {flexDirection: 'row', alignItems: 'center', gap: 3},
    meta: {fontSize: 12, lineHeight: 19, fontWeight: '500'},
    description: {fontSize: 15, lineHeight: 25, fontWeight: '400'},
    affordance: {fontSize: 13, lineHeight: 20, fontWeight: '600'},
    showLess: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center'},
    genreRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm},
    genreChip: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
    },
    genreLabel: {fontSize: 14, lineHeight: 18, fontWeight: '500', textTransform: 'capitalize'},
});
