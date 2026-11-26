import type {MediaType, PersonKey, TitleKey} from './keys';
import type {RegionAvailability} from './providers';

export interface Genre {
  id: number;
  name: string;
  types: MediaType[];
}

export interface TitleSummary {
  key: TitleKey;
  type: MediaType;
  id: number;
  slug: string;
  title: string;
  originalTitle: string;
  year: number | null;
  releaseDate: string | null;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  voteCount: number;
  genreIds: number[];
  originalLanguage: string;
}

export type VideoType = 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | 'Behind the Scenes' | 'Bloopers' | 'Opening Credits';

export interface Video {
  key: string;
  type: VideoType;
  name: string;
  official: boolean;
  language: string | null;
  publishedAt: string | null;
}

export interface CastCredit {
  personKey: PersonKey;
  personId: number;
  slug: string;
  name: string;
  character: string;
  profilePath: string | null;
  episodeCount: number | null;
}

export interface CrewCredit {
  personKey: PersonKey;
  personId: number;
  slug: string;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

interface TitleDetailsBase extends TitleSummary {
  tagline: string;
  genres: Genre[];
  runtimeMinutes: number | null;
  certification: string | null;
  imdbId: string | null;
  status: string;
  homepage: string | null;
  cast: CastCredit[];
  crew: CrewCredit[];
  videos: Video[];
  trailer: Video | null;
  recommendations: TitleSummary[];
  availability: RegionAvailability;
}

export interface MovieDetails extends TitleDetailsBase {
  type: 'movie';
  collection: {id: number; name: string} | null;
}

export interface EpisodeSummary {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface TvDetails extends TitleDetailsBase {
  type: 'tv';
  seasons: SeasonSummary[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  inProduction: boolean;
  lastAirDate: string | null;
  nextEpisode: EpisodeSummary | null;
  lastEpisode: EpisodeSummary | null;
  networks: {id: number; name: string; logoPath: string | null}[];
  createdBy: {personKey: PersonKey; name: string}[];
}

export type TitleDetails = MovieDetails | TvDetails;

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtimeMinutes: number | null;
  stillPath: string | null;
  rating: number | null;
}

export interface SeasonDetails {
  key: TitleKey;
  seasonNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  posterPath: string | null;
  episodes: Episode[];
}
