import Ionicons from '@expo/vector-icons/Ionicons';
import {Image} from 'expo-image';
import {Link} from 'expo-router';
import {useRef} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import type {Movie} from '@/domain';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {ThemedText} from '../../components/themed-text';
import {Duration, PressableScale, enterFade, enterPop} from '../../components/motion';
import {getPosterContainerStyle, posterRung} from './moviePosterLayout';
import {Analytics} from '@/presentation/analytics/events';
import {useHoverCard} from './HoverCard';
import {NewBadge} from './NewBadge';
import {useTopTenRank} from './TopTenContext';

const POSTER_RADIUS = Radius.lg;
const IS_WEB = Platform.OS === 'web';

function posterAccessibilityLabel(movie: Movie, rank: number | null): string {
  return [
    movie.title,
    movie.year ? String(movie.year) : null,
    movie.rating > 0 ? `rated ${movie.rating.toFixed(1)} out of 10` : null,
    rank ? `number ${rank} in the top 10` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function MoviePosterItem({
  movie,
  width,
  source = 'unknown',
  hideRankFlag = false,
  isNew = false,
}: {
  movie: Movie;
  width?: number;
  source?: string;
  hideRankFlag?: boolean;
  isNew?: boolean;
}) {
  const { posterUrls } = movie;
  const {colors} = usePalette();
  const nodeRef = useRef<View>(null);
  const hoverCard = useHoverCard();
  const rank = useTopTenRank(movie.id);

    const rung = posterRung(posterUrls, width);
    const placeholderUrl = rung > 0 ? posterUrls[0] : undefined;
    const sourceUrl = posterUrls[rung];

  const hasRating = movie.rating > 0;

  return (
    <View ref={nodeRef} style={getPosterContainerStyle(width)} collapsable={false}>
    <Link href={`/movie/${movie.id}`} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={posterAccessibilityLabel(movie, rank)}
        onPress={() => Analytics.movieOpen(movie, source)}
        hoveredScale={IS_WEB ? 1.015 : 1}
        lift={IS_WEB ? 2 : 0}
        duration={Duration.fast}
        onHoverIn={() => {
          if (!IS_WEB) return;
          if (hoverCard.enabled) hoverCard.open(movie, nodeRef.current, source);
        }}
        onHoverOut={() => {
          if (!IS_WEB) return;
          if (hoverCard.enabled) hoverCard.close();
        }}
        style={styles.pressable}
        contentStyle={styles.pressable}
      >
        <Animated.View
            entering={enterFade()}
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
              },
            ]}
        >
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <ThemedText
                numberOfLines={4}
                style={[styles.fallbackTitle, {color: colors.textMuted}]}
            >
              {movie.title}
            </ThemedText>
          </View>

          <Image
              style={StyleSheet.absoluteFill}
              source={sourceUrl ? {uri: sourceUrl} : undefined}
              placeholder={placeholderUrl ? {uri: placeholderUrl} : undefined}
              placeholderContentFit="cover"
              contentFit="cover"
              transition={180}
              priority="high"
              cachePolicy="memory-disk"
              recyclingKey={String(movie.id)}
          />

          {hasRating ? (
              <Animated.View entering={enterPop(1)} style={styles.ratingBadge}>
                <Ionicons name="star" size={9} color={colors.gold}/>
                <ThemedText style={styles.ratingText} lightColor="#fff" darkColor="#fff">
                  {movie.rating.toFixed(1)}
                </ThemedText>
              </Animated.View>
          ) : null}

          {rank && !hideRankFlag ? (
              <Animated.View entering={enterPop(2)} style={[styles.rankFlag, {backgroundColor: colors.accentStrong}]}>
                <ThemedText style={[styles.rankFlagText, {color: colors.onAccent}]}>Top{'\n'}10</ThemedText>
              </Animated.View>
          ) : isNew ? (
              <NewBadge style={styles.newBadge}/>
          ) : null}
        </Animated.View>
      </PressableScale>
    </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {flex: 1},
  card: {
    flex: 1,
    borderRadius: POSTER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fallback: {alignItems: 'center', justifyContent: 'center', padding: Spacing.sm},
  fallbackTitle: {fontSize: 12, lineHeight: 16, textAlign: 'center', fontFamily: FontFamily.semibold},
  ratingBadge: {
    position: 'absolute',
    zIndex: 10,
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(20,17,14,0.78)',
  },
  ratingText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.semibold,
  },
  newBadge: {position: 'absolute', zIndex: 10, top: Spacing.sm, right: Spacing.sm},
  rankFlag: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    right: Spacing.sm,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  rankFlagText: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
    fontFamily: FontFamily.extrabold,
  },
});
