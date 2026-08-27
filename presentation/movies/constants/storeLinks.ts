import Constants from 'expo-constants';

export type DistributionChannel =
    | 'play'
    | 'github'
    | 'uptodown'
    | 'indus'
    | 'palm'
    | 'microsoft'
    | 'snap';

export interface StoreLink {
    channel: DistributionChannel;
    label: string;
    url: string;
    appUri?: string;
}

const PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'io.github.kunal26das.yify';

const RELEASES_URL = 'https://github.com/kunal26das/yify/releases/latest';

const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`;

const LABELS: Record<DistributionChannel, string> = {
    play: 'Google Play',
    github: 'GitHub releases',
    uptodown: 'Uptodown',
    indus: 'Indus Appstore',
    palm: 'Palm Store',
    microsoft: 'Microsoft Store',
    snap: 'Snap Store',
};

const LISTINGS: Partial<Record<DistributionChannel, string>> = {
    play: PLAY_URL,
    github: RELEASES_URL,
};

function isChannel(value: string): value is DistributionChannel {
    return Object.prototype.hasOwnProperty.call(LABELS, value);
}

export function distributionChannel(): DistributionChannel {
    const declared = process.env.EXPO_PUBLIC_DISTRIBUTION;
    return declared && isChannel(declared) ? declared : 'play';
}

export function storeLink(channel: DistributionChannel = distributionChannel()): StoreLink {
    return {
        channel,
        label: LABELS[channel],
        url: LISTINGS[channel] ?? RELEASES_URL,
        appUri: channel === 'play' ? `market://details?id=${PACKAGE_NAME}` : undefined,
    };
}

export const PLAY_STORE_URL = PLAY_URL;

export const DOWNLOAD_LINKS: StoreLink[] = [storeLink('play'), storeLink('github')];
