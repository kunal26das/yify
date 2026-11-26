import {PLAY_STORE_URL} from '@/core/config/app';
import {Image} from 'expo-image';
import type {PressableProps} from 'react-native';
import {Pressable, StyleSheet} from 'react-native';
import {useTheme} from '../theme/useTheme';

export interface GetItOnGooglePlayProps {
  onPress?: () => void;
}

export const GOOGLE_PLAY_LABEL = 'Get it on Google Play';

const BADGE = require('@assets/images/google-play-badge.png');
const CANVAS = {width: 646, height: 250};
const ARTWORK_HEIGHT = 168;
const TARGET_HEIGHT = 40;
const IMAGE_HEIGHT = Math.round(TARGET_HEIGHT * (CANVAS.height / ARTWORK_HEIGHT));
const IMAGE_WIDTH = Math.round(IMAGE_HEIGHT * (CANVAS.width / CANVAS.height));
const BLEED = Math.round(IMAGE_HEIGHT * (41 / CANVAS.height));

export function GetItOnGooglePlay({onPress}: GetItOnGooglePlayProps) {
  const theme = useTheme();
  const link = {href: PLAY_STORE_URL, hrefAttrs: {target: '_blank', rel: 'noopener noreferrer'}} as unknown as Partial<PressableProps>;
  return (
    <Pressable
      {...link}
      role="link"
      aria-label={GOOGLE_PLAY_LABEL}
      onPress={onPress}
      dataSet={{focusable: ''}}
      style={[styles.hit, {borderRadius: theme.shape.small}]}
    >
      <Image source={BADGE} accessible={false} alt="" contentFit="contain" style={styles.image}/>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {alignSelf: 'flex-start', overflow: 'hidden'},
  image: {height: IMAGE_HEIGHT, width: IMAGE_WIDTH, margin: -BLEED},
});
