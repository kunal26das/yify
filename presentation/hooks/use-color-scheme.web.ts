import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import {usePreferences} from './use-preferences';

function subscribe(callback: () => void) {
  const subscription = Appearance.addChangeListener(callback);
  return () => subscription.remove();
}

export function useColorScheme() {
  const system = useSyncExternalStore(
    subscribe,
    () => Appearance.getColorScheme() ?? 'light',
    () => 'light'
  );
  const {theme} = usePreferences();
  return theme === 'system' ? system : theme;
}
