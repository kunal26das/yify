import {Link} from 'expo-router';
import type {BottomTabBarProps} from 'expo-router/js-tabs';
import {StyleSheet, View} from 'react-native';
import {DESTINATIONS} from '@/core/ui/navigation/destinations';

export function AppTabBar({state}: BottomTabBarProps) {
  const focused = state.routes[state.index]?.name;
  return (
    <View role="navigation" testID="app-tab-bar" style={styles.bar}>
      {DESTINATIONS.map((destination) => (
        <Link
          key={destination.route}
          href={destination.href}
          testID={`tab-${destination.label.toLowerCase()}`}
          aria-selected={focused === destination.route}
          style={styles.tab}
        >
          {destination.label}
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', gap: 16, padding: 12},
  tab: {padding: 4},
});
