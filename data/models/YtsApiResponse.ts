export interface YtsMovieDto {
  id: number;
  medium_cover_image: string;
  large_cover_image: string;
  small_cover_image: string;
}

export interface YtsListMoviesResponse {
  status: 'ok' | 'error';
  status_message: string;
  data: {
    movie_count: number;
    limit: number;
    page_number: number;
    movies: YtsMovieDto[];
  };
}
