import {BottomTabBarHeightCallbackContext} from 'expo-router/js-tabs';
import {use} from 'react';
import type {LayoutChangeEvent} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {useTheme} from '../theme/useTheme';
import {NavigationItem} from './NavigationItem';
import type {NavigationChromeProps} from './tabItems';
import {tabItems} from './tabItems';

export const MAIN_NAVIGATION_LABEL = 'Main';

export function NavigationBar(props: NavigationChromeProps) {
  const theme = useTheme();
  const onHeightChange = use(BottomTabBarHeightCallbackContext);
  const items = tabItems(props, props.youBadge);
  const onLayout = (event: LayoutChangeEvent) => onHeightChange?.(event.nativeEvent.layout.height);
  return (
    <View
      role={IS_WEB ? 'navigation' : 'tablist'}
      aria-label={MAIN_NAVIGATION_LABEL}
      dataSet={{nav: 'bar'}}
      onLayout={IS_WEB ? undefined : onLayout}
      style={[styles.bar, {backgroundColor: theme.colors.surfaceContainer, paddingBottom: props.insets.bottom, minHeight: theme.layout.navigationBarHeight + props.insets.bottom}]}
    >
      {items.map((item) => <NavigationItem key={item.key} item={item} layout="bar"/>)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'stretch'},
});
