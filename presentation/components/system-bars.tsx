import {useEffect} from 'react';
import {setStyle} from 'expo-navigation-bar';
import {setBackgroundColorAsync} from 'expo-system-ui';
import {usePalette} from '../hooks/use-palette';

export function SystemBars(): null {
    const {scheme, colors} = usePalette();
    useEffect(() => {
        setStyle(scheme === 'dark' ? 'dark' : 'light');
        void setBackgroundColorAsync(colors.background).catch(() => {});
    }, [scheme, colors.background]);
    return null;
}
