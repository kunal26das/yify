import {Image} from 'expo-image';
import {useState} from 'react';
import type {DimensionValue} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';
import {reportImageError, reportImageLoad, useImageHostMode} from '../imageHost';
import type {ImageSize} from '../images';
import {imageUrl} from '../images';
import type {Tokens} from '../theme/tokens';
import {useTheme} from '../theme/useTheme';
import {Text} from './Text';

export type ArtworkKind = 'poster' | 'backdrop' | 'profile' | 'logo' | 'still';

export interface ArtworkProps {
  kind: ArtworkKind;
  path: string | null;
  size: ImageSize;
  width: number | string;
  alt: string;
  decorative?: boolean;
  fallbackLabel?: string;
  rounded?: keyof Tokens['shape'];
  fit?: 'cover' | 'contain';
  priority?: 'low' | 'normal' | 'high';
}

export const ARTWORK_ASPECT: Readonly<Record<ArtworkKind, number>> = {
  poster: 2 / 3,
  profile: 2 / 3,
  backdrop: 16 / 9,
  still: 16 / 9,
  logo: 1,
};

const HAIRLINE_OPACITY = 0.5;

export function Artwork({kind, path, size, width, alt, decorative = false, fallbackLabel, rounded = 'medium', fit = 'cover', priority = 'normal'}: ArtworkProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const mode = useImageHostMode();
  const uri = imageUrl(path, size, mode);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri !== null && failedUri !== uri;
  const radius = theme.shape[rounded];
  const label = decorative ? undefined : alt;

  return (
    <View
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative || undefined}
      style={[styles.frame, {width: width as DimensionValue, aspectRatio: ARTWORK_ASPECT[kind], borderRadius: radius, backgroundColor: theme.colors.surfaceContainerHigh}]}
    >
      {showImage ? (
        <Image
          source={{uri}}
          recyclingKey={path}
          contentFit={fit}
          transition={reduceMotion ? 0 : theme.motion.duration.short4}
          priority={priority}
          accessible={false}
          alt=""
          style={StyleSheet.absoluteFill}
          onLoad={reportImageLoad}
          onError={() => {
            reportImageError();
            setFailedUri(uri);
          }}
        />
      ) : fallbackLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.fallback, {padding: theme.space.sm}]}>
          <Text variant="titleSmall" color="onSurfaceVariant" align="center" numberOfLines={3}>{fallbackLabel}</Text>
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.hairline, {borderRadius: radius, borderColor: theme.colors.outlineVariant}]}/>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {overflow: 'hidden', position: 'relative'},
  fallback: {alignItems: 'center', justifyContent: 'center'},
  hairline: {borderWidth: 1, opacity: HAIRLINE_OPACITY, pointerEvents: 'none'},
});
