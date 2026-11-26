import {Image} from 'expo-image';
import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';

export type AvatarSize = 24 | 32 | 40 | 56 | 72;

export interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size: AvatarSize;
  decorative?: boolean;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return (first + last).toLocaleUpperCase();
}

export function Avatar({name, photoUrl, size, decorative = false}: AvatarProps) {
  const theme = useTheme();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = typeof photoUrl === 'string' && photoUrl.length > 0 && failedUrl !== photoUrl;
  return (
    <View
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
      style={[styles.circle, {width: size, height: size, borderRadius: theme.shape.full, backgroundColor: theme.colors.secondaryContainer}]}
    >
      {showPhoto ? (
        <Image
          source={{uri: photoUrl}}
          accessible={false}
          alt=""
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          onError={() => setFailedUrl(photoUrl)}
        />
      ) : (
        <Text variant={size >= 56 ? 'titleLarge' : size >= 40 ? 'titleMedium' : 'labelMedium'} color="onSecondaryContainer" aria-hidden maxFontSizeMultiplier={1}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
});
