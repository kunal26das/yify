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
  // On frosted desktops (macOS vibrancy / Windows acrylic) the window provides a
  // translucent background, so app containers stay transparent to let it through.
  const backgroundColor = isFrosted ? 'transparent' : themedBackground;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
