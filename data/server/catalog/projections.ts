import type {
    CastMember, ListMoviesResult, ListShowsResult, Movie, MovieDetails, ParentalGuide, Show, ShowEpisode, Torrent,
} from '@/domain';

export interface CatalogProjectionOptions {
    includeTorrentMetadata?: boolean;
}

const HASH = /\b(?:[a-f\d]{32,64}|[a-z2-7]{32})\b/gi;
const UNSAFE_IMAGE = /(?:magnet\s*:|urn\s*:|btih|btmh|bittorrent|\.torrent(?:\b|$)|(?:^|[/_.?&=-])downloads?(?:[/_.?&=-]|$))/i;
const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|webp)$/i;

function decoded(value: string): string {
    let result = value;
    for (let attempt = 0; attempt < 3; attempt++) {
        let next = result.replace(/&#(?:x([a-f\d]+)|(\d+));?/gi, (_, hex: string, decimal: string) => {
            const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
        }).replace(/&(amp|colon|sol|bsol|tab|newline);/gi, (_, entity: string) => ({
            amp: '&', colon: ':', sol: '/', bsol: '\\', tab: '', newline: '',
        }[entity.toLowerCase()] ?? ''));
        try {
            next = decodeURIComponent(next);
        } catch {
            next = next.replace(/%([a-f\d]{2})/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
        }
        if (next === result) break;
        result = next;
    }
    return result.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '');
}

