import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsMovieDto} from './YtsMovieDto';

/** `list_movies.json` payload. */
export interface YtsListMoviesData {
    movie_count: number;
    limit: number;
    page_number: number;
    movies: YtsMovieDto[];
}

export type YtsListMoviesResponse = YtsApiResponse<YtsListMoviesData>;
