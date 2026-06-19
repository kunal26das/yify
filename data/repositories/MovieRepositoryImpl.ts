import type { Movie, ListMoviesParams, ListMoviesResult, MovieRepository } from '@/domain';
import type { ListMoviesApi } from '@/data';

export class MovieRepositoryImpl implements MovieRepository {
    constructor(private readonly api: ListMoviesApi) {
    }

    private upgradeHttpUrlToHttps(url: string): string {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:') {
            parsed.protocol = 'https:';
            return parsed.href;
        }
        return url;
    }

    private toPosterDisplayUrl(url: string, width = 720): string {
        const trimmed = url.trim();
        if (!trimmed) return trimmed;
        const normalized = this.upgradeHttpUrlToHttps(trimmed);
        return `https://wsrv.nl/?url=${encodeURIComponent(normalized)}&w=${width}&fit=cover&output=jpg`;
    }

    async listMovies(params: ListMoviesParams): Promise<ListMoviesResult> {
        const response = await this.api.listMovies({
            page: params.page,
            limit: params.limit ?? 20,
            query: params.query,
            quality: params.quality,
            minimum_rating: params.minimum_rating,
            genre: params.genre,
            sort_by: params.sort_by,
            order_by: params.order_by,
        });

        const movies: Movie[] = (response.data.movies ?? []).map((m) => {
            const posterUrls = [m.small_cover_image, m.medium_cover_image, m.large_cover_image,]
                .map((url, index) => {
                    if (typeof url !== 'string' || url.length === 0) return null;
                    const widths = [240, 480, 720] as const;
                    return this.toPosterDisplayUrl(url, widths[index]);
                })
                .filter((url): url is string => url != null);
            return {
                id: m.id,
                posterUrls,
            };
        });

        const {page_number, movie_count, limit} = response.data;
        const loadedCount = page_number * limit;
        const receivedCount = movies.length;
        const limitUsed = params.limit ?? 20;
        const hasMore =
            receivedCount > 0 &&
            (loadedCount < movie_count || receivedCount >= limitUsed);

        return {
            movies,
            pageNumber: page_number,
            movieCount: movie_count,
            hasMore,
        };
    }
}
