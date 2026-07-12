import {View, type ViewProps} from 'react-native';

import {useThemeColor} from '../hooks/use-theme-color';
import {useIsFrostedDesktop} from '../hooks/use-is-desktop';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const themedBackground = useThemeColor({light: lightColor, dark: darkColor}, 'background');
  const isFrosted = useIsFrostedDesktop();
  const backgroundColor = isFrosted ? 'transparent' : themedBackground;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
