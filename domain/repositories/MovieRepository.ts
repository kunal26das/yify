import type {Movie, MovieDetails, ParentalGuide} from '@/domain';

export interface ListMoviesParams {
  page: number;
  limit?: number;
  query?: string;
  quality?: string;
  minimum_rating?: number;
  genre?: string;
  sort_by?: string;
  order_by?: 'asc' | 'desc';
}

export interface ListMoviesResult {
  movies: Movie[];
  pageNumber: number;
  movieCount: number;
  hasMore: boolean;
}

export interface MovieRepository {
  listMovies(params: ListMoviesParams): Promise<ListMoviesResult>;

  getMovieDetails(movieId: number): Promise<MovieDetails>;

  getMovieSuggestions(movieId: number): Promise<Movie[]>;

  getMovieParentalGuides(movieId: number): Promise<ParentalGuide[]>;
}
