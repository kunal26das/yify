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
import {getPosterContainerStyle, POSTER_ASPECT_RATIO, POSTER_CAPTION_HEIGHT, posterRung} from './moviePosterLayout';
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
  showCaption = false,
}: {
  movie: Movie;
  width?: number;
  source?: string;
  hideRankFlag?: boolean;
  isNew?: boolean;
  showCaption?: boolean;
}) {
  const { posterUrls } = movie;
  const {colors, scheme} = usePalette();
  const nodeRef = useRef<View>(null);
  const hoverCard = useHoverCard();
  const rank = useTopTenRank(movie.id);

    const rung = posterRung(posterUrls, width);
    const placeholderUrl = rung > 0 ? posterUrls[0] : undefined;
    const sourceUrl = posterUrls[rung];

  const hasRating = movie.rating > 0;
  const containerStyle = getPosterContainerStyle(width,
      showCaption && width != null ? width / POSTER_ASPECT_RATIO + POSTER_CAPTION_HEIGHT : undefined);

  return (
    <View ref={nodeRef} style={showCaption && width == null ? {...containerStyle, aspectRatio: undefined} : containerStyle} collapsable={false}>
    <Link href={`/movie/${movie.id}`} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={posterAccessibilityLabel(movie, rank)}
        onPress={() => Analytics.movieOpen(movie, source)}
        hoveredScale={IS_WEB ? 1.03 : 1}
        lift={IS_WEB ? 5 : 0}
        duration={Duration.fast}
        onHoverIn={() => {
          if (!IS_WEB) return;
          if (hoverCard.enabled) hoverCard.open(movie, nodeRef.current, source);
        }}
        onHoverOut={() => {
          if (!IS_WEB) return;
          if (hoverCard.enabled) hoverCard.close();
        }}
        style={showCaption ? undefined : styles.pressable}
        contentStyle={showCaption ? undefined : styles.pressable}
      >
        <Animated.View
            entering={enterFade()}
            style={[
              styles.card,
              showCaption ? [styles.captionPoster, width != null && {width, height: width / POSTER_ASPECT_RATIO}] : styles.pressable,
              {
                backgroundColor: colors.surfaceSunken,
                borderColor: colors.border,
                shadowColor: scheme === 'dark' ? '#000' : '#2A2019',
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
              <Animated.View entering={enterPop(2)} style={styles.rankFlag}>
                <ThemedText style={styles.rankFlagText}>TOP{'\n'}10</ThemedText>
              </Animated.View>
          ) : isNew ? (
              <NewBadge style={styles.newBadge}/>
          ) : null}
        </Animated.View>
        {showCaption ? (
            <View style={styles.caption} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
              <ThemedText type="defaultSemiBold" numberOfLines={2} ellipsizeMode="tail"
                          style={[styles.captionTitle, {color: colors.text}]}>
                {movie.title}
              </ThemedText>
              <ThemedText numberOfLines={1} style={[styles.captionYear, {color: colors.textMuted}]}>
                {movie.year > 0 ? movie.year : ''}
              </ThemedText>
            </View>
        ) : null}
      </PressableScale>
    </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {flex: 1},
  captionPoster: {flexShrink: 0, width: '100%', aspectRatio: POSTER_ASPECT_RATIO},
  caption: {height: POSTER_CAPTION_HEIGHT, paddingTop: Spacing.sm, gap: 2},
  captionTitle: {fontSize: 13, lineHeight: 18, height: 36},
  captionYear: {fontSize: 12, lineHeight: 16, height: 16},
  card: {
    borderRadius: POSTER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  fallback: {alignItems: 'center', justifyContent: 'center', padding: Spacing.sm},
  fallbackTitle: {fontSize: 12, lineHeight: 16, textAlign: 'center', fontFamily: FontFamily.semibold},
  ratingBadge: {
    position: 'absolute',
    zIndex: 10,
    top: Spacing.xs,
    left: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(8,8,12,0.6)',
  },
  ratingText: {
    fontSize: 10,
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
