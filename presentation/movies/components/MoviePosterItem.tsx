import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import type {Movie} from '@/domain';
import {useDeviceCornerRadius} from '../../hooks/use-device-corner-radius';
import {getPosterContainerStyle} from './moviePosterLayout';

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
    <Pressable
      onPress={() => router.push(`/movie/${movie.id}`)}
      style={[styles.container, getPosterContainerStyle()]}
    >
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
});
