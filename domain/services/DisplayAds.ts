import type {DisplayAdState} from './DisplayAdState';

export interface DisplayAds {
    readonly supported: boolean;

    attach(containerId: string, onStateChange?: (state: DisplayAdState) => void): () => void;
}
