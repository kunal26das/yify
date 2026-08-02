export interface ShowEpisode {
    id: number;
    title: string;
    season: number;
    episode: number;
    seeds: number;
    peers: number;
    sizeBytes: number;
    magnetUrl: string;
    releasedAt: Date;
    thumbnailUrl?: string;
}

export interface Show {
    imdbId: string;
    imdbCode: string;
    title: string;
    episodeCount: number;
    latestEpisode: ShowEpisode;
    thumbnailUrl?: string;
    updatedAt: Date;
}
