/** A movie as shown in lists and grids. */
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
  /** Display-ready poster URLs ordered small → large. */
  posterUrls: string[];
  backgroundImageUrl?: string;
}
