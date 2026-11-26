import {StyleSheet, View} from 'react-native';
import {currentPageProps} from '../a11y';
import {Badge} from '../components/Badge';
import {Icon} from '../components/Icon';
import {Text} from '../components/Text';
import {Touchable} from '../components/Touchable';
import {IS_WEB} from '../environment';
import {useTheme} from '../theme/useTheme';
import type {TabItem} from './tabItems';
import {tabLabel} from './tabItems';

const INDICATOR = {width: 56, height: 32};
export const NAV_LABEL_SCALE = 1.5;
const RAIL_ITEM_HEIGHT = 56;

export function NavigationItem({item, layout}: {item: TabItem; layout: 'bar' | 'rail'}) {
  const theme = useTheme();
  const {destination, focused} = item;
  return (
    <Touchable
      {...currentPageProps(focused)}
      href={destination.href}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      aria-label={tabLabel(item, IS_WEB ? 'web' : 'native')}
      style={[
        styles.item,
        layout === 'bar' ? styles.barItem : null,
        {minHeight: layout === 'bar' ? theme.layout.navigationBarHeight : RAIL_ITEM_HEIGHT, gap: theme.space.xs},
      ]}
    >
      <View style={[styles.indicator, {width: INDICATOR.width, height: INDICATOR.height, borderRadius: theme.shape.full, backgroundColor: focused ? theme.colors.secondaryContainer : undefined}]}>
        <Icon name={destination.icon} filled={focused} size={24} color={focused ? 'onSecondaryContainer' : 'onSurfaceVariant'}/>
        {item.billing ? <View style={styles.badge}><Badge size="dot" tone="error"/></View> : null}
      </View>
      <Text
        variant={focused ? 'labelMedium' : 'labelMediumRegular'}
        color={focused ? 'onSurface' : 'onSurfaceVariant'}
        align="center"
        numberOfLines={1}
        maxFontSizeMultiplier={NAV_LABEL_SCALE}
      >
        {destination.label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  item: {alignItems: 'center', justifyContent: 'center'},
  barItem: {flex: 1},
  indicator: {alignItems: 'center', justifyContent: 'center'},
  badge: {position: 'absolute', top: 4, right: 14},
});
