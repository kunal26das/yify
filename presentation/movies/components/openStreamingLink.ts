import {Linking} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {safeStreamingUrl} from '@/domain';

export async function openStreamingLink(value: string): Promise<void> {
    const url = safeStreamingUrl(value);
    if (!url) throw new Error('Invalid streaming link');
    try {
        await Linking.openURL(url);
    } catch {
        await WebBrowser.openBrowserAsync(url, {enableBarCollapsing: true});
    }
}
