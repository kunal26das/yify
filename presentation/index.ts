export { MoviesScreen } from './movies/MoviesScreen';
export { useMoviesViewModel, DEFAULT_FILTERS } from './movies/useMoviesViewModel';
export type { MoviesViewModel, MovieFilters, UseMoviesOptions } from './movies/useMoviesViewModel';
export { HomeScreen } from './movies/HomeScreen';
export { useHomeViewModel } from './movies/useHomeViewModel';
export type { HomeViewModel, ShelfState, ShelfStatus } from './movies/useHomeViewModel';
export { MyListScreen } from './movies/MyListScreen';
export { SettingsScreen } from './movies/SettingsScreen';
export { useSettingsViewModel } from './movies/useSettingsViewModel';
export type { SettingsViewModel } from './movies/useSettingsViewModel';
export { DESTINATIONS, destinationHref } from './movies/constants/destinations';
export type { Destination, DestinationKey } from './movies/constants/destinations';
export { HomeFooter } from './movies/components/HomeFooter';
export { PlayStoreButton, PLAY_STORE_URL } from './movies/components/PlayStoreButton';
export { useSettings } from './hooks/use-settings';
export { TopNav, useTopNavHeight } from './movies/components/TopNav';
export type { NavKey } from './movies/components/TopNav';
export { HoverCardHost, useHoverCard } from './movies/components/HoverCard';
export { TopTenProvider, useTopTenRank } from './movies/components/TopTenContext';
export { MovieDetailsScreen } from './movies/MovieDetailsScreen';
export { useMovieDetailsViewModel } from './movies/useMovieDetailsViewModel';
export type { MovieDetailsViewModel } from './movies/useMovieDetailsViewModel';
export { useWatchlist, useIsInWatchlist } from './movies/useWatchlist';
export { Quality, Genre, SortBy, OrderBy } from './movies/constants/movieFilterOptions';

export { LiquidGlassView, LiquidGlassGroup, isNativeLiquidGlass } from './components/liquid-glass-view';
export {LinearGradient} from './components/linear-gradient';
export { UpdateSnackbar } from './components/update-snackbar';
export { ThemedText } from './components/themed-text';
export type { ThemedTextProps } from './components/themed-text';
export { ThemedView } from './components/themed-view';
export {
    Duration,
    PressableScale,
    Shimmer,
    breatheKeyframes,
    enterFade,
    enterPop,
    enterRise,
    enterSlide,
    exitFade,
    exitPop,
    pulseKeyframes,
    shiftLayout,
    staggerDelay,
} from './components/motion';
export type { MotionStyle } from './components/motion';
export type { ThemedViewProps } from './components/themed-view';

export { useColorScheme } from './hooks/use-color-scheme';
export {useIsDesktop, useIsMacDesktop, useIsFrostedDesktop, useDesktopPlatform} from './hooks/use-is-desktop';
export { useThemeColor } from './hooks/use-theme-color';
export { useDeviceCornerRadius } from './hooks/use-device-corner-radius';
export {usePalette} from './hooks/use-palette';
export type {ThemePalette} from './hooks/use-palette';
export {useResponsive} from './hooks/use-responsive';
export type {Responsive, Breakpoint} from './hooks/use-responsive';

export {Colors, Fonts, FontFamily, Gradients, Spacing, Radius, Typography} from './constants/theme';
export type {Palette} from './constants/theme';
