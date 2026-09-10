import {Linking, Platform} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {SITE_URL} from './site';

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy/`;
export const TERMS_URL = `${SITE_URL}/terms/`;

export const LEGAL_LINKS = [
    {label: 'Privacy policy', url: PRIVACY_POLICY_URL},
    {label: 'Terms and conditions', url: TERMS_URL},
] as const;

export async function openLegalPage(url: string): Promise<void> {
    if (Platform.OS === 'android') {
        await WebBrowser.openBrowserAsync(url, {enableBarCollapsing: true});
    } else {
        await Linking.openURL(url);
    }
}
