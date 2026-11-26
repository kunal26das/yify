import {NavigationBar} from 'expo-navigation-bar';
import {setStatusBarStyle} from 'expo-status-bar';
import {setBackgroundColorAsync} from 'expo-system-ui';
import {useEffect} from 'react';
import type {ColorScheme} from './theme/tokens';
import {tokens} from './theme/tokens';

export function applySystemBars(scheme: ColorScheme): void {
  NavigationBar.setStyle(scheme === 'dark' ? 'dark' : 'light');
  setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
  setBackgroundColorAsync(tokens.colors[scheme].surface).catch(() => undefined);
}

export function useSystemBars(scheme: ColorScheme): void {
  useEffect(() => {
    applySystemBars(scheme);
  }, [scheme]);
}
