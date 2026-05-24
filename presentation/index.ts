// screens & view models
export { MoviesScreen } from './movies/MoviesScreen';
export { useMoviesViewModel, DEFAULT_FILTERS } from './movies/useMoviesViewModel';
export type { MoviesViewModel, MovieFilters } from './movies/useMoviesViewModel';

// shared UI primitives
export { LiquidGlassView, LiquidGlassGroup, isNativeLiquidGlass } from './components/liquid-glass-view';
export { ThemedText } from './components/themed-text';
export type { ThemedTextProps } from './components/themed-text';
export { ThemedView } from './components/themed-view';
export type { ThemedViewProps } from './components/themed-view';

// shared hooks
export { useColorScheme } from './hooks/use-color-scheme';
export { useThemeColor } from './hooks/use-theme-color';
export { useDeviceCornerRadius } from './hooks/use-device-corner-radius';

// shared constants
export { Colors, Fonts } from './constants/theme';
