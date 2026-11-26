import {createContext, useContext} from 'react';
import {themeColors} from './themeColors';
import type {AccentName, ColorRoles, ColorScheme, Tokens} from './tokens';
import {tokens} from './tokens';

export interface Theme {
  scheme: ColorScheme;
  accent: AccentName;
  colors: ColorRoles;
  type: Tokens['type'];
  space: Tokens['space'];
  shape: Tokens['shape'];
  layout: Tokens['layout'];
  motion: Tokens['motion'];
}

export function createTheme(scheme: ColorScheme, accent: AccentName): Theme {
  return {
    scheme,
    accent,
    colors: themeColors(scheme, accent),
    type: tokens.type,
    space: tokens.space,
    shape: tokens.shape,
    layout: tokens.layout,
    motion: tokens.motion,
  };
}

const DEFAULT_THEME = createTheme('dark', 'default');

export const ThemeContext = createContext<Theme>(DEFAULT_THEME);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
