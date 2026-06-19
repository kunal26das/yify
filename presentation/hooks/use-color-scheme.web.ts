import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

/**
 * To support static rendering, the color scheme must resolve to a stable value
 * on the server and the real device value on the client. `useSyncExternalStore`
 * returns the server snapshot ('light') during static render, then the actual
 * scheme once hydrated, and re-renders on system appearance changes.
 */
function subscribe(callback: () => void) {
  const subscription = Appearance.addChangeListener(callback);
  return () => subscription.remove();
}

export function useColorScheme() {
  return useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme() ?? 'light',
    () => 'light'
  );
}
