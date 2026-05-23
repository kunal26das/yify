import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsMovieDto} from './YtsMovieDto';

/** `movie_details.json` payload. */
export interface YtsMovieDetailsData {
    movie: YtsMovieDto;
}

export type YtsMovieDetailsResponse = YtsApiResponse<YtsMovieDetailsData>;
