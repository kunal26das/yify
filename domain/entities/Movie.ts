export const POSTER_WIDTHS = [230, 500] as const;

export interface Movie {
  id: number;
  imdbCode: string;
  title: string;
  titleLong: string;
  year: number;
  rating: number;
  runtimeMinutes: number;
  genres: string[];
  summary: string;
  language: string;
  mpaRating: string;
  posterUrls: string[];
  backgroundImageUrl?: string;
  ytTrailerCode?: string;
  thumbnailUrls?: string[];
}
