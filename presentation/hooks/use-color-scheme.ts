import {useColorScheme as useSystemColorScheme} from 'react-native';
import {useSettings} from './use-settings';

/**
 * The scheme the UI should paint in: the device's, unless the viewer has picked one in Settings.
 *
 * Everything colour-related reads the palette through this hook, so overriding it here re-themes
 * the whole app — there is no provider to thread through the tree.
 */
export function useColorScheme() {
    const system = useSystemColorScheme();
    const {theme} = useSettings();
    return theme === 'system' ? system : theme;
}
