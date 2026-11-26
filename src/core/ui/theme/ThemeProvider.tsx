import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {useSystemBars} from '../systemBars';
import type {AccentName, ThemePreference} from './tokens';
import {resolveScheme} from './tokens';
import {createTheme, ThemeContext} from './useTheme';

export interface ThemeProviderProps {
  preference: ThemePreference;
  accent: AccentName;
  children: ReactNode;
}

export function ThemeProvider({preference, accent, children}: ThemeProviderProps) {
  const system = useColorScheme();
  const scheme = resolveScheme(preference, system === 'light' || system === 'dark' ? system : null);
  const theme = useMemo(() => createTheme(scheme, accent), [scheme, accent]);
  useSystemBars(scheme);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
