import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {useTheme} from '../theme/useTheme';
import {MAIN_NAVIGATION_LABEL} from './NavigationBar';
import {NavigationItem} from './NavigationItem';
import type {NavigationChromeProps} from './tabItems';
import {tabItems} from './tabItems';

export function NavigationRail(props: NavigationChromeProps) {
  const theme = useTheme();
  const items = tabItems(props, props.youBadge);
  return (
    <View
      role={IS_WEB ? 'navigation' : 'tablist'}
      aria-label={MAIN_NAVIGATION_LABEL}
      dataSet={{nav: 'rail'}}
      style={[
        styles.rail,
        {
          width: theme.layout.navigationRailWidth + props.insets.left,
          paddingLeft: props.insets.left,
          paddingTop: theme.space.xl + props.insets.top,
          gap: theme.space.md,
          backgroundColor: theme.colors.surfaceContainer,
        },
      ]}
    >
      {items.map((item) => <NavigationItem key={item.key} item={item} layout="rail"/>)}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {alignItems: 'stretch', alignSelf: 'stretch'},
});
