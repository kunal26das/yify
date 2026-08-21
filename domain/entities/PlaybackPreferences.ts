export interface PlaybackPreferences {
    autoplayTrailers: boolean;
    trailerCaptions: boolean;
    autoplayNext: boolean;
    miniPlayer: boolean;
}

export const DEFAULT_PLAYBACK_PREFERENCES: PlaybackPreferences = {
    autoplayTrailers: true,
    trailerCaptions: false,
    autoplayNext: true,
    miniPlayer: true,
};
