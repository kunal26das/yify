/** A cast member, returned by `movie_details` when `with_cast=true`. */
export interface YtsCastMemberDto {
    name: string;
    character_name: string;
    url_small_image?: string;
    imdb_code?: string;
}
