export interface EztvTorrentDto {
    id: number;
    hash: string;
    filename: string;
    magnet_url: string;
    title: string;
    imdb_id: string;
    season: string;
    episode: string;
    small_screenshot: string;
    large_screenshot: string;
    seeds: number;
    peers: number;
    date_released_unix: number;
    size_bytes: string;
}

export interface EztvTorrentsResponse {
    torrents_count: number;
    limit: number;
    page: number;
    torrents?: EztvTorrentDto[];
}
