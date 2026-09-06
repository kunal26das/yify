import {useEffect} from 'react';
import {setStyle} from 'expo-navigation-bar';
import {useColorScheme} from '../hooks/use-color-scheme';

export function SystemBars(): null {
    const scheme = useColorScheme();
    useEffect(() => {
        setStyle(scheme === 'dark' ? 'dark' : 'light');
    }, [scheme]);
    return null;
}
