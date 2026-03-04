import { LiquidGlassView } from '@/components/liquid-glass-view';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { Movie } from '@/domain/entities/Movie';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDeviceCornerRadius } from '@/hooks/use-device-corner-radius';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getPosterContainerStyle } from '@/presentation/movies/components/moviePosterLayout';

export function MoviePosterItem({ movie }: { movie: Movie }) {
  const cornerRadius = useDeviceCornerRadius();
  const colorScheme = useColorScheme();
  const iconColor = useThemeColor({}, 'icon');
  const { posterUrls, posterUrl } = movie;

  const urls = useMemo(() => {
    if (posterUrls.length > 0) return posterUrls;
    if (posterUrl?.trim()) return [posterUrl.trim()];
    return [];
  }, [posterUrls, posterUrl]);

  const posterStyle = [styles.poster, { borderRadius: cornerRadius }];

  if (urls.length === 0) {
    const glassTint = colorScheme === 'dark' ? 'dark' : 'light';
    return (
      <View
        style={[
          styles.container,
          getPosterContainerStyle(),
        ]}>
        <LiquidGlassView
          tint={glassTint}
          intensity={50}
          fallbackBackgroundColor={iconColor + '28'}
          style={[styles.glassPlaceholder, { borderRadius: cornerRadius }]}
        >
          <View style={styles.placeholder}>
            <IconSymbol name="film.fill" size={32} color={iconColor} />
          </View>
        </LiquidGlassView>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        getPosterContainerStyle(),
      ]}>
      {urls.map((uri, index) => {
        const isFirst = index === 0;
        return (
          <Image
            key={`${movie.id}-${index}`}
            source={{ uri }}
            cachePolicy="memory-disk"
            style={isFirst ? posterStyle : [styles.posterOverlay, posterStyle]}
            contentFit="cover"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  poster: {
    width: '100%',
    height: '100%',
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  glassPlaceholder: {
    flex: 1,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
