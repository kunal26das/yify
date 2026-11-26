import type {StyleProp, ViewStyle} from 'react-native';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTheme} from '../theme/useTheme';

export interface ScrimProps {
  tone?: 'scrim' | 'mediaScrim';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Scrim({tone = 'scrim', onPress, style}: ScrimProps) {
  const theme = useTheme();
  const fill = [StyleSheet.absoluteFill, {backgroundColor: theme.colors[tone]}, style];
  if (onPress) return <Pressable aria-hidden onPress={onPress} focusable={false} style={fill}/>;
  return <View aria-hidden style={[fill, styles.passThrough]}/>;
}

const styles = StyleSheet.create({passThrough: {pointerEvents: 'none'}});
