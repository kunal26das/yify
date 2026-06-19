import type {YtsCastMemberDto} from './YtsCastMemberDto';
import type {YtsTorrentDto} from './YtsTorrentDto';

/**
 * A movie object. The list endpoint returns the core fields; `movie_details`
 * adds `description_intro`, `like_count`, the screenshot images (when
 * `with_images=true`) and `cast` (when `with_cast=true`).
 */
export interface YtsMovieDto {
    id: number;
    url: string;
    imdb_code: string;
    title: string;
    title_english: string;
    title_long: string;
    slug: string;
    year: number;
    rating: number;
    runtime: number;
    genres: string[];
    summary: string;
    description_full: string;
    synopsis: string;
    yt_trailer_code: string;
    language: string;
    mpa_rating: string;
    background_image: string;
    background_image_original: string;
    small_cover_image: string;
    medium_cover_image: string;
    large_cover_image: string;
    torrents: YtsTorrentDto[];
    date_uploaded: string;
    date_uploaded_unix: number;
    // List-only / conditional fields
    state?: string;
    like_count?: number;
    download_count?: number;
    // `movie_details` only
    description_intro?: string;
    // `movie_details` with `with_images=true`
    medium_screenshot_image1?: string;
    medium_screenshot_image2?: string;
    medium_screenshot_image3?: string;
    large_screenshot_image1?: string;
    large_screenshot_image2?: string;
    large_screenshot_image3?: string;
    // `movie_details` with `with_cast=true`
    cast?: YtsCastMemberDto[];
}
