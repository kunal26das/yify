import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import {useSettings} from './use-settings';

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
  const {theme} = useSettings();
  return theme === 'system' ? system : theme;
}
