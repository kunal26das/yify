import {useColorScheme as useSystemColorScheme} from 'react-native';
import {usePreferences} from './use-preferences';

export function useColorScheme() {
    const system = useSystemColorScheme();
    const {theme} = usePreferences();
    return theme === 'system' ? system : theme;
}
