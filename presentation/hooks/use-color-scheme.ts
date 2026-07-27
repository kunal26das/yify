import {useColorScheme as useSystemColorScheme} from 'react-native';
import {useSettings} from './use-settings';

export function useColorScheme() {
    const system = useSystemColorScheme();
    const {theme} = useSettings();
    return theme === 'system' ? system : theme;
}
