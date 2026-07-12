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
    size: string;
    sizeBytes: number;
    uploadedAt: Date;
}
