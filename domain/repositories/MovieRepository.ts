import type {Genre, OrderBy, Quality, SortBy} from '../entities/MovieQuery';
import type {Movie} from '../entities/Movie';
import type {MovieDetails} from '../entities/MovieDetails';
import type {ParentalGuide} from '../entities/ParentalGuide';

export interface ListMoviesParams {
  page: number;
  limit?: number;
  query?: string;
  quality?: Quality;
  minimum_rating?: number;
  genre?: Genre;
  sort_by?: SortBy;
  order_by?: OrderBy;
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
