import type {GenresResponse} from '@/core/domain/api';
import genres from './v2/genres.json';

export function fixtureGenres(): GenresResponse {
  return genres as unknown as GenresResponse;
}
