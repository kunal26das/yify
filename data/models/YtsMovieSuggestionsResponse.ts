import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsMovieDto} from './YtsMovieDto';

export interface YtsMovieSuggestionsData {
    movie_count: number;
    movies: YtsMovieDto[];
}

export type YtsMovieSuggestionsResponse = YtsApiResponse<YtsMovieSuggestionsData>;
