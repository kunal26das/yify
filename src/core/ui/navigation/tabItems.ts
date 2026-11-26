import type {BottomTabBarProps} from 'expo-router/js-tabs';
import type {Destination} from './destinations';
import {destinationForRoute} from './destinations';

export type YouBadge = 'none' | 'billing';

export interface NavigationChromeProps extends BottomTabBarProps {
  youBadge: YouBadge;
}

export interface TabItem {
  key: string;
  destination: Destination;
  focused: boolean;
  index: number;
  count: number;
  billing: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

export const BILLING_SUFFIX = 'payment issue';

export function tabItems({state, emitter, navigateToTab}: BottomTabBarProps, youBadge: YouBadge): TabItem[] {
  const items: TabItem[] = [];
  state.routes.forEach((route, index) => {
    const destination = destinationForRoute(route.name);
    if (destination === null) return;
    const focused = index === state.index;
    items.push({
      key: route.key,
      destination,
      focused,
      index,
      count: state.routes.length,
      billing: youBadge === 'billing' && destination.route === '(you)',
      onPress: () => {
        const event = emitter.emit({type: 'tabPress', target: route.key, canPreventDefault: true});
        if (!focused && !event.defaultPrevented) navigateToTab(route.key);
      },
      onLongPress: () => {
        emitter.emit({type: 'tabLongPress', target: route.key});
      },
    });
  });
  return items;
}

export function tabLabel(item: TabItem, platform: 'native' | 'web'): string {
  const base = platform === 'native' ? `${item.destination.label}, tab, ${item.index + 1} of ${item.count}` : item.destination.label;
  return item.billing ? `${base}, ${BILLING_SUFFIX}` : base;
}
