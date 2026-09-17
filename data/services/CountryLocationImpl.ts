import * as Location from 'expo-location';

import type {CountryLocation, CountryLocationResult} from '@/domain';
import {CountryLocationRequest, locationCountry, validLocationCoordinates} from './countryLocationRequest';

export class CountryLocationImpl implements CountryLocation {
    private readonly requests = new CountryLocationRequest((signal) => this.locate(signal));

    requestCountry(signal?: AbortSignal): Promise<CountryLocationResult> {
        return this.requests.request(signal);
    }

    private async locate(signal: AbortSignal): Promise<CountryLocationResult> {
        let permission = await Location.getForegroundPermissionsAsync();
        if (signal.aborted) return {status: 'unavailable'};
        if (!permission.granted && permission.canAskAgain !== false) {
            permission = await Location.requestForegroundPermissionsAsync();
        }
        if (signal.aborted) return {status: 'unavailable'};
        if (!permission.granted) return {status: 'denied'};
        const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            mayShowUserSettingsDialog: false,
        });
        if (signal.aborted) return {status: 'unavailable'};
        const latitude = position?.coords?.latitude;
        const longitude = position?.coords?.longitude;
        if (!validLocationCoordinates(latitude, longitude)) return {status: 'unavailable'};
        const addresses = await Location.reverseGeocodeAsync({latitude, longitude});
        if (signal.aborted || !Array.isArray(addresses)) return {status: 'unavailable'};
        for (const address of addresses) {
            const country = locationCountry(address?.isoCountryCode);
            if (country) return {status: 'ready', country};
        }
        return {status: 'unavailable'};
    }
}
