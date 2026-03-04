import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Movie } from '@/domain/entities/Movie';
import { useDeviceCornerRadius } from '@/hooks/use-device-corner-radius';
import { getPosterContainerStyle } from '@/presentation/movies/components/moviePosterLayout';

export function MoviePosterItem({ movie }: { movie: Movie }) {
  const { posterUrls } = movie;
  const cornerRadius = useDeviceCornerRadius();
  const [visibleUpToIndex, setVisibleUpToIndex] = useState(0);

  useEffect(() => {
    if (posterUrls.length <= 1) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < posterUrls.length; i++) {
      timeouts.push(
        setTimeout(() => setVisibleUpToIndex(i), __DEV__ ? 2000 : 0)
      );
    }
    return () => timeouts.forEach((t) => clearTimeout(t));
  }, [posterUrls.length]);

  const posterStyle = [styles.poster, { borderRadius: cornerRadius }];

  return (
    <View style={[styles.container, getPosterContainerStyle()]}>
      {posterUrls.map((uri, index) => {
        if (index > visibleUpToIndex) return null;
        return (
          <View
            key={`${movie.id}-${index}`}
            style={[
              styles.layer,
              {
                zIndex: index,
                borderRadius: cornerRadius,
                overflow: 'hidden',
              },
            ]}
          >
            <Image
              source={{ uri }}
              contentFit="cover"
              style={posterStyle}
              cachePolicy="memory-disk"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
});
