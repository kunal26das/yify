import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsMovieDto} from './YtsMovieDto';

export interface YtsMovieDetailsData {
    movie: YtsMovieDto;
}

export type YtsMovieDetailsResponse = YtsApiResponse<YtsMovieDetailsData>;
