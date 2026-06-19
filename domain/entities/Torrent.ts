/** A downloadable torrent for a movie. */
export interface Torrent {
    url: string;
    hash: string;
    quality: string;
    type: string;
    videoCodec: string;
    bitDepth: string;
    audioChannels: string;
    seeds: number;
    peers: number;
    /** Human-readable size, e.g. "1.2 GB". */
    size: string;
    sizeBytes: number;
    uploadedAt: Date;
}
