export type CountryLocationResult =
    | {status: 'ready'; country: string}
    | {status: 'denied' | 'unavailable' | 'timeout'};
