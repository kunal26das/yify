import type { Movie } from '@/domain/entities/Movie';
import type {
  ListMoviesParams,
  ListMoviesResult,
  MovieRepository,
} from '@/domain/repositories/MovieRepository';
import type { ListMoviesApi } from '@/data/datasources/YtsApiDataSource';

export class MovieRepositoryImpl implements MovieRepository {
  constructor(private readonly api: ListMoviesApi) {}

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
      const posterUrls = [m.small_cover_image, m.medium_cover_image, m.large_cover_image]
        .filter((url): url is string => typeof url === 'string' && url.length > 0);
      return {
        id: m.id,
        posterUrl: posterUrls[posterUrls.length - 1] ?? m.medium_cover_image,
        posterUrls,
      };
    });

    const { page_number, movie_count, limit } = response.data;
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
