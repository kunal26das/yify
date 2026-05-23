import {Colors, Gradients, type Palette} from '../constants/theme';
import {useColorScheme} from './use-color-scheme';

export interface GradientSet {
    accent: readonly string[];
    accentSubtle: readonly string[];
}

export interface ThemePalette {
    scheme: 'light' | 'dark';
    colors: Palette;
    gradients: GradientSet;
}

/**
 * Returns the full themed palette plus the active accent gradient for the
 * current color scheme. Preferred over `useThemeColor` for new code that needs
 * several tokens at once.
 */
export function usePalette(): ThemePalette {
    const raw = useColorScheme();
    const scheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';
    return {
        scheme,
        colors: Colors[scheme],
        gradients: Gradients[scheme],
    };
}
