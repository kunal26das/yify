import type {YtsApiResponse} from './YtsApiResponse';
import type {YtsParentalGuideDto} from './YtsParentalGuideDto';

/** `movie_parental_guides.json` payload. */
export interface YtsMovieParentalGuidesData {
    parental_guide_count: number;
    parental_guides: YtsParentalGuideDto[];
}

export type YtsMovieParentalGuidesResponse = YtsApiResponse<YtsMovieParentalGuidesData>;
