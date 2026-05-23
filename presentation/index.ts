// screens & view models
export { MoviesScreen } from './movies/MoviesScreen';
export { useMoviesViewModel, DEFAULT_FILTERS } from './movies/useMoviesViewModel';
export type { MoviesViewModel, MovieFilters } from './movies/useMoviesViewModel';
export { MovieDetailsScreen } from './movies/MovieDetailsScreen';
export { useMovieDetailsViewModel } from './movies/useMovieDetailsViewModel';
export type { MovieDetailsViewModel } from './movies/useMovieDetailsViewModel';

// shared UI primitives
export { LiquidGlassView, LiquidGlassGroup, isNativeLiquidGlass } from './components/liquid-glass-view';
export {LinearGradient} from './components/linear-gradient';
export { ThemedText } from './components/themed-text';
export type { ThemedTextProps } from './components/themed-text';
export { ThemedView } from './components/themed-view';
export type { ThemedViewProps } from './components/themed-view';

// shared hooks
export { useColorScheme } from './hooks/use-color-scheme';
export {useIsDesktop, useIsMacDesktop, useIsFrostedDesktop, useDesktopPlatform} from './hooks/use-is-desktop';
export { useThemeColor } from './hooks/use-theme-color';
export { useDeviceCornerRadius } from './hooks/use-device-corner-radius';
export {usePalette} from './hooks/use-palette';
export type {ThemePalette} from './hooks/use-palette';
export {useResponsive} from './hooks/use-responsive';
export type {Responsive, Breakpoint} from './hooks/use-responsive';

// shared constants
export {Colors, Fonts, FontFamily, Gradients, Spacing, Radius, Typography} from './constants/theme';
export type {Palette} from './constants/theme';
