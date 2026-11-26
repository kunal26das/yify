import type {ReactNode} from 'react';
import {useEffect, useMemo, useSyncExternalStore} from 'react';
import {useSystemBars} from '../systemBars';
import type {AccentName, ColorScheme, ThemePreference} from './tokens';
import {resolveScheme} from './tokens';
import {createTheme, ThemeContext} from './useTheme';

export interface ThemeProviderProps {
  preference: ThemePreference;
  accent: AccentName;
  children: ReactNode;
}

const LIGHT_QUERY = '(prefers-color-scheme: light)';

function subscribeSystemScheme(listener: () => void): () => void {
  const query = window.matchMedia(LIGHT_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function systemScheme(): ColorScheme {
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark';
}

function serverScheme(): ColorScheme | null {
  return null;
}

export function ThemeProvider({preference, accent, children}: ThemeProviderProps) {
  const system = useSyncExternalStore(subscribeSystemScheme, systemScheme, serverScheme);
  const scheme = resolveScheme(preference, system);
  const theme = useMemo(() => createTheme(scheme, accent), [scheme, accent]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preference;
    root.dataset.accent = accent;
  }, [preference, accent]);
  useSystemBars(scheme);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
