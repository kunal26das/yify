import type {PersonKey} from './keys';
import type {TitleSummary} from './title';

export interface PersonSummary {
  key: PersonKey;
  id: number;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  knownFor: TitleSummary[];
}

export interface PersonCredit {
  title: TitleSummary;
  character: string | null;
  jobs: string[];
  episodeCount: number | null;
}

export interface PersonDetails {
  key: PersonKey;
  id: number;
  slug: string;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  imdbId: string | null;
  alsoKnownAs: string[];
  knownFor: TitleSummary[];
  credits: PersonCredit[];
}
