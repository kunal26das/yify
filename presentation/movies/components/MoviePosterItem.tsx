import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {Link} from 'expo-router';
import {useRef} from 'react';
import {Animated, Platform, Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {FontFamily, Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {ThemedText} from '../../components/themed-text';
import {getPosterContainerStyle} from './moviePosterLayout';
import {Analytics} from '@/lib/analytics-events';
import {useHoverCard} from './HoverCard';
import {NewBadge} from './NewBadge';
import {useTopTenRank} from './TopTenContext';

const POSTER_RADIUS = Radius.lg;
const IS_WEB = Platform.OS === 'web';

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
  /** Set inside the Top 10 rail, where the oversized numeral already states the rank. */
  hideRankFlag?: boolean;
  /** Shows the NEW flag — set by rails that are sorted by date added. */
  isNew?: boolean;
}) {
  const { posterUrls } = movie;
  const {colors, scheme} = usePalette();
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const nodeRef = useRef<View>(null);
  const hoverCard = useHoverCard();
  const rank = useTopTenRank(movie.id);

  const placeholderUrl = posterUrls.length > 1 ? posterUrls[0] : undefined;
  const sourceUrl = posterUrls[Math.min(1, posterUrls.length - 1)] ?? posterUrls[0];

  const animate = (toScale: number, toLift: number) => {
    Animated.parallel([
      Animated.spring(scale, {toValue: toScale, useNativeDriver: true, speed: 50, bounciness: 0}),
      Animated.spring(lift, {toValue: toLift, useNativeDriver: true, speed: 50, bounciness: 0}),
    ]).start();
  };

  const translateY = lift.interpolate({inputRange: [0, 1], outputRange: [0, -4]});
  const hasRating = movie.rating > 0;

  return (
    // The ref lives on this wrapper rather than on the Pressable: `Link asChild` clones its child
    // and supplies its own ref, so a ref handed to the Pressable never arrives. The hover card
    // measures this node instead, which nothing else claims.
    <View ref={nodeRef} style={getPosterContainerStyle(width)} collapsable={false}>
    <Link href={`/movie/${movie.id}`} asChild>
      <Pressable
        onPress={() => Analytics.movieOpen(movie, source)}
        onPressIn={() => animate(0.96, 0)}
        onPressOut={() => animate(1, 0)}
        onHoverIn={() => {
          if (!IS_WEB) return;
          animate(1.02, 1);
          // On a pointer device the poster grows into a full card; the lift above is just the
          // acknowledgement while the open delay runs.
          if (hoverCard.enabled) hoverCard.open(movie, nodeRef.current, source);
        }}
        onHoverOut={() => {
          if (!IS_WEB) return;
          animate(1, 0);
          if (hoverCard.enabled) hoverCard.close();
        }}
        style={styles.pressable}
      >
        <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                transform: [{scale}, {translateY}],
                shadowColor: scheme === 'dark' ? '#000' : '#2A2019',
              },
            ]}
        >
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
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={11} color={colors.gold}/>
                <ThemedText style={styles.ratingText} lightColor="#fff" darkColor="#fff">
                  {movie.rating.toFixed(1)}
                </ThemedText>
              </View>
          ) : null}

          {/* A charting title is flagged wherever it turns up, not only inside the Top 10 rail.
              The rank takes the corner when a title is both new and charting. */}
          {rank && !hideRankFlag ? (
              <View style={styles.rankFlag}>
                <ThemedText style={styles.rankFlagText}>TOP{'\n'}10</ThemedText>
              </View>
          ) : isNew ? (
              <NewBadge style={styles.newBadge}/>
          ) : null}
        </Animated.View>
      </Pressable>
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
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  ratingBadge: {
    position: 'absolute',
    zIndex: 10,
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8,8,12,0.66)',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
  },
  newBadge: {position: 'absolute', zIndex: 10, top: Spacing.sm, right: Spacing.sm},
  rankFlag: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    right: Spacing.sm,
    backgroundColor: '#E11D2E',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  rankFlagText: {
    color: '#fff',
    fontSize: 8,
    lineHeight: 9,
    letterSpacing: 0.6,
    textAlign: 'center',
    fontFamily: FontFamily.extrabold,
  },
});
