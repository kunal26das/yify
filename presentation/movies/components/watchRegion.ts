import {useSyncExternalStore} from 'react';
import {Platform} from 'react-native';
import * as Localization from 'expo-localization';

const ZONE_REGION: Record<string, string> = {
    Kolkata: 'IN', Calcutta: 'IN', Colombo: 'LK', Karachi: 'PK', Dhaka: 'BD', Kathmandu: 'NP',
    London: 'GB', Dublin: 'IE', Paris: 'FR', Berlin: 'DE', Madrid: 'ES', Rome: 'IT',
    Amsterdam: 'NL', Brussels: 'BE', Lisbon: 'PT', Zurich: 'CH', Vienna: 'AT', Stockholm: 'SE',
    Oslo: 'NO', Copenhagen: 'DK', Helsinki: 'FI', Warsaw: 'PL', Prague: 'CZ', Moscow: 'RU',
    Istanbul: 'TR', Athens: 'GR', Dubai: 'AE', Riyadh: 'SA', Doha: 'QA', Jerusalem: 'IL',
    Tokyo: 'JP', Seoul: 'KR', Shanghai: 'CN', Hong_Kong: 'HK', Taipei: 'TW', Singapore: 'SG',
    Bangkok: 'TH', Jakarta: 'ID', Manila: 'PH', Kuala_Lumpur: 'MY', Ho_Chi_Minh: 'VN',
    Sydney: 'AU', Melbourne: 'AU', Brisbane: 'AU', Perth: 'AU', Auckland: 'NZ',
    Toronto: 'CA', Vancouver: 'CA', Montreal: 'CA', Mexico_City: 'MX',
    Sao_Paulo: 'BR', Buenos_Aires: 'AR', Santiago: 'CL', Bogota: 'CO', Lima: 'PE',
    Johannesburg: 'ZA', Lagos: 'NG', Nairobi: 'KE', Cairo: 'EG', Casablanca: 'MA',
};

export function deviceRegion(): string {
    try {
        const region = Localization.getLocales()[0]?.regionCode;
        if (region && /^[A-Z]{2}$/.test(region.toUpperCase())) return region.toUpperCase();
    } catch {
    }
    try {
        const locale =
            Platform.OS === 'web' && typeof navigator !== 'undefined'
                ? navigator.language
                : new Intl.DateTimeFormat().resolvedOptions().locale;
        const region = locale ? new Intl.Locale(locale).region : undefined;
        if (region && /^[A-Z]{2}$/.test(region.toUpperCase())) return region.toUpperCase();
    } catch {
    }
    try {
        const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
        const city = zone?.split('/').pop();
        if (city && ZONE_REGION[city]) return ZONE_REGION[city];
        if (zone?.startsWith('America/')) return 'US';
        if (zone?.startsWith('Europe/')) return 'GB';
    } catch {
    }
    return 'US';
}

function subscribe() {
    return () => {};
}

function serverRegion() {
    return Platform.OS === 'web' ? 'US' : deviceRegion();
}

export function useDeviceRegion(): string {
    return useSyncExternalStore(subscribe, deviceRegion, serverRegion);
}