function text(value: unknown, maximum = 20_000): string {
    if (typeof value !== 'string') return '';
    const inspected = decoded(value.slice(0, maximum * 4));
    if (/%[a-f\d]{2}|&#(?:x[a-f\d]+|\d+);?|&(amp|colon|sol|bsol);/i.test(inspected)) return '';
    return inspected
        .replace(/<[^>]*>/g, '')
        .replace(/(?:[a-z][a-z\d+.-]*:\/\/|(?:magnet|urn|https?|ftp|ed2k|thunder)\s*:|www\.)[^\s<>"']*/gi, '')
        .replace(/(?:^|\s)\/\/[^\s<>"']*/g, ' ')
        .replace(/\b[^\s<>"']+\.torrent(?:[?#][^\s<>"']*)?/gi, '')
        .replace(HASH, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, maximum);
}

function identifier(value: unknown, pattern: RegExp): string {
    return typeof value === 'string' && pattern.test(value) ? value : '';
}

function number(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function list<T>(value: unknown, project: (item: T) => unknown, maximum: number): unknown[] {
    return Array.isArray(value) ? value.slice(0, maximum).map(project) : [];
}

function publicImageHost(hostname: string): boolean {
    return /^[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(hostname)
        && !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/i.test(hostname);
}

export function safeImageUrl(value: unknown, nested = false): string | undefined {
    if (typeof value !== 'string' || value.length > 4096 || /[\s\\]/.test(value)) return undefined;
    const inspected = decoded(value);
    HASH.lastIndex = 0;
    if (UNSAFE_IMAGE.test(inspected) || HASH.test(inspected) || /%[a-f\d]{2}/i.test(inspected)) return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !publicImageHost(url.hostname)) return undefined;
        if (url.hostname === 'wsrv.nl' && !nested) {
            if (url.pathname !== '/') return undefined;
            const keys = [...url.searchParams.keys()];
            if (new Set(keys).size !== keys.length || keys.some(key => !['url', 'w', 'fit', 'output', 'q', 'we'].includes(key))) return undefined;
            const source = safeImageUrl(url.searchParams.get('url'), true);
            if (!source) return undefined;
            const width = url.searchParams.get('w');
            const quality = url.searchParams.get('q');
            const fit = url.searchParams.get('fit');
            const output = url.searchParams.get('output');
            if (width !== null && (!/^\d{1,4}$/.test(width) || Number(width) < 1 || Number(width) > 4096)) return undefined;
            if (quality !== null && (!/^\d{1,3}$/.test(quality) || Number(quality) < 1 || Number(quality) > 100)) return undefined;
            if (fit !== null && !['cover', 'contain', 'inside', 'outside', 'fill'].includes(fit)) return undefined;
            if (output !== null && !['webp', 'avif', 'jpg', 'png'].includes(output)) return undefined;
            if (url.searchParams.has('we') && url.searchParams.get('we') !== '') return undefined;
            url.searchParams.set('url', source);
            return url.href;
        }
        if (url.search || !IMAGE_EXTENSION.test(url.pathname)) return undefined;
        return url.href;
    } catch {
        return undefined;
    }
}

function imageList(value: unknown): string[] {
    return Array.isArray(value) ? value.slice(0, 30).map(item => safeImageUrl(item)).filter((item): item is string => !!item) : [];
}

function projectTorrent(value: Torrent) {
    return {
        quality: text(value.quality, 60),
        type: text(value.type, 60),
        videoCodec: text(value.videoCodec, 60),
        bitDepth: text(value.bitDepth, 60),
        audioChannels: text(value.audioChannels, 60),
        seeds: number(value.seeds),
        peers: number(value.peers),
        size: text(value.size, 60),
        sizeBytes: number(value.sizeBytes),
        uploadedAt: value.uploadedAt.toISOString(),
    };
}

export function projectMovie(value: Movie) {
    return {
        id: number(value.id),
        imdbCode: identifier(value.imdbCode, /^tt\d{1,12}$/),
        title: text(value.title, 300),
        titleLong: text(value.titleLong, 400),
        year: number(value.year),
        rating: number(value.rating),
        runtimeMinutes: number(value.runtimeMinutes),
        genres: list<string>(value.genres, genre => text(genre, 60), 30),
        summary: text(value.summary),
        language: text(value.language, 60),
        mpaRating: text(value.mpaRating, 60),
        posterUrls: imageList(value.posterUrls),
        backgroundImageUrl: safeImageUrl(value.backgroundImageUrl),
        ytTrailerCode: identifier(value.ytTrailerCode, /^[a-zA-Z\d_-]{11}$/) || undefined,
        thumbnailUrls: value.thumbnailUrls === undefined ? undefined : imageList(value.thumbnailUrls),
    };
}

function projectCastMember(value: CastMember) {
    return {
        name: text(value.name, 200),
        character: text(value.character, 300),
        imdbCode: identifier(value.imdbCode, /^(?:nm)?\d{1,12}$/) || undefined,
        imageUrl: safeImageUrl(value.imageUrl),
    };
}

export function projectMovieDetails(value: MovieDetails, options: CatalogProjectionOptions = {}) {
    return {
        ...projectMovie(value),
        descriptionIntro: value.descriptionIntro === undefined ? undefined : text(value.descriptionIntro),
        descriptionFull: text(value.descriptionFull),
        synopsis: text(value.synopsis),
        ytTrailerCode: identifier(value.ytTrailerCode, /^[a-zA-Z\d_-]{11}$/),
        likeCount: value.likeCount === undefined ? undefined : number(value.likeCount),
        screenshotUrls: imageList(value.screenshotUrls),
        screenshotThumbUrls: imageList(value.screenshotThumbUrls),
        cast: list<CastMember>(value.cast, projectCastMember, 100),
        ...(options.includeTorrentMetadata ? {
            torrents: list<Torrent>(value.torrents, projectTorrent, 30),
            downloadCount: value.downloadCount === undefined ? undefined : number(value.downloadCount),
        } : {}),
    };
}

export function projectParentalGuide(value: ParentalGuide) {
    return {type: text(value.type, 100), text: text(value.text)};
}

export function projectEpisode(value: ShowEpisode, options: CatalogProjectionOptions = {}) {
    return {
        id: number(value.id),
        title: text(value.title, 500),
        season: number(value.season),
        episode: number(value.episode),
        releasedAt: value.releasedAt.toISOString(),
        thumbnailUrl: safeImageUrl(value.thumbnailUrl),
        ...(options.includeTorrentMetadata ? {
            seeds: number(value.seeds),
            peers: number(value.peers),
            sizeBytes: number(value.sizeBytes),
        } : {}),
    };
}

export function projectShow(value: Show, options: CatalogProjectionOptions = {}) {
    return {
        imdbId: identifier(value.imdbId, /^\d{1,12}$/),
        imdbCode: identifier(value.imdbCode, /^tt\d{1,12}$/),
        title: text(value.title, 300),
        episodeCount: number(value.episodeCount),
        latestEpisode: projectEpisode(value.latestEpisode, options),
        thumbnailUrl: safeImageUrl(value.thumbnailUrl),
        updatedAt: value.updatedAt.toISOString(),
    };
}

export function projectMovieList(value: ListMoviesResult) {
    return {
        movies: list<Movie>(value.movies, projectMovie, 50),
        pageNumber: number(value.pageNumber),
        movieCount: number(value.movieCount),
        hasMore: value.hasMore === true,
    };
}

export function projectShowList(value: ListShowsResult, options: CatalogProjectionOptions = {}) {
    return {
        shows: list<Show>(value.shows, show => projectShow(show, options), 50),
        pageNumber: number(value.pageNumber),
        hasMore: value.hasMore === true,
    };
}

export const projectSuggestions = (value: Movie[]) => list<Movie>(value, projectMovie, 50);
export const projectParentalGuides = (value: ParentalGuide[]) => list<ParentalGuide>(value, projectParentalGuide, 100);
export const projectEpisodes = (value: ShowEpisode[], options: CatalogProjectionOptions = {}) => list<ShowEpisode>(value, episode => projectEpisode(episode, options), 300);
