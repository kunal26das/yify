import type {ListShowsParams, ListShowsResult, Show, ShowEpisode, ShowRepository} from '@/domain';
import type {EztvApi, EztvTorrentDto} from '@/data';

const EPISODE_TAG = /\bS\d{1,2}\s?E\d{1,3}\b/i;
const TRAILING_NOISE = /[\s._-]+$/;

function showTitle(dto: EztvTorrentDto): string {
    const raw = dto.title ?? '';
    const match = raw.match(EPISODE_TAG);
    const head = match?.index != null ? raw.slice(0, match.index) : raw;
    const cleaned = head.replace(/[._]+/g, ' ').replace(TRAILING_NOISE, '').trim();
    return cleaned || raw.trim() || 'Unknown series';
}

function absoluteUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    const trimmed = url.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (trimmed.startsWith('http://')) return `https://${trimmed.slice('http://'.length)}`;
    return trimmed;
}

function toImdbCode(imdbId: string): string {
    const digits = (imdbId ?? '').replace(/\D/g, '');
    return digits ? `tt${digits.padStart(7, '0')}` : '';
}

function toEpisode(dto: EztvTorrentDto): ShowEpisode {
    return {
        id: dto.id,
        title: dto.title,
        season: Number(dto.season) || 0,
        episode: Number(dto.episode) || 0,
        seeds: dto.seeds ?? 0,
        peers: dto.peers ?? 0,
        sizeBytes: Number(dto.size_bytes) || 0,
        magnetUrl: dto.magnet_url,
        releasedAt: new Date((dto.date_released_unix ?? 0) * 1000),
        thumbnailUrl: absoluteUrl(dto.large_screenshot ?? dto.small_screenshot),
    };
}

function isBetter(candidate: ShowEpisode, current: ShowEpisode): boolean {
    if (candidate.releasedAt.getTime() !== current.releasedAt.getTime()) {
        return candidate.releasedAt.getTime() > current.releasedAt.getTime();
    }
    return candidate.seeds > current.seeds;
}

export class ShowRepositoryImpl implements ShowRepository {
    constructor(private readonly api: EztvApi) {
    }

    async listShows(params: ListShowsParams): Promise<ListShowsResult> {
        const response = await this.api.getTorrents({
            page: params.page,
            limit: params.limit,
            imdb_id: params.imdbId,
        });

        const torrents = response.torrents ?? [];
        const grouped = new Map<string, Show>();

        for (const dto of torrents) {
            const key = dto.imdb_id?.trim();
            if (!key) continue;
            const episode = toEpisode(dto);
            const existing = grouped.get(key);

            if (!existing) {
                grouped.set(key, {
                    imdbId: key,
                    imdbCode: toImdbCode(key),
                    title: showTitle(dto),
                    episodeCount: 1,
                    latestEpisode: episode,
                    thumbnailUrl: episode.thumbnailUrl,
                    updatedAt: episode.releasedAt,
                });
                continue;
            }

            existing.episodeCount += 1;
            if (isBetter(episode, existing.latestEpisode)) {
                existing.latestEpisode = episode;
                existing.updatedAt = episode.releasedAt;
                existing.thumbnailUrl = episode.thumbnailUrl ?? existing.thumbnailUrl;
            }
        }

        const shows = [...grouped.values()].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );

        return {
            shows,
            pageNumber: response.page ?? params.page,
            hasMore: torrents.length > 0,
        };
    }
}
