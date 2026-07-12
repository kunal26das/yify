import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {Link} from 'expo-router';
import {useRef} from 'react';
import {Animated, Platform, Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {ThemedText} from '../../components/themed-text';
import {getPosterContainerStyle} from './moviePosterLayout';

const POSTER_RADIUS = Radius.lg;

export function MoviePosterItem({movie, width}: { movie: Movie; width?: number }) {
  const { posterUrls } = movie;
  const {colors, scheme} = usePalette();
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

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
    <Link href={`/movie/${movie.id}`} asChild>
      <Pressable
        onPressIn={() => animate(0.96, 0)}
        onPressOut={() => animate(1, 0)}
        onHoverIn={() => Platform.OS === 'web' && animate(1.02, 1)}
        onHoverOut={() => Platform.OS === 'web' && animate(1, 0)}
        style={getPosterContainerStyle(width)}
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
        </Animated.View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
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
});
