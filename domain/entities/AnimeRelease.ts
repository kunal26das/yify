/** Nyaa upload identity is independent of movie and series IDs. */
export type AnimeCategory = 'all' | 'english' | 'non-english' | 'raw' | 'music-video';

export interface AnimeRelease {
    id: `nyaa:${number}`;
    title: string;
    category: Exclude<AnimeCategory, 'all'>;
    uploadedAt: Date;
    size: string;
    seeds: number;
    peers: number;
    downloadCount: number;
}
