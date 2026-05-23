import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsMovieDto} from './YtsMovieDto';

/** `movie_suggestions.json` payload (returns four related movies). */
export interface YtsMovieSuggestionsData {
    movie_count: number;
    movies: YtsMovieDto[];
}

export type YtsMovieSuggestionsResponse = YtsApiResponse<YtsMovieSuggestionsData>;
